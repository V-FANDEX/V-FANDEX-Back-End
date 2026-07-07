import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiStrategyType, OrderType, Prisma, Role, ScenarioSentiment, TradeType } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { TradingService } from "../trading/trading.service";
import { CreateAiAccountDto } from "./dto/create-ai-account.dto";
import { UpdateAiAccountDto } from "./dto/update-ai-account.dto";

type AiAccountWithPortfolio = Prisma.AiAccountGetPayload<{
  include: {
    user: {
      include: {
        holdings: {
          include: {
            stock: true;
          };
        };
      };
    };
  };
}>;

type ScenarioWithImpacts = Prisma.ScenarioGetPayload<{
  include: {
    impacts: {
      include: {
        stock: true;
      };
    };
  };
}>;

type ScenarioImpactWithStock = ScenarioWithImpacts["impacts"][number];

interface AiTradeDecision {
  type: TradeType;
  stockId: string;
  quantity: number;
  reason: string;
}

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
    const buyCandidate = await this.pickBuyCandidate(aiAccount.strategyType);
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

  async runScenarioTrades(scenarioId: string) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        impacts: {
          include: { stock: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found.");
    }

    if (!scenario.impacts.length) {
      return {
        scenarioId,
        aiAccountCount: 0,
        results: []
      };
    }

    const aiAccounts = await this.prisma.aiAccount.findMany({
      where: {
        isActive: true,
        user: {
          isActive: true
        }
      },
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

    const results = [];
    for (const aiAccount of aiAccounts) {
      try {
        const decision = this.decideScenarioTrade(aiAccount, scenario);
        if (!decision) {
          results.push({
            aiAccountId: aiAccount.id,
            userId: aiAccount.userId,
            action: "SKIP",
            reason: "No useful scenario trade signal."
          });
          continue;
        }

        const trade =
          decision.type === TradeType.BUY
            ? await this.tradingService.buy(aiAccount.userId, {
                stockId: decision.stockId,
                quantity: decision.quantity,
                orderType: OrderType.MARKET
              })
            : await this.tradingService.sell(aiAccount.userId, {
                stockId: decision.stockId,
                quantity: decision.quantity,
                orderType: OrderType.MARKET
              });

        results.push({
          aiAccountId: aiAccount.id,
          userId: aiAccount.userId,
          action: decision.type,
          stockId: trade.stockId,
          quantity: trade.quantity,
          tradeId: trade.id,
          reason: decision.reason
        });
      } catch (error) {
        results.push({
          aiAccountId: aiAccount.id,
          userId: aiAccount.userId,
          action: "FAILED",
          reason: error instanceof Error ? error.message : "AI scenario trade failed."
        });
      }
    }

    return {
      scenarioId,
      aiAccountCount: aiAccounts.length,
      results
    };
  }

  private async pickBuyCandidate(strategy: AiStrategyType) {
    const where: Prisma.StockWhereInput = {
      isListed: true,
      isTradingSuspended: false
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

  private decideScenarioTrade(
    aiAccount: AiAccountWithPortfolio,
    scenario: ScenarioWithImpacts
  ): AiTradeDecision | null {
    const negativeHolding = this.pickScenarioSellCandidate(aiAccount, scenario);
    const positiveImpact = this.pickScenarioBuyCandidate(aiAccount.strategyType, scenario.impacts);

    if (scenario.sentiment === ScenarioSentiment.NEGATIVE) {
      return negativeHolding ? this.buildSellDecision(aiAccount, scenario, negativeHolding) : null;
    }

    if (scenario.sentiment === ScenarioSentiment.POSITIVE) {
      return positiveImpact ? this.buildBuyDecision(aiAccount, scenario, positiveImpact) : null;
    }

    if (scenario.sentiment === ScenarioSentiment.MIXED) {
      if (negativeHolding && (!positiveImpact || Math.random() < 0.5)) {
        return this.buildSellDecision(aiAccount, scenario, negativeHolding);
      }

      return positiveImpact ? this.buildBuyDecision(aiAccount, scenario, positiveImpact) : null;
    }

    if (negativeHolding && Math.random() < 0.25) {
      return this.buildSellDecision(aiAccount, scenario, negativeHolding);
    }

    if (positiveImpact && Math.random() < 0.25) {
      return this.buildBuyDecision(aiAccount, scenario, positiveImpact);
    }

    return null;
  }

  private pickScenarioBuyCandidate(strategy: AiStrategyType, impacts: ScenarioImpactWithStock[]) {
    const candidates = impacts.filter(
      (impact) =>
        impact.changeRate.greaterThan(0) &&
        impact.stock.isListed &&
        !impact.stock.isTradingSuspended &&
        impact.stock.currentPrice.greaterThan(0)
    );

    if (!candidates.length) {
      return null;
    }

    if (strategy === AiStrategyType.AGGRESSIVE) {
      return [...candidates].sort((a, b) => {
        const changeDiff = b.changeRate.minus(a.changeRate).toNumber();
        return changeDiff || b.stock.volatilityLevel - a.stock.volatilityLevel;
      })[0];
    }

    if (strategy === AiStrategyType.STABLE) {
      return [...candidates].sort((a, b) => {
        const volatilityDiff = a.stock.volatilityLevel - b.stock.volatilityLevel;
        return volatilityDiff || b.changeRate.minus(a.changeRate).toNumber();
      })[0];
    }

    if (strategy === AiStrategyType.MARKET_FOCUSED) {
      return [...candidates].sort((a, b) => b.changeRate.minus(a.changeRate).toNumber())[0];
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private pickScenarioSellCandidate(aiAccount: AiAccountWithPortfolio, scenario: ScenarioWithImpacts) {
    const impactByStockId = new Map(scenario.impacts.map((impact) => [impact.stockId, impact]));
    const candidates = aiAccount.user.holdings
      .map((holding) => {
        const impact = impactByStockId.get(holding.stockId);
        return impact ? { holding, impact } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .filter(
        ({ impact }) =>
          scenario.sentiment === ScenarioSentiment.NEGATIVE ||
          impact.changeRate.lessThan(0) ||
          impact.stock.currentPrice.lessThan(impact.oldPrice)
      );

    if (!candidates.length) {
      return null;
    }

    return [...candidates].sort((a, b) => {
      const changeDiff = a.impact.changeRate.minus(b.impact.changeRate).toNumber();
      return changeDiff || b.holding.quantity - a.holding.quantity;
    })[0];
  }

  private buildBuyDecision(
    aiAccount: AiAccountWithPortfolio,
    scenario: ScenarioWithImpacts,
    impact: ScenarioImpactWithStock
  ): AiTradeDecision | null {
    const cashRatio = this.buyCashRatio(aiAccount.strategyType);
    const impactFactor = 0.5 + scenario.impactLevel / 20;
    const maxSpend = aiAccount.user.cash.mul(aiAccount.riskLevel / 10).mul(cashRatio).mul(impactFactor);
    const quantity = Math.floor(maxSpend.div(impact.stock.currentPrice).toNumber());

    if (quantity < 1) {
      return null;
    }

    return {
      type: TradeType.BUY,
      stockId: impact.stockId,
      quantity,
      reason: `SCENARIO_${scenario.sentiment}_BUY`
    };
  }

  private buildSellDecision(
    aiAccount: AiAccountWithPortfolio,
    scenario: ScenarioWithImpacts,
    candidate: NonNullable<ReturnType<AiAccountsService["pickScenarioSellCandidate"]>>
  ): AiTradeDecision {
    const sellRatio = this.sellHoldingRatio(aiAccount.strategyType);
    const impactFactor = 0.5 + scenario.impactLevel / 20;
    const ratio = Math.min(0.8, sellRatio * (aiAccount.riskLevel / 10) * impactFactor);
    const quantity = Math.max(1, Math.min(candidate.holding.quantity, Math.floor(candidate.holding.quantity * ratio)));

    return {
      type: TradeType.SELL,
      stockId: candidate.holding.stockId,
      quantity,
      reason: `SCENARIO_${scenario.sentiment}_SELL`
    };
  }

  private buyCashRatio(strategy: AiStrategyType) {
    if (strategy === AiStrategyType.AGGRESSIVE) {
      return 0.35;
    }
    if (strategy === AiStrategyType.STABLE) {
      return 0.12;
    }
    if (strategy === AiStrategyType.MARKET_FOCUSED) {
      return 0.25;
    }
    return 0.2;
  }

  private sellHoldingRatio(strategy: AiStrategyType) {
    if (strategy === AiStrategyType.STABLE) {
      return 0.6;
    }
    if (strategy === AiStrategyType.AGGRESSIVE) {
      return 0.4;
    }
    if (strategy === AiStrategyType.MARKET_FOCUSED) {
      return 0.45;
    }
    return 0.35;
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
