import { Injectable, NotFoundException } from "@nestjs/common";
import { money, zero } from "../common/utils/decimal";
import { withLivePrice } from "../price-movements/price-movement.utils";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  async getForUser(userId: string) {
    await this.rankingsService.recalculateUser(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        role: true,
        cash: true,
        initialCash: true,
        totalAssetValue: true,
        holdings: {
          include: { stock: { include: { market: true } } },
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const priceAsOf = new Date();
    const holdings = user.holdings.map((holding) => ({
      ...holding,
      stock: withLivePrice(holding.stock, priceAsOf)
    }));
    const holdingValue = holdings.reduce(
      (sum, holding) => sum.plus(holding.stock.currentPrice.mul(holding.quantity)),
      zero()
    );

    return {
      ...user,
      totalAssetValue: money(user.cash.plus(holdingValue)),
      holdings
    };
  }
}
