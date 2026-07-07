import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  ScenarioCreatedBy,
  ScenarioSentiment,
  ScenarioType,
  Stock
} from "@prisma/client";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AiAccountsService } from "../ai-accounts/ai-accounts.service";
import { money, rate } from "../common/utils/decimal";
import { ConditionalOrdersService } from "../conditional-orders/conditional-orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { GenerateScenarioDto } from "./dto/generate-scenario.dto";

const ScenarioAiOutput = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(2000),
  affectedMarketIds: z.array(z.string()),
  affectedStockIds: z.array(z.string()),
  sentiment: z.enum(["POSITIVE", "NEGATIVE", "MIXED", "NEUTRAL"]),
  impactLevel: z.number().int().min(1).max(10)
});

type ScenarioAiOutput = z.infer<typeof ScenarioAiOutput>;

@Injectable()
export class ScenariosService {
  constructor(
    private readonly aiAccountsService: AiAccountsService,
    private readonly config: ConfigService,
    private readonly conditionalOrdersService: ConditionalOrdersService,
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  list() {
    return this.prisma.scenario.findMany({
      orderBy: { createdAt: "desc" },
      include: { impacts: { include: { stock: true } } }
    });
  }

  async get(id: string) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id },
      include: { impacts: { include: { stock: { include: { market: true } } } } }
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found.");
    }

    return scenario;
  }

  async generate(type: ScenarioType, dto: GenerateScenarioDto) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new BadRequestException("OPENAI_API_KEY is not configured.");
    }

    const model = this.modelFor(type);
    const client = new OpenAI({ apiKey });
    const context = await this.buildScenarioContext(dto);
    const response = await client.responses.parse({
      model,
      input: [
        {
          role: "system",
          content:
            "You create Korean virtual stock market scenarios for fandom and entertainment content. Return only the requested structured scenario. Do not calculate exact price changes."
        },
        {
          role: "user",
          content: JSON.stringify({
            scenarioType: type,
            instruction:
              "Generate a market scenario with narrative text, affected market/stock ids, sentiment, and impact level from 1 to 10. Do not include numeric price change values.",
            prompt: dto.prompt ?? null,
            candidates: context
          })
        }
      ],
      text: {
        format: zodTextFormat(ScenarioAiOutput, "v_fandex_scenario")
      }
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new BadRequestException("OpenAI did not return a parseable scenario.");
    }

    const normalized = this.normalizeAiOutput(parsed, dto);
    return this.prisma.scenario.create({
      data: {
        type,
        title: normalized.title,
        content: normalized.content,
        affectedMarketIds: normalized.affectedMarketIds,
        affectedStockIds: normalized.affectedStockIds,
        sentiment: normalized.sentiment,
        impactLevel: normalized.impactLevel,
        createdBy: ScenarioCreatedBy.ADMIN,
        rawAiResponse: {
          model,
          output: normalized
        }
      }
    });
  }

  async apply(id: string) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new NotFoundException("Scenario not found.");
    }
    if (scenario.appliedAt) {
      throw new BadRequestException("Scenario has already been applied.");
    }

    const targetStocks = await this.resolveTargetStocks(scenario);
    if (!targetStocks.length) {
      throw new BadRequestException("No target stocks found for scenario.");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const stock of targetStocks) {
        const changeRate = this.calculateChangeRate(scenario.type, scenario.sentiment, scenario.impactLevel, stock);
        const oldPrice = money(stock.currentPrice);
        const multiplier = new Prisma.Decimal(1).plus(changeRate.div(100));
        const newPrice = money(Prisma.Decimal.max(oldPrice.mul(multiplier), 1));

        await tx.stock.update({
          where: { id: stock.id },
          data: {
            previousPrice: oldPrice,
            currentPrice: newPrice
          }
        });

        await tx.scenarioImpact.create({
          data: {
            scenarioId: scenario.id,
            stockId: stock.id,
            oldPrice,
            newPrice,
            changeRate,
            impactReason: `${scenario.type}_${scenario.sentiment}_IMPACT`
          }
        });

        await tx.priceHistory.create({
          data: {
            stockId: stock.id,
            price: newPrice,
            changeRate,
            reason: `SCENARIO:${scenario.id}`
          }
        });

        await this.conditionalOrdersService.processForStockInTx(tx, stock.id, newPrice);
      }

      await tx.scenario.update({
        where: { id: scenario.id },
        data: { appliedAt: new Date() }
      });
    });

    const aiTradeSummary = await this.aiAccountsService.runScenarioTrades(scenario.id);
    await this.rankingsService.recalculateAll();
    const appliedScenario = await this.get(id);
    return { ...appliedScenario, aiTradeSummary };
  }

  private async buildScenarioContext(dto: GenerateScenarioDto) {
    const [markets, stocks] = await Promise.all([
      this.prisma.market.findMany({
        where: { id: dto.affectedMarketIds ? { in: dto.affectedMarketIds } : undefined, isActive: true },
        select: { id: true, name: true, description: true }
      }),
      this.prisma.stock.findMany({
        where: {
          id: dto.affectedStockIds ? { in: dto.affectedStockIds } : undefined,
          marketId: dto.affectedMarketIds ? { in: dto.affectedMarketIds } : undefined,
          isListed: true
        },
        select: { id: true, marketId: true, name: true, tags: true, volatilityLevel: true },
        take: 100
      })
    ]);

    return { markets, stocks };
  }

  private normalizeAiOutput(parsed: ScenarioAiOutput, dto: GenerateScenarioDto) {
    return {
      ...parsed,
      affectedMarketIds: dto.affectedMarketIds?.length ? dto.affectedMarketIds : parsed.affectedMarketIds,
      affectedStockIds: dto.affectedStockIds?.length ? dto.affectedStockIds : parsed.affectedStockIds,
      sentiment: parsed.sentiment as ScenarioSentiment,
      impactLevel: Math.min(Math.max(parsed.impactLevel, 1), 10)
    };
  }

  private async resolveTargetStocks(scenario: {
    affectedMarketIds: string[];
    affectedStockIds: string[];
  }) {
    if (!scenario.affectedStockIds.length && !scenario.affectedMarketIds.length) {
      return this.prisma.stock.findMany({
        where: {
          isListed: true,
          isTradingSuspended: false
        }
      });
    }

    return this.prisma.stock.findMany({
      where: {
        isListed: true,
        isTradingSuspended: false,
        OR: [
          scenario.affectedStockIds.length ? { id: { in: scenario.affectedStockIds } } : undefined,
          scenario.affectedMarketIds.length ? { marketId: { in: scenario.affectedMarketIds } } : undefined
        ].filter(Boolean) as Prisma.StockWhereInput[]
      }
    });
  }

  private modelFor(type: ScenarioType) {
    if (type === ScenarioType.SMALL) {
      return this.config.get<string>("OPENAI_SMALL_MODEL") ?? "gpt-5.4-mini";
    }

    if (type === ScenarioType.BIG) {
      return this.config.get<string>("OPENAI_BIG_MODEL") ?? "gpt-5.5";
    }

    return this.config.get<string>("OPENAI_MAIN_MODEL") ?? "gpt-5.5";
  }

  private calculateChangeRate(
    type: ScenarioType,
    sentiment: ScenarioSentiment,
    impactLevel: number,
    stock: Pick<Stock, "volatilityLevel">
  ) {
    const range = this.rangeFor(type);
    const volatilityFactor = 0.6 + stock.volatilityLevel / 10;
    const impactFactor = impactLevel / 10;
    const noiseFactor = 0.85 + Math.random() * 0.3;
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max));
    const magnitude = Math.min(maxAbs, maxAbs * impactFactor * volatilityFactor * noiseFactor);
    const sign = this.signFor(sentiment);

    if (sign === 0) {
      return rate((Math.random() - 0.5) * Math.min(maxAbs * 0.2, 2));
    }

    const signed = sign * magnitude;
    return rate(Math.min(Math.max(signed, range.min), range.max));
  }

  private signFor(sentiment: ScenarioSentiment) {
    if (sentiment === ScenarioSentiment.POSITIVE) {
      return 1;
    }
    if (sentiment === ScenarioSentiment.NEGATIVE) {
      return -1;
    }
    if (sentiment === ScenarioSentiment.MIXED) {
      return Math.random() > 0.5 ? 1 : -1;
    }
    return 0;
  }

  private rangeFor(type: ScenarioType) {
    const prefix = type === ScenarioType.SMALL ? "SMALL" : type === ScenarioType.BIG ? "BIG" : "MAIN";
    return {
      min: Number(this.config.get<string>(`SCENARIO_${prefix}_MIN_CHANGE`) ?? this.defaultRange(type).min),
      max: Number(this.config.get<string>(`SCENARIO_${prefix}_MAX_CHANGE`) ?? this.defaultRange(type).max)
    };
  }

  private defaultRange(type: ScenarioType) {
    if (type === ScenarioType.SMALL) {
      return { min: "-3", max: "3" };
    }
    if (type === ScenarioType.BIG) {
      return { min: "-20", max: "20" };
    }
    return { min: "-8", max: "8" };
  }
}
