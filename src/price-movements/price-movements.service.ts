import { Injectable, Logger } from "@nestjs/common";
import { Prisma, Stock } from "@prisma/client";
import { money, rate, zero } from "../common/utils/decimal";
import { ConditionalOrdersService } from "../conditional-orders/conditional-orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import type { ConditionalOrderExecutionResult } from "../scenarios/scenarios.service";
import { resolveMovementPrice } from "./price-movement.utils";

type Tx = Prisma.TransactionClient;

interface MovementSettings {
  priceMovementEnabled: boolean;
  priceTickSeconds: number;
  minMovementMinutes: number;
  maxMovementMinutes: number;
}

interface ScheduleTargetOptions {
  reason: string;
  durationMultiplier?: number;
  now?: Date;
}

export interface PriceMovementAffectedStockResult {
  stockId: string;
  stockName: string;
  beforePrice: Prisma.Decimal;
  afterPrice: Prisma.Decimal;
  targetPrice: Prisma.Decimal;
  reachedTarget: boolean;
  movementReason: string | null;
}

@Injectable()
export class PriceMovementsService {
  private readonly logger = new Logger(PriceMovementsService.name);
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

  resolveCurrentPrice(stock: Stock, at = new Date()) {
    return resolveMovementPrice(stock, at);
  }

