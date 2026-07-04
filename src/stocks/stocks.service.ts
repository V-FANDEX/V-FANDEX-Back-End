import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { money, rate } from "../common/utils/decimal";
import { CreateStockDto } from "./dto/create-stock.dto";
import { UpdateListingStatusDto } from "./dto/update-listing-status.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";

@Injectable()
export class StocksService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { marketId?: string; includeUnlisted?: boolean; search?: string }) {
    return this.prisma.stock.findMany({
      where: {
        marketId: params.marketId,
        isListed: params.includeUnlisted ? undefined : true,
        name: params.search ? { contains: params.search, mode: "insensitive" } : undefined
      },
      include: { market: true },
      orderBy: { createdAt: "desc" }
    });
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

    return stock;
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
      return await this.prisma.stock.create({
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

    return this.prisma.stock.update({
      where: { id },
      data,
      include: { market: true }
    });
  }

  async updateListingStatus(id: string, dto: UpdateListingStatusDto) {
    await this.ensureExists(id);
    return this.prisma.stock.update({
      where: { id },
      data: {
        isListed: dto.isListed,
        isTradingSuspended: dto.isTradingSuspended,
        delistedAt: dto.isListed ? null : new Date()
      }
    });
  }

  async chartData(id: string, take = 200) {
    await this.ensureExists(id);
    return this.prisma.priceHistory.findMany({
      where: { stockId: id },
      orderBy: { createdAt: "asc" },
      take
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.stock.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Stock not found.");
    }
  }
}
