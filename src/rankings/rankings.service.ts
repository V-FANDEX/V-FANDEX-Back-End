import { Injectable, NotFoundException } from "@nestjs/common";
import { Role, SeasonStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { money, rate, zero } from "../common/utils/decimal";

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(seasonId?: string, includeAi = true) {
    const targetSeasonId = seasonId ?? (await this.getActiveSeasonId());
    if (!targetSeasonId) {
      return [];
    }

    return this.prisma.ranking.findMany({
      where: {
        seasonId: targetSeasonId,
        user: includeAi ? undefined : { role: Role.USER }
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            role: true,
            totalAssetValue: true
          }
        }
      },
      orderBy: [{ rank: "asc" }, { totalAssetValue: "desc" }]
    });
  }

  async getMyRanking(userId: string) {
    const seasonId = await this.getActiveSeasonId();
    if (!seasonId) {
      throw new NotFoundException("Active season not found.");
    }

    await this.recalculateUser(userId, seasonId);

    const ranking = await this.prisma.ranking.findUnique({
      where: { seasonId_userId: { seasonId, userId } },
      include: { user: { select: { id: true, nickname: true, role: true } } }
    });

    if (!ranking) {
      throw new NotFoundException("Ranking not found.");
    }

    return ranking;
  }

  async recalculateUser(userId: string, seasonId?: string) {
    const targetSeasonId = seasonId ?? (await this.getActiveSeasonId());
    const user = await this.prisma.user.findUnique({
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
    const realizedProfit = money(user.holdings.reduce((sum, holding) => sum.plus(holding.realizedProfit), zero()));
    const totalDividendReceived = await this.sumDividends(userId, targetSeasonId);
    const tradeVolume = await this.sumTradeVolume(userId, targetSeasonId);
    const profitRate = user.initialCash.equals(0)
      ? zero()
      : rate(totalAssetValue.minus(user.initialCash).div(user.initialCash).mul(100));

    await this.prisma.user.update({
      where: { id: userId },
      data: { totalAssetValue }
    });

    if (!targetSeasonId) {
      return null;
    }

    const ranking = await this.prisma.ranking.upsert({
      where: { seasonId_userId: { seasonId: targetSeasonId, userId } },
      create: {
        seasonId: targetSeasonId,
        userId,
        totalAssetValue,
        cash: user.cash,
        profitRate,
        realizedProfit,
        totalDividendReceived,
        tradeVolume,
        rank: 0
      },
      update: {
        totalAssetValue,
        cash: user.cash,
        profitRate,
        realizedProfit,
        totalDividendReceived,
        tradeVolume
      }
    });

    await this.assignRanks(targetSeasonId);
    return ranking;
  }

  async recalculateAll(seasonId?: string) {
    const targetSeasonId = seasonId ?? (await this.getActiveSeasonId());
    if (!targetSeasonId) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { role: { in: [Role.USER, Role.AI] }, isActive: true },
      select: { id: true }
    });

    for (const user of users) {
      await this.recalculateUser(user.id, targetSeasonId);
    }

    await this.assignRanks(targetSeasonId);
    return this.list(targetSeasonId);
  }

  async getActiveSeasonId() {
    const active = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { startsAt: "desc" },
      select: { id: true }
    });
    return active?.id ?? null;
  }

  private async sumDividends(userId: string, seasonId: string | null) {
    const aggregate = await this.prisma.dividend.aggregate({
      where: { userId, seasonId: seasonId ?? undefined },
      _sum: { amount: true }
    });
    return money(aggregate._sum.amount ?? 0);
  }

  private async sumTradeVolume(userId: string, seasonId: string | null) {
    const aggregate = await this.prisma.trade.aggregate({
      where: { userId, seasonId: seasonId ?? undefined },
      _sum: { totalAmount: true }
    });
    return money(aggregate._sum.totalAmount ?? 0);
  }

  private async assignRanks(seasonId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { seasonId },
      orderBy: [{ totalAssetValue: "desc" }, { updatedAt: "asc" }],
      select: { id: true }
    });

    await this.prisma.$transaction(
      rankings.map((ranking, index) =>
        this.prisma.ranking.update({
          where: { id: ranking.id },
          data: { rank: index + 1 }
        })
      )
    );
  }
}
