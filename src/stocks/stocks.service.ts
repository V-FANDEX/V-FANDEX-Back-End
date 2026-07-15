import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SeedSource, Stock } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { money, rate } from "../common/utils/decimal";
import { withLivePrice } from "../price-movements/price-movement.utils";
import { CreateStockDto } from "./dto/create-stock.dto";
import { SaveStockToSeedDto } from "./dto/save-stock-to-seed.dto";
import { UpdateListingStatusDto } from "./dto/update-listing-status.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";

type ChartInterval = "minute" | "hour" | "day";

@Injectable()
export class StocksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { marketId?: string; includeUnlisted?: boolean; search?: string }) {
    const stocks = await this.prisma.stock.findMany({
      where: {
        marketId: params.marketId,
        isListed: params.includeUnlisted ? undefined : true,
        name: params.search ? { contains: params.search, mode: "insensitive" } : undefined
      },
      include: { market: true },
      orderBy: { createdAt: "desc" }
    });

    return this.withMarketMetrics(stocks);
  }

  async get(id: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      include: {
        market: true,
        priceHistories: { orderBy: { createdAt: "desc" }, take: 100 }
      }
    });

    if (!stock) {
      throw new NotFoundException("Stock not found.");
    }

    return (await this.withMarketMetrics([stock]))[0];
  }

  async quotes(marketId?: string) {
    const stocks = await this.prisma.stock.findMany({
      where: { marketId, isListed: true, isTradingSuspended: false },
      select: {
        id: true,
        marketId: true,
        name: true,
        currentPrice: true,
        previousPrice: true,
        targetPrice: true,
        movementStartPrice: true,
        movementStartedAt: true,
        movementEndsAt: true,
        movementReason: true,
      },
      orderBy: { name: "asc" },
    });
    const priceAsOf = new Date();

    return stocks.map((stock) => {
      const liveStock = withLivePrice(stock, priceAsOf);
      const changeRate = stock.previousPrice.lessThanOrEqualTo(0)
        ? rate(0)
        : rate(liveStock.currentPrice.minus(stock.previousPrice).div(stock.previousPrice).mul(100));
      return { ...liveStock, changeRate };
    });
  }

  async create(dto: CreateStockDto) {
    const market = await this.prisma.market.findUnique({ where: { id: dto.marketId }, select: { id: true } });
    if (!market) {
      throw new BadRequestException("Market does not exist.");
    }

    const initialPrice = money(dto.initialPrice);
    const circulatingSupply = dto.circulatingSupply ?? dto.totalSupply;
    if (circulatingSupply > dto.totalSupply) {
      throw new BadRequestException("Circulating supply cannot exceed total supply.");
    }

    try {
      const stock = await this.prisma.stock.create({
        data: {
          marketId: dto.marketId,
          name: dto.name,
          description: dto.description,
          imageUrl: dto.imageUrl,
          tags: dto.tags ?? [],
          currentPrice: initialPrice,
          previousPrice: initialPrice,
          initialPrice,
          totalSupply: dto.totalSupply,
          circulatingSupply,
          volatilityLevel: dto.volatilityLevel ?? 5,
          dividendEnabled: dto.dividendEnabled ?? false,
          baseDividendRate: rate(dto.baseDividendRate ?? 0),
          isListed: dto.isListed ?? true,
          priceHistories: {
            create: {
              price: initialPrice,
              changeRate: 0,
              reason: "INITIAL_LISTING"
            }
          }
        },
        include: { market: true }
      });
      return (await this.withMarketMetrics([stock]))[0];
    } catch {
      throw new BadRequestException("Stock name is already listed in this market.");
    }
  }

  async update(id: string, dto: UpdateStockDto) {
    await this.ensureExists(id);
    const data: Prisma.StockUpdateInput = {
      market: dto.marketId ? { connect: { id: dto.marketId } } : undefined,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      tags: dto.tags,
      totalSupply: dto.totalSupply,
      circulatingSupply: dto.circulatingSupply,
      volatilityLevel: dto.volatilityLevel,
      dividendEnabled: dto.dividendEnabled,
      baseDividendRate: dto.baseDividendRate === undefined ? undefined : rate(dto.baseDividendRate),
      isListed: dto.isListed
    };

    if (dto.initialPrice !== undefined) {
      data.initialPrice = money(dto.initialPrice);
    }

    const stock = await this.prisma.stock.update({
      where: { id },
      data,
      include: { market: true }
    });
    return (await this.withMarketMetrics([stock]))[0];
  }

  async updateListingStatus(id: string, dto: UpdateListingStatusDto) {
    await this.ensureExists(id);
    const stock = await this.prisma.stock.update({
      where: { id },
      data: {
        isListed: dto.isListed,
        isTradingSuspended: dto.isTradingSuspended,
        delistedAt: dto.isListed ? null : new Date()
      }
    });
    return (await this.withMarketMetrics([stock]))[0];
  }

  async saveToSeed(id: string, dto: SaveStockToSeedDto, adminId: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      include: { market: true }
    });
    if (!stock) {
      throw new NotFoundException("Stock not found.");
    }

    const seedPrice = dto.seedPrice === undefined ? stock.initialPrice : money(dto.seedPrice);
    const seededAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const savedStock = await tx.stock.update({
        where: { id },
        data: {
          seedSource: SeedSource.ADMIN,
          seedPrice,
          seededAt
        },
        include: { market: true }
      });

      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: "STOCK_SAVED_TO_SEED",
          metadata: {
            stockId: stock.id,
            stockName: stock.name,
            marketId: stock.marketId,
            marketName: stock.market.name,
            seedPrice: seedPrice.toString()
          }
        }
      });

      return savedStock;
    });

    return (await this.withMarketMetrics([updated]))[0];
  }

  async chartData(id: string, options: { take?: number; interval?: string } = {}) {
    await this.ensureExists(id);
    const take = Math.min(Math.max(options.take ?? 200, 1), 1000);
    const interval = this.normalizeInterval(options.interval);

    if (!interval) {
      const rows = await this.prisma.priceHistory.findMany({
        where: { stockId: id },
        orderBy: { createdAt: "desc" },
        take
      });
      return rows.reverse();
    }

    const rows = await this.prisma.priceHistory.findMany({
      where: { stockId: id },
      orderBy: { createdAt: "asc" },
      take: Math.min(take * 50, 5000)
    });

    return this.bucketChartRows(rows, interval, take);
  }

  private async withMarketMetrics<
    T extends Pick<
      Stock,
      | "id"
      | "currentPrice"
      | "targetPrice"
      | "movementStartPrice"
      | "movementStartedAt"
      | "movementEndsAt"
      | "circulatingSupply"
    >,
  >(
    stocks: T[]
  ) {
    if (!stocks.length) {
      return [];
    }

    const stockIds = stocks.map((stock) => stock.id);
    const tradeSummaries = await this.prisma.trade.groupBy({
      by: ["stockId"],
      where: { stockId: { in: stockIds } },
      _sum: {
        quantity: true,
        totalAmount: true
      }
    });
    const tradeSummaryByStockId = new Map(tradeSummaries.map((summary) => [summary.stockId, summary]));

    const priceAsOf = new Date();
    return stocks.map((stock) => {
      const tradeSummary = tradeSummaryByStockId.get(stock.id);
      const liveStock = withLivePrice(stock, priceAsOf);
      const marketCap = money(liveStock.currentPrice.mul(stock.circulatingSupply));

      return {
        ...liveStock,
        volume: tradeSummary?._sum.quantity ?? 0,
        tradeValue: tradeSummary?._sum.totalAmount ?? 0,
        marketCap,
        status: this.stockStatus(stock as T & { isListed?: boolean; isTradingSuspended?: boolean })
      };
    });
  }

  private stockStatus(stock: { isListed?: boolean; isTradingSuspended?: boolean }) {
    if (!stock.isListed) {
      return "UNLISTED";
    }
    if (stock.isTradingSuspended) {
      return "SUSPENDED";
    }
    return "LISTED";
  }

  private normalizeInterval(interval?: string): ChartInterval | null {
    if (interval === "minute" || interval === "hour" || interval === "day") {
      return interval;
    }
    return null;
  }

  private bucketChartRows(
    rows: Array<{ price: Prisma.Decimal; changeRate: Prisma.Decimal; createdAt: Date; id: string; stockId: string; reason: string | null }>,
    interval: ChartInterval,
    take: number
  ) {
    const buckets = new Map<
      number,
      {
        stockId: string;
        interval: ChartInterval;
        bucket: string;
        createdAt: Date;
        openPrice: Prisma.Decimal;
        highPrice: Prisma.Decimal;
        lowPrice: Prisma.Decimal;
        closePrice: Prisma.Decimal;
        price: Prisma.Decimal;
        changeRate: Prisma.Decimal;
        count: number;
      }
    >();

    for (const row of rows) {
      const bucketTime = this.bucketTime(row.createdAt, interval);
      const existing = buckets.get(bucketTime);

      if (!existing) {
        buckets.set(bucketTime, {
          stockId: row.stockId,
          interval,
          bucket: new Date(bucketTime).toISOString(),
          createdAt: new Date(bucketTime),
          openPrice: row.price,
          highPrice: row.price,
          lowPrice: row.price,
          closePrice: row.price,
          price: row.price,
          changeRate: row.changeRate,
          count: 1
        });
        continue;
      }

      existing.highPrice = Prisma.Decimal.max(existing.highPrice, row.price);
      existing.lowPrice = Prisma.Decimal.min(existing.lowPrice, row.price);
      existing.closePrice = row.price;
      existing.price = row.price;
      existing.changeRate = row.changeRate;
      existing.count += 1;
    }

    return [...buckets.values()].slice(-take);
  }

  private bucketTime(date: Date, interval: ChartInterval) {
    const bucket = new Date(date);
    if (interval === "day") {
      bucket.setUTCHours(0, 0, 0, 0);
    } else if (interval === "hour") {
      bucket.setUTCMinutes(0, 0, 0);
    } else {
      bucket.setUTCSeconds(0, 0);
    }
    return bucket.getTime();
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.stock.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Stock not found.");
    }
  }
}