  async scheduleTargetInTx(
    tx: Tx,
    stock: Stock,
    requestedTargetPrice: Prisma.Decimal,
    settings: MovementSettings,
    options: ScheduleTargetOptions,
  ) {
    const now = options.now ?? new Date();
    const storedPrice = money(stock.currentPrice);
    const currentPrice = this.resolveCurrentPrice(stock, now);
    const targetPrice = money(Prisma.Decimal.max(requestedTargetPrice, 1));
    const redirectChangeRate = this.changeRate(storedPrice, currentPrice);
    const priceWasSettled = !currentPrice.equals(storedPrice);

    if (!settings.priceMovementEnabled || targetPrice.equals(currentPrice)) {
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          previousPrice: storedPrice,
          currentPrice: targetPrice,
          targetPrice: null,
          movementStartPrice: null,
          movementStartedAt: null,
          movementEndsAt: null,
          movementReason: null,
          lastPriceHistoryAt: now,
        },
      });

      const immediateChangeRate = this.changeRate(storedPrice, targetPrice);
      if (!targetPrice.equals(storedPrice)) {
        await tx.priceHistory.create({
          data: {
            stockId: stock.id,
            price: targetPrice,
            changeRate: immediateChangeRate,
            reason: `PRICE_TARGET_IMMEDIATE:${options.reason}`,
          },
        });
      }

      const orderResult = await this.conditionalOrdersService.processForStockInTx(tx, stock.id, targetPrice);
      return {
        currentPrice,
        targetPrice,
        movementStartedAt: now,
        movementEndsAt: now,
        movementDurationMinutes: 0,
        conditionalOrderResults: orderResult.results,
        affectedUserIds: orderResult.affectedUserIds,
      };
    }

    const durationMultiplier = Math.max(options.durationMultiplier ?? 1, 0.1);
    const baseDurationMinutes = this.randomInteger(settings.minMovementMinutes, settings.maxMovementMinutes);
    const movementDurationMinutes = Math.max(1, Math.round(baseDurationMinutes * durationMultiplier));
    const movementEndsAt = new Date(now.getTime() + movementDurationMinutes * 60_000);

    await tx.stock.update({
      where: { id: stock.id },
      data: {
        previousPrice: currentPrice,
        currentPrice,
        targetPrice,
        movementStartPrice: currentPrice,
        movementStartedAt: now,
        movementEndsAt,
        movementReason: options.reason,
        lastPriceHistoryAt: priceWasSettled ? now : undefined,
      },
    });

    let conditionalOrderResults: ConditionalOrderExecutionResult[] = [];
    let affectedUserIds: string[] = [];
    if (priceWasSettled) {
      await tx.priceHistory.create({
        data: {
          stockId: stock.id,
          price: currentPrice,
          changeRate: redirectChangeRate,
          reason: `PRICE_MOVEMENT_REDIRECT:${options.reason}`,
        },
      });
      const orderResult = await this.conditionalOrdersService.processForStockInTx(tx, stock.id, currentPrice);
      conditionalOrderResults = orderResult.results;
      affectedUserIds = orderResult.affectedUserIds;
    }

    return {
      currentPrice,
      targetPrice,
      movementStartedAt: now,
      movementEndsAt,
      movementDurationMinutes,
      conditionalOrderResults,
      affectedUserIds,
    };
  }

  async processScheduledMovements(force = false) {
    if (this.isRunning) {
      return null;
    }

    const settings = await this.getSettings();
    const now = new Date();
    if (!force && settings.nextPriceTickAt && settings.nextPriceTickAt > now) {
      return null;
    }

    this.isRunning = true;
    try {
      const stocks = await this.prisma.stock.findMany({
        where: { targetPrice: { not: null } },
        orderBy: { movementEndsAt: "asc" },
      });
      const affectedStocks: PriceMovementAffectedStockResult[] = [];
      const conditionalOrderResults: ConditionalOrderExecutionResult[] = [];
      const affectedUserIds = new Set<string>();

      await this.prisma.$transaction(
        async (tx) => {
          for (const stock of stocks) {
            if (!stock.targetPrice) {
              continue;
            }

            const beforePrice = money(stock.currentPrice);
            const nextPrice = settings.priceMovementEnabled
              ? this.resolveCurrentPrice(stock, now)
              : money(stock.targetPrice);
            const reachedTarget =
              !settings.priceMovementEnabled ||
              !stock.movementEndsAt ||
              stock.movementEndsAt <= now ||
              nextPrice.equals(stock.targetPrice);
            const afterPrice = reachedTarget ? money(stock.targetPrice) : nextPrice;
            const priceChanged = !afterPrice.equals(beforePrice);
            const shouldRecordHistory =
              priceChanged &&
              (reachedTarget ||
                !stock.lastPriceHistoryAt ||
                now.getTime() - stock.lastPriceHistoryAt.getTime() >= 60_000);

            await tx.stock.update({
              where: { id: stock.id },
              data: {
                currentPrice: afterPrice,
                targetPrice: reachedTarget ? null : stock.targetPrice,
                movementStartPrice: reachedTarget ? null : undefined,
                movementStartedAt: reachedTarget ? null : undefined,
                movementEndsAt: reachedTarget ? null : undefined,
                movementReason: reachedTarget ? null : undefined,
                lastPriceHistoryAt: shouldRecordHistory ? now : undefined,
              },
            });

            if (shouldRecordHistory) {
              await tx.priceHistory.create({
                data: {
                  stockId: stock.id,
                  price: afterPrice,
                  changeRate: this.changeRate(beforePrice, afterPrice),
                  reason: reachedTarget
                    ? `PRICE_TARGET_REACHED:${stock.movementReason ?? "UNKNOWN"}`
                    : `PRICE_MOVEMENT:${stock.movementReason ?? "UNKNOWN"}`,
                },
              });
            }

            if (priceChanged) {
              const orderResult = await this.conditionalOrdersService.processForStockInTx(
                tx,
                stock.id,
                afterPrice,
              );
              conditionalOrderResults.push(...orderResult.results);
              orderResult.affectedUserIds.forEach((userId) => affectedUserIds.add(userId));
            }

            if (priceChanged || reachedTarget) {
              affectedStocks.push({
                stockId: stock.id,
                stockName: stock.name,
                beforePrice,
                afterPrice,
                targetPrice: stock.targetPrice,
                reachedTarget,
                movementReason: stock.movementReason,
              });
            }
          }
        },
        { maxWait: 10_000, timeout: 60_000 },
      );

      if (affectedStocks.length) {
        await this.rankingsService.recalculateAll();
      }

      const completedAt = new Date();
      const nextPriceTickAt = new Date(completedAt.getTime() + settings.priceTickSeconds * 1000);
      await this.prisma.marketSimulationSetting.update({
        where: { id: "default" },
        data: { lastPriceTickAt: completedAt, nextPriceTickAt },
      });

      return {
        ok: true,
        affectedCount: affectedStocks.length,
        reachedTargetCount: affectedStocks.filter((stock) => stock.reachedTarget).length,
        affectedStocks,
        conditionalOrderResults,
        affectedUserIds: [...affectedUserIds],
        lastPriceTickAt: completedAt,
        nextPriceTickAt,
      };
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Price movement tick failed.");
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private changeRate(beforePrice: Prisma.Decimal, afterPrice: Prisma.Decimal) {
    if (beforePrice.lessThanOrEqualTo(0)) {
      return zero();
    }
    return rate(afterPrice.minus(beforePrice).div(beforePrice).mul(100));
  }

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
