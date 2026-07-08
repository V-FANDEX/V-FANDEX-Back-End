import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConditionalOrderStatus, OrderType, Prisma } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { TradingService } from "../trading/trading.service";
import { CreateConditionalOrderDto } from "./dto/create-conditional-order.dto";

type Tx = Prisma.TransactionClient;

@Injectable()
export class ConditionalOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService,
    private readonly tradingService: TradingService
  ) {}

  async create(userId: string, dto: CreateConditionalOrderDto) {
    const stock = await this.prisma.stock.findUnique({ where: { id: dto.stockId } });
    if (!stock || !stock.isListed || stock.isTradingSuspended) {
      throw new BadRequestException("Stock is not tradable.");
    }

    const activeDuplicate = await this.prisma.conditionalOrder.findFirst({
      where: {
        userId,
        stockId: dto.stockId,
        type: dto.type,
        conditionType: dto.conditionType,
        triggerPrice: money(dto.triggerPrice),
        status: ConditionalOrderStatus.ACTIVE
      }
    });

    if (activeDuplicate) {
      throw new BadRequestException("Duplicate active conditional order exists.");
    }

    return this.prisma.conditionalOrder.create({
      data: {
        userId,
        stockId: dto.stockId,
        type: dto.type,
        triggerPrice: money(dto.triggerPrice),
        conditionType: dto.conditionType,
        quantity: dto.quantity
      },
      include: { stock: true }
    });
  }

  listMine(userId: string) {
    return this.prisma.conditionalOrder.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.conditionalOrder.findUnique({ where: { id } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException("Conditional order not found.");
    }

    if (order.status !== ConditionalOrderStatus.ACTIVE) {
      throw new BadRequestException("Only active conditional orders can be cancelled.");
    }

    return this.prisma.conditionalOrder.update({
      where: { id },
      data: { status: ConditionalOrderStatus.CANCELLED }
    });
  }

  async processForStockInTx(tx: Tx, stockId: string, currentPrice: Prisma.Decimal) {
    const orders = await tx.conditionalOrder.findMany({
      where: { stockId, status: ConditionalOrderStatus.ACTIVE },
      orderBy: { createdAt: "asc" }
    });
    const affectedUserIds = new Set<string>();
    const results = [];

    for (const order of orders) {
      const shouldTrigger =
        order.conditionType === "PRICE_LESS_THAN_OR_EQUAL"
          ? currentPrice.lessThanOrEqualTo(order.triggerPrice)
          : currentPrice.greaterThanOrEqualTo(order.triggerPrice);

      if (!shouldTrigger) {
        continue;
      }

      try {
        const trade = await this.tradingService.executeTradeInTx(tx, {
          userId: order.userId,
          stockId: order.stockId,
          type: order.type,
          quantity: order.quantity,
          orderType: OrderType.CONDITION
        });
        await tx.conditionalOrder.update({
          where: { id: order.id },
          data: { status: ConditionalOrderStatus.TRIGGERED, triggeredAt: new Date() }
        });
        affectedUserIds.add(order.userId);
        results.push({
          orderId: order.id,
          userId: order.userId,
          stockId: order.stockId,
          type: order.type,
          status: ConditionalOrderStatus.TRIGGERED,
          tradeId: trade.id,
          quantity: order.quantity,
          triggerPrice: order.triggerPrice,
          executedPrice: trade.price
        });
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : "Conditional order execution failed.";
        await tx.conditionalOrder.update({
          where: { id: order.id },
          data: {
            status: ConditionalOrderStatus.FAILED,
            failureReason,
            triggeredAt: new Date()
          }
        });
        results.push({
          orderId: order.id,
          userId: order.userId,
          stockId: order.stockId,
          type: order.type,
          status: ConditionalOrderStatus.FAILED,
          quantity: order.quantity,
          triggerPrice: order.triggerPrice,
          failureReason
        });
      }
    }

    return {
      affectedUserIds: [...affectedUserIds],
      results
    };
  }

  async recalculateAffectedRankings(userIds: string[]) {
    for (const userId of new Set(userIds)) {
      await this.rankingsService.recalculateUser(userId);
    }
  }
}
