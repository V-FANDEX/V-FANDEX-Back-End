import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderType, Prisma, SeasonStatus, TradeType } from "@prisma/client";
import { money, zero } from "../common/utils/decimal";
import { resolveMovementPrice } from "../price-movements/price-movement.utils";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { TradeRequestDto } from "./dto/trade-request.dto";

type Tx = Prisma.TransactionClient;

interface ExecuteTradeInput {
  userId: string;
  stockId: string;
  type: TradeType;
  quantity: number;
  orderType?: OrderType;
  executionPrice?: Prisma.Decimal;
}

@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  async buy(userId: string, dto: TradeRequestDto) {
    const trade = await this.prisma.$transaction((tx) =>
      this.executeTradeInTx(tx, {
        userId,
        stockId: dto.stockId,
        quantity: dto.quantity,
        type: TradeType.BUY,
        orderType: dto.orderType ?? OrderType.MARKET
      })
    );
    await this.rankingsService.recalculateUser(userId);
    return trade;
  }

  async sell(userId: string, dto: TradeRequestDto) {
    const trade = await this.prisma.$transaction((tx) =>
      this.executeTradeInTx(tx, {
        userId,
        stockId: dto.stockId,
        quantity: dto.quantity,
        type: TradeType.SELL,
        orderType: dto.orderType ?? OrderType.MARKET
      })
    );
    await this.rankingsService.recalculateUser(userId);
    return trade;
  }

  async listForUser(requesterId: string, targetUserId?: string) {
    const userId = targetUserId ?? requesterId;
    return this.prisma.trade.findMany({
      where: { userId },
      include: { stock: { include: { market: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async executeTradeInTx(tx: Tx, input: ExecuteTradeInput) {
    if (input.quantity <= 0) {
      throw new BadRequestException("Quantity must be positive.");
    }

    const [user, stock, season] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId } }),
      tx.stock.findUnique({ where: { id: input.stockId } }),
      tx.season.findFirst({
        where: { status: SeasonStatus.ACTIVE },
        orderBy: { startsAt: "desc" },
        select: { id: true }
      })
    ]);

    if (!user || !user.isActive) {
      throw new NotFoundException("User not found or inactive.");
    }

    if (!stock || !stock.isListed || stock.isTradingSuspended) {
      throw new BadRequestException("Stock is not tradable.");
    }

    const price = money(input.executionPrice ?? resolveMovementPrice(stock, new Date()));
    if (price.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Stock price must be positive.");
    }

    const totalAmount = money(price.mul(input.quantity));
    const fee = zero();

    if (input.type === TradeType.BUY) {
      await this.executeBuyInTx(tx, input.userId, input.stockId, input.quantity, totalAmount, fee, user.cash, price);
    } else {
      await this.executeSellInTx(tx, input.userId, input.stockId, input.quantity, totalAmount, fee, price);
    }

    const trade = await tx.trade.create({
      data: {
        userId: input.userId,
        stockId: input.stockId,
        seasonId: season?.id,
        type: input.type,
        orderType: input.orderType ?? OrderType.MARKET,
        price,
        quantity: input.quantity,
        totalAmount,
        fee
      },
      include: { stock: true }
    });

    await this.recalculateUserAssetInTx(tx, input.userId);
    return trade;
  }

  async recalculateUserAssetInTx(tx: Tx, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { holdings: { include: { stock: true } } }
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const holdingValue = user.holdings.reduce(
      (sum, holding) => sum.plus(holding.stock.currentPrice.mul(holding.quantity)),
      zero()
    );
    const totalAssetValue = money(user.cash.plus(holdingValue));
    await tx.user.update({ where: { id: userId }, data: { totalAssetValue } });
    return totalAssetValue;
  }

  private async executeBuyInTx(
    tx: Tx,
    userId: string,
    stockId: string,
    quantity: number,
    totalAmount: Prisma.Decimal,
    fee: Prisma.Decimal,
    currentCash: Prisma.Decimal,
    price: Prisma.Decimal
  ) {
    const requiredCash = totalAmount.plus(fee);
    if (currentCash.lessThan(requiredCash)) {
      throw new BadRequestException("Insufficient cash.");
    }

    const holding = await tx.holding.findUnique({ where: { userId_stockId: { userId, stockId } } });
    if (!holding) {
      await tx.holding.create({
        data: {
          userId,
          stockId,
          quantity,
          averageBuyPrice: price,
          realizedProfit: 0
        }
      });
    } else {
      const newQuantity = holding.quantity + quantity;
      const oldCost = holding.averageBuyPrice.mul(holding.quantity);
      const newAverage = money(oldCost.plus(totalAmount).div(newQuantity));
      await tx.holding.update({
        where: { id: holding.id },
        data: {
          quantity: newQuantity,
          averageBuyPrice: newAverage
        }
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { cash: { decrement: requiredCash } }
    });
  }

  private async executeSellInTx(
    tx: Tx,
    userId: string,
    stockId: string,
    quantity: number,
    totalAmount: Prisma.Decimal,
    fee: Prisma.Decimal,
    price: Prisma.Decimal
  ) {
    const holding = await tx.holding.findUnique({ where: { userId_stockId: { userId, stockId } } });
    if (!holding || holding.quantity < quantity) {
      throw new BadRequestException("Insufficient holding quantity.");
    }

    const realizedProfit = money(price.minus(holding.averageBuyPrice).mul(quantity).minus(fee));
    await tx.holding.update({
      where: { id: holding.id },
      data: {
        quantity: holding.quantity - quantity,
        realizedProfit: { increment: realizedProfit }
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: { cash: { increment: totalAmount.minus(fee) } }
    });
  }
}
