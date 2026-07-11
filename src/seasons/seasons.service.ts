import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role, SeasonStatus } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { ResetSeasonDto } from "./dto/reset-season.dto";

type Tx = Prisma.TransactionClient;

interface SeedStock {
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  currentPrice: number;
  previousPrice?: number;
  initialPrice?: number;
  totalSupply: number;
  circulatingSupply?: number;
  volatilityLevel?: number;
  dividendEnabled?: boolean;
  baseDividendRate?: number;
  isListed?: boolean;
}

interface SeedMarket {
  name: string;
  description?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  stocks?: SeedStock[];
}

interface SeedData {
  markets: SeedMarket[];
}

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  list() {
    return this.prisma.season.findMany({ orderBy: { startsAt: "desc" } });
  }

  async current() {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { startsAt: "desc" }
    });

    if (!season) {
      throw new NotFoundException("Active season not found.");
    }

    return season;
  }

  async create(dto: CreateSeasonDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException("Season startsAt must be before endsAt.");
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.status === SeasonStatus.ACTIVE) {
        await tx.season.updateMany({
          where: { status: SeasonStatus.ACTIVE },
          data: { status: SeasonStatus.ENDED }
        });
      }

      return tx.season.create({
        data: {
          name: dto.name,
          startsAt,
          endsAt,
          initialCash: money(dto.initialCash),
          status: dto.status ?? SeasonStatus.UPCOMING
        }
      });
    });
  }

  async reset(id: string, dto: ResetSeasonDto) {
    if (!dto.confirm) {
      throw new BadRequestException("Season reset requires confirm=true.");
    }

    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) {
      throw new NotFoundException("Season not found.");
    }

    const seedData = this.loadSeedData();
    const initialCash = money(season.initialCash);
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.season.updateMany({
          where: { status: SeasonStatus.ACTIVE, id: { not: id } },
          data: { status: SeasonStatus.ENDED }
        });
        await tx.season.update({ where: { id }, data: { status: SeasonStatus.ACTIVE } });

        const cleared = await this.clearSimulationDataInTx(tx);
        const catalog = await this.resetCatalogFromSeedInTx(tx, seedData);

        const users = await tx.user.updateMany({
          where: { role: { in: [Role.USER, Role.AI] } },
          data: {
            cash: initialCash,
            initialCash,
            totalAssetValue: initialCash
          }
        });

        return {
          seasonId: id,
          resetMode: "SEED_CATALOG_ONLY",
          usersReset: users.count,
          ...cleared,
          ...catalog
        };
      },
      {
        maxWait: 10_000,
        timeout: 60_000
      }
    );

    await this.rankingsService.recalculateAll(id);
    return result;
  }

  private loadSeedData(): SeedData {
    const localPath = join(process.cwd(), "prisma", "seed-data.local.json");
    const examplePath = join(process.cwd(), "prisma", "seed-data.example.json");
    const path = existsSync(localPath) ? localPath : examplePath;
    const seedData = JSON.parse(readFileSync(path, "utf8")) as SeedData;
    if (!seedData.markets?.length) {
      throw new BadRequestException("Seed data must include at least one market.");
    }
    return seedData;
  }

  private async clearSimulationDataInTx(tx: Tx) {
    const holdings = await tx.holding.deleteMany();
    const conditionalOrders = await tx.conditionalOrder.deleteMany();
    const watchlistItems = await tx.watchlist.deleteMany();
    const trades = await tx.trade.deleteMany();
    const dividends = await tx.dividend.deleteMany();
    const rankings = await tx.ranking.deleteMany();
    const scenarioImpacts = await tx.scenarioImpact.deleteMany();
    const scenarios = await tx.scenario.deleteMany();
    const priceHistories = await tx.priceHistory.deleteMany();

    return {
      holdingsCleared: holdings.count,
      conditionalOrdersCleared: conditionalOrders.count,
      watchlistItemsCleared: watchlistItems.count,
      tradesCleared: trades.count,
      dividendsCleared: dividends.count,
      rankingsCleared: rankings.count,
      scenarioImpactsCleared: scenarioImpacts.count,
      scenariosCleared: scenarios.count,
      priceHistoriesCleared: priceHistories.count
    };
  }

  private async resetCatalogFromSeedInTx(tx: Tx, seedData: SeedData) {
    const seedMarketNames = seedData.markets.map((market) => market.name);
    const stockDeleteFilters: Prisma.StockWhereInput[] = [
      { market: { name: { notIn: seedMarketNames } } },
      ...seedData.markets.map((market) => ({
        market: { name: market.name },
        name: { notIn: (market.stocks ?? []).map((stock) => stock.name) }
      }))
    ];

    const nonSeedStocks = await tx.stock.deleteMany({
      where: { OR: stockDeleteFilters }
    });
    const nonSeedMarkets = await tx.market.deleteMany({
      where: { name: { notIn: seedMarketNames } }
    });

    let seedMarketsApplied = 0;
    let seedStocksApplied = 0;
    let seedPriceHistoriesCreated = 0;
    const seedMarketIds: string[] = [];

    for (const [index, marketSeed] of seedData.markets.entries()) {
      const market = await tx.market.upsert({
        where: { name: marketSeed.name },
        update: {
          description: marketSeed.description,
          iconUrl: marketSeed.iconUrl,
          sortOrder: marketSeed.sortOrder ?? index,
          isActive: marketSeed.isActive ?? true
        },
        create: {
          name: marketSeed.name,
          description: marketSeed.description,
          iconUrl: marketSeed.iconUrl,
          sortOrder: marketSeed.sortOrder ?? index,
          isActive: marketSeed.isActive ?? true
        }
      });
      seedMarketsApplied += 1;
      seedMarketIds.push(market.id);

      for (const stockSeed of marketSeed.stocks ?? []) {
        const stock = await this.upsertSeedStockInTx(tx, market.id, stockSeed);
        seedStocksApplied += 1;
        const history = this.buildDemoPriceHistory(
          stock.id,
          stockSeed.name,
          new Prisma.Decimal(stockSeed.currentPrice),
          new Prisma.Decimal(stockSeed.previousPrice ?? stockSeed.currentPrice)
        );
        await tx.priceHistory.createMany({ data: history });
        seedPriceHistoriesCreated += history.length;
      }
    }

    await this.clearDeletedMarketPreferencesInTx(tx, seedMarketIds);

    return {
      nonSeedStocksDeleted: nonSeedStocks.count,
      nonSeedMarketsDeleted: nonSeedMarkets.count,
      seedMarketsApplied,
      seedStocksApplied,
      seedPriceHistoriesCreated
    };
  }

  private async upsertSeedStockInTx(tx: Tx, marketId: string, stockSeed: SeedStock) {
    const currentPrice = new Prisma.Decimal(stockSeed.currentPrice);
    const previousPrice = new Prisma.Decimal(stockSeed.previousPrice ?? stockSeed.currentPrice);
    const initialPrice = new Prisma.Decimal(stockSeed.initialPrice ?? stockSeed.previousPrice ?? stockSeed.currentPrice);
    const circulatingSupply = stockSeed.circulatingSupply ?? stockSeed.totalSupply;

    return tx.stock.upsert({
      where: {
        marketId_name: {
          marketId,
          name: stockSeed.name
        }
      },
      update: {
        description: stockSeed.description,
        imageUrl: stockSeed.imageUrl,
        tags: stockSeed.tags ?? [],
        currentPrice,
        previousPrice,
        initialPrice,
        targetPrice: null,
        movementStartPrice: null,
        movementStartedAt: null,
        movementEndsAt: null,
        movementReason: null,
        lastPriceHistoryAt: null,
        totalSupply: stockSeed.totalSupply,
        circulatingSupply,
        volatilityLevel: stockSeed.volatilityLevel ?? 5,
        dividendEnabled: stockSeed.dividendEnabled ?? false,
        baseDividendRate: new Prisma.Decimal(stockSeed.baseDividendRate ?? 0),
        isListed: stockSeed.isListed ?? true,
        isTradingSuspended: false,
        delistedAt: null
      },
      create: {
        marketId,
        name: stockSeed.name,
        description: stockSeed.description,
        imageUrl: stockSeed.imageUrl,
        tags: stockSeed.tags ?? [],
        currentPrice,
        previousPrice,
        initialPrice,
        totalSupply: stockSeed.totalSupply,
        circulatingSupply,
        volatilityLevel: stockSeed.volatilityLevel ?? 5,
        dividendEnabled: stockSeed.dividendEnabled ?? false,
        baseDividendRate: new Prisma.Decimal(stockSeed.baseDividendRate ?? 0),
        isListed: stockSeed.isListed ?? true
      }
    });
  }

  private async clearDeletedMarketPreferencesInTx(tx: Tx, seedMarketIds: string[]) {
    const aiAccounts = await tx.aiAccount.findMany({
      select: { id: true, preferredMarketIds: true }
    });

    for (const account of aiAccounts) {
      const preferredMarketIds = account.preferredMarketIds.filter((marketId) => seedMarketIds.includes(marketId));
      if (preferredMarketIds.length !== account.preferredMarketIds.length) {
        await tx.aiAccount.update({
          where: { id: account.id },
          data: { preferredMarketIds }
        });
      }
    }
  }

  private buildDemoPriceHistory(
    stockId: string,
    stockName: string,
    currentPrice: Prisma.Decimal,
    previousPrice: Prisma.Decimal
  ) {
    const now = Date.now();
    const points: Array<{ createdAt: Date; price: Prisma.Decimal; reason: string }> = [];

    for (let i = 29; i >= 1; i -= 1) {
      points.push({
        createdAt: new Date(now - i * 24 * 60 * 60 * 1000),
        price: this.demoPrice(stockName, currentPrice, 30 - i, 0.82, 1.1),
        reason: "SEED_DAILY"
      });
    }

    for (let i = 23; i >= 1; i -= 1) {
      points.push({
        createdAt: new Date(now - i * 60 * 60 * 1000),
        price: this.demoPrice(stockName, currentPrice, 80 - i, 0.94, 1.04),
        reason: "SEED_HOURLY"
      });
    }

    for (let i = 59; i >= 1; i -= 1) {
      points.push({
        createdAt: new Date(now - i * 60 * 1000),
        price: this.demoPrice(stockName, currentPrice, 140 - i, 0.985, 1.015),
        reason: "SEED_MINUTE"
      });
    }

    points.push({
      createdAt: new Date(now - 30_000),
      price: previousPrice,
      reason: "SEED_PREVIOUS"
    });
    points.push({
      createdAt: new Date(now),
      price: currentPrice,
      reason: "SEED_CURRENT"
    });

    let lastPrice = points[0]?.price ?? currentPrice;
    return points.map((point) => {
      const changeRate = lastPrice.equals(0)
        ? new Prisma.Decimal(0)
        : point.price.minus(lastPrice).div(lastPrice).mul(100);
      lastPrice = point.price;
      return {
        stockId,
        price: point.price,
        changeRate,
        reason: point.reason,
        createdAt: point.createdAt
      };
    });
  }

  private demoPrice(stockName: string, basePrice: Prisma.Decimal, index: number, minFactor: number, maxFactor: number) {
    const seed = [...stockName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const wave = Math.sin((seed + index * 17) / 9);
    const factor = minFactor + ((wave + 1) / 2) * (maxFactor - minFactor);
    return new Prisma.Decimal(Math.max(1, Math.round(basePrice.toNumber() * factor)));
  }
}
