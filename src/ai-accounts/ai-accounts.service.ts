import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiStrategyType, OrderType, Prisma, Role } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { TradingService } from "../trading/trading.service";
import { CreateAiAccountDto } from "./dto/create-ai-account.dto";
import { UpdateAiAccountDto } from "./dto/update-ai-account.dto";

@Injectable()
export class AiAccountsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tradingService: TradingService
  ) {}

  list() {
    return this.prisma.aiAccount.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(dto: CreateAiAccountDto) {
    const initialCash = money(dto.initialCash ?? Number(this.config.get<string>("DEFAULT_INITIAL_CASH") ?? 1000000));

    try {
      return await this.prisma.user.create({
        data: {
          email: null,
          passwordHash: null,
          nickname: dto.nickname,
          role: Role.AI,
          cash: initialCash,
          initialCash,
          totalAssetValue: initialCash,
          aiAccount: {
            create: {
              strategyType: dto.strategyType,
              preferredMarketIds: dto.preferredMarketIds ?? [],
              riskLevel: dto.riskLevel,
              isActive: true
            }
          }
        },
        include: { aiAccount: true }
      });
    } catch {
      throw new BadRequestException("AI nickname is already in use.");
    }
  }

  async update(id: string, dto: UpdateAiAccountDto) {
    const aiAccount = await this.ensureExists(id);
    return this.prisma.aiAccount.update({
      where: { id },
      data: {
        strategyType: dto.strategyType,
        preferredMarketIds: dto.preferredMarketIds,
        riskLevel: dto.riskLevel,
        user: dto.nickname
          ? {
              update: {
                nickname: dto.nickname
              }
            }
          : undefined
      },
      include: { user: true }
    });
  }

  async deactivate(id: string) {
    const aiAccount = await this.ensureExists(id);
    await this.prisma.user.update({
      where: { id: aiAccount.userId },
      data: { isActive: false }
    });
    return this.prisma.aiAccount.update({
      where: { id },
      data: { isActive: false },
      include: { user: true }
    });
  }

  async runTrade(id: string) {
    const aiAccount = await this.prisma.aiAccount.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            holdings: {
              where: { quantity: { gt: 0 } },
              include: { stock: true }
            }
          }
        }
      }
    });

    if (!aiAccount || !aiAccount.isActive || !aiAccount.user.isActive) {
      throw new NotFoundException("Active AI account not found.");
    }

    const sellCandidate = this.pickSellCandidate(aiAccount.user.holdings);
    const buyCandidate = await this.pickBuyCandidate(aiAccount.strategyType, aiAccount.preferredMarketIds);
    const shouldSell = sellCandidate && (aiAccount.strategyType === AiStrategyType.STABLE || Math.random() < 0.35);

    if (shouldSell && sellCandidate) {
      const quantity = Math.max(1, Math.floor(sellCandidate.quantity * Math.min(aiAccount.riskLevel / 10, 0.5)));
      return this.tradingService.sell(aiAccount.userId, {
        stockId: sellCandidate.stockId,
        quantity,
        orderType: OrderType.MARKET
      });
    }

    if (!buyCandidate) {
      throw new BadRequestException("No tradable stock candidate found.");
    }

    const maxSpend = aiAccount.user.cash.mul(aiAccount.riskLevel / 10).mul(0.25);
    const quantity = Math.floor(maxSpend.div(buyCandidate.currentPrice).toNumber());
    if (quantity < 1) {
      if (sellCandidate) {
        return this.tradingService.sell(aiAccount.userId, {
          stockId: sellCandidate.stockId,
          quantity: 1,
          orderType: OrderType.MARKET
        });
      }

      throw new BadRequestException("AI account does not have enough cash to trade.");
    }

    return this.tradingService.buy(aiAccount.userId, {
      stockId: buyCandidate.id,
      quantity,
      orderType: OrderType.MARKET
    });
  }

  private async pickBuyCandidate(strategy: AiStrategyType, preferredMarketIds: string[]) {
    const where: Prisma.StockWhereInput = {
      isListed: true,
      isTradingSuspended: false,
      marketId: preferredMarketIds.length ? { in: preferredMarketIds } : undefined
    };

    const stocks = await this.prisma.stock.findMany({ where, take: 50 });
    if (!stocks.length) {
      return null;
    }

    if (strategy === AiStrategyType.AGGRESSIVE) {
      return stocks.sort((a, b) => b.volatilityLevel - a.volatilityLevel)[0];
    }
    if (strategy === AiStrategyType.STABLE) {
      return stocks.sort((a, b) => a.volatilityLevel - b.volatilityLevel)[0];
    }

    return stocks[Math.floor(Math.random() * stocks.length)];
  }

  private pickSellCandidate(
    holdings: Array<{
      stockId: string;
      quantity: number;
      stock: { currentPrice: Prisma.Decimal };
    }>
  ) {
    if (!holdings.length) {
      return null;
    }

    return holdings[Math.floor(Math.random() * holdings.length)];
  }

  private async ensureExists(id: string) {
    const aiAccount = await this.prisma.aiAccount.findUnique({ where: { id } });
    if (!aiAccount) {
      throw new NotFoundException("AI account not found.");
    }
    return aiAccount;
  }
}
