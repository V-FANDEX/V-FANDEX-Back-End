import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { money, rate } from "../common/utils/decimal";
import { ConditionalOrderExecutionResult } from "../scenarios/scenarios.service";
import { ConditionalOrdersService } from "../conditional-orders/conditional-orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { UpdateMarketSimulationSettingsDto } from "./dto/update-market-simulation-settings.dto";

interface RunSimulationOptions {
  force?: boolean;
}

export interface SimulatedStockResult {
  stockId: string;
  stockName: string;
  beforePrice: Prisma.Decimal;
  afterPrice: Prisma.Decimal;
  appliedRate: Prisma.Decimal;
  mode: "NORMAL" | "EXTREME";
  reason: string;
}

@Injectable()
export class MarketSimulationService {
  private readonly logger = new Logger(MarketSimulationService.name);
  private isRunning = false;

  constructor(
    private readonly conditionalOrdersService: ConditionalOrdersService,
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService,
  ) {}

  getSettings() {
    return this.prisma.marketSimulationSetting.upsert({
      where: { id: "default" },
      create: {},
      update: {},
    });
  }

  async updateSettings(dto: UpdateMarketSimulationSettingsDto) {
    const current = await this.getSettings();
    this.assertValidRanges(dto, current);

    const nextRunAt = this.resolveNextRunAt(dto, current);
    return this.prisma.marketSimulationSetting.upsert({
      where: { id: "default" },
      create: {
        isEnabled: dto.isEnabled,
        intervalMinutes: dto.intervalMinutes,
        randomIntervalEnabled: dto.randomIntervalEnabled,
        minIntervalMinutes: dto.minIntervalMinutes,
        maxIntervalMinutes: dto.maxIntervalMinutes,
        minChangeRate:
          dto.minChangeRate === undefined ? undefined : rate(dto.minChangeRate),
        maxChangeRate:
          dto.maxChangeRate === undefined ? undefined : rate(dto.maxChangeRate),
        extremeMinRate:
          dto.extremeMinRate === undefined
            ? undefined
            : rate(dto.extremeMinRate),
        extremeMaxRate:
          dto.extremeMaxRate === undefined
            ? undefined
            : rate(dto.extremeMaxRate),
        extremeChance:
          dto.extremeChance === undefined ? undefined : rate(dto.extremeChance),
        volatilityWeight:
          dto.volatilityWeight === undefined
            ? undefined
            : rate(dto.volatilityWeight),
        targetStockCount: dto.targetStockCount,
        nextRunAt,
      },
      update: {
        isEnabled: dto.isEnabled,
        intervalMinutes: dto.intervalMinutes,
        randomIntervalEnabled: dto.randomIntervalEnabled,
        minIntervalMinutes: dto.minIntervalMinutes,
        maxIntervalMinutes: dto.maxIntervalMinutes,
        minChangeRate:
          dto.minChangeRate === undefined ? undefined : rate(dto.minChangeRate),
        maxChangeRate:
          dto.maxChangeRate === undefined ? undefined : rate(dto.maxChangeRate),
        extremeMinRate:
          dto.extremeMinRate === undefined
            ? undefined
            : rate(dto.extremeMinRate),
        extremeMaxRate:
          dto.extremeMaxRate === undefined
            ? undefined
            : rate(dto.extremeMaxRate),
        extremeChance:
          dto.extremeChance === undefined ? undefined : rate(dto.extremeChance),
        volatilityWeight:
          dto.volatilityWeight === undefined
            ? undefined
            : rate(dto.volatilityWeight),
        targetStockCount: dto.targetStockCount,
        nextRunAt,
      },
    });
  }

  async runSimulation(options: RunSimulationOptions = {}) {
    if (this.isRunning) {
      return null;
    }

    const settings = await this.getSettings();
    if (!options.force && !settings.isEnabled) {
      return null;
    }

    const now = new Date();
    if (!options.force && settings.nextRunAt && settings.nextRunAt > now) {
      return null;
    }

    this.isRunning = true;
    try {
      const stocks = await this.pickTargetStocks(settings.targetStockCount);
      if (!stocks.length) {
        const schedule = this.nextRunSchedule(settings);
        await this.prisma.marketSimulationSetting.update({
          where: { id: "default" },
          data: { lastRunAt: now, nextRunAt: schedule.nextRunAt },
        });

        return {
          ok: true,
          mode: options.force ? "MANUAL" : "SCHEDULED",
          affectedCount: 0,
          affectedStocks: [],
          conditionalOrderResults: [],
          ...schedule,
        };
      }

      const affectedStocks: SimulatedStockResult[] = [];
      const conditionalOrderResults: ConditionalOrderExecutionResult[] = [];

      await this.prisma.$transaction(
        async (tx) => {
          for (const stock of stocks) {
            const simulation = this.calculateStockMove(stock, settings);
            const oldPrice = money(stock.currentPrice);
            const multiplier = new Prisma.Decimal(1).plus(
              simulation.changeRate.div(100),
            );
            const newPrice = money(
              Prisma.Decimal.max(oldPrice.mul(multiplier), 1),
            );

            await tx.stock.update({
              where: { id: stock.id },
              data: {
                previousPrice: oldPrice,
                currentPrice: newPrice,
              },
            });

            await tx.priceHistory.create({
              data: {
                stockId: stock.id,
                price: newPrice,
                changeRate: simulation.changeRate,
                reason: `SIMULATION:${simulation.mode}`,
              },
            });

            const orderResult =
              await this.conditionalOrdersService.processForStockInTx(
                tx,
                stock.id,
                newPrice,
              );
            conditionalOrderResults.push(...orderResult.results);
            affectedStocks.push({
              stockId: stock.id,
              stockName: stock.name,
              beforePrice: oldPrice,
              afterPrice: newPrice,
              appliedRate: simulation.changeRate,
              mode: simulation.mode,
              reason: `SIMULATION_${simulation.mode}`,
            });
          }
        },
        {
          maxWait: 10_000,
          timeout: 60_000,
        },
      );

      await this.rankingsService.recalculateAll();

      const completedAt = new Date();
      const schedule = this.nextRunSchedule(settings, completedAt);
      await this.prisma.marketSimulationSetting.update({
        where: { id: "default" },
        data: {
          lastRunAt: completedAt,
          nextRunAt: schedule.nextRunAt,
        },
      });

      return {
        ok: true,
        mode: options.force ? "MANUAL" : "SCHEDULED",
        affectedCount: affectedStocks.length,
        affectedStocks,
        conditionalOrderResults,
        ...schedule,
      };
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Market simulation failed.",
      );
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async pickTargetStocks(targetStockCount: number | null) {
    const stocks = await this.prisma.stock.findMany({
      where: {
        isListed: true,
        isTradingSuspended: false,
        currentPrice: { gt: 0 },
      },
      orderBy: { updatedAt: "asc" },
    });

    if (!targetStockCount || targetStockCount >= stocks.length) {
      return stocks;
    }

    return this.shuffle(stocks).slice(0, targetStockCount);
  }

  private calculateStockMove(
    stock: { volatilityLevel: number },
    settings: {
      minChangeRate: Prisma.Decimal;
      maxChangeRate: Prisma.Decimal;
      extremeMinRate: Prisma.Decimal;
      extremeMaxRate: Prisma.Decimal;
      extremeChance: Prisma.Decimal;
      volatilityWeight: Prisma.Decimal;
    },
  ) {
    const isExtreme = Math.random() < settings.extremeChance.toNumber();
    const min = isExtreme
      ? settings.extremeMinRate.toNumber()
      : settings.minChangeRate.toNumber();
    const max = isExtreme
      ? settings.extremeMaxRate.toNumber()
      : settings.maxChangeRate.toNumber();
    const base = min + Math.random() * (max - min);
    const volatilityFactor =
      1 +
      ((stock.volatilityLevel - 5) / 10) * settings.volatilityWeight.toNumber();
    const adjusted = Math.max(-95, base * Math.max(0.05, volatilityFactor));

    return {
      mode: isExtreme ? ("EXTREME" as const) : ("NORMAL" as const),
      changeRate: rate(adjusted),
    };
  }

  private assertValidRanges(
    dto: UpdateMarketSimulationSettingsDto,
    current: Awaited<ReturnType<MarketSimulationService["getSettings"]>>,
  ) {
    const minChangeRate = dto.minChangeRate ?? current.minChangeRate.toNumber();
    const maxChangeRate = dto.maxChangeRate ?? current.maxChangeRate.toNumber();
    const extremeMinRate =
      dto.extremeMinRate ?? current.extremeMinRate.toNumber();
    const extremeMaxRate =
      dto.extremeMaxRate ?? current.extremeMaxRate.toNumber();
    const minIntervalMinutes =
      dto.minIntervalMinutes ?? current.minIntervalMinutes;
    const maxIntervalMinutes =
      dto.maxIntervalMinutes ?? current.maxIntervalMinutes;

    if (minChangeRate > maxChangeRate) {
      throw new BadRequestException(
        "minChangeRate cannot be greater than maxChangeRate.",
      );
    }

    if (extremeMinRate > extremeMaxRate) {
      throw new BadRequestException(
        "extremeMinRate cannot be greater than extremeMaxRate.",
      );
    }

    if (minIntervalMinutes > maxIntervalMinutes) {
      throw new BadRequestException(
        "minIntervalMinutes cannot be greater than maxIntervalMinutes.",
      );
    }
  }

  private resolveNextRunAt(
    dto: UpdateMarketSimulationSettingsDto,
    current: Awaited<ReturnType<MarketSimulationService["getSettings"]>>,
  ) {
    if (dto.nextRunAt) {
      return new Date(dto.nextRunAt);
    }

    if (dto.isEnabled && !current.isEnabled) {
      return new Date();
    }

    if ((dto.isEnabled ?? current.isEnabled) && !current.nextRunAt) {
      return new Date();
    }

    const scheduleChanged =
      dto.intervalMinutes !== undefined ||
      dto.randomIntervalEnabled !== undefined ||
      dto.minIntervalMinutes !== undefined ||
      dto.maxIntervalMinutes !== undefined;

    if (scheduleChanged && current.nextRunAt) {
      const lastRunAt = current.lastRunAt ?? new Date();
      return this.nextRunSchedule(
        {
          intervalMinutes: dto.intervalMinutes ?? current.intervalMinutes,
          randomIntervalEnabled:
            dto.randomIntervalEnabled ?? current.randomIntervalEnabled,
          minIntervalMinutes:
            dto.minIntervalMinutes ?? current.minIntervalMinutes,
          maxIntervalMinutes:
            dto.maxIntervalMinutes ?? current.maxIntervalMinutes,
        },
        lastRunAt,
      ).nextRunAt;
    }

    return undefined;
  }

  private nextRunSchedule(
    settings: {
      intervalMinutes: number;
      randomIntervalEnabled: boolean;
      minIntervalMinutes: number;
      maxIntervalMinutes: number;
    },
    from = new Date(),
  ) {
    const scheduledIntervalMinutes = settings.randomIntervalEnabled
      ? this.randomInteger(
          settings.minIntervalMinutes,
          settings.maxIntervalMinutes,
        )
      : settings.intervalMinutes;

    return {
      nextRunAt: new Date(from.getTime() + scheduledIntervalMinutes * 60_000),
      scheduledIntervalMinutes,
    };
  }

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private shuffle<T>(items: T[]) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }
}
