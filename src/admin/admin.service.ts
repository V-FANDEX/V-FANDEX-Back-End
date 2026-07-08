import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  async dashboard() {
    const today = this.startOfUtcDay(new Date());
    const seriesStart = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      activeUsers,
      aiAccountCount,
      marketCount,
      stockCount,
      activeSeason,
      tradeAggregate,
      dailyTradeAggregate,
      dividendAggregate,
      stocks,
      usersForSeries,
      tradesForSeries
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.USER } }),
      this.prisma.user.count({ where: { role: Role.USER, isActive: true } }),
      this.prisma.user.count({ where: { role: Role.AI, isActive: true } }),
      this.prisma.market.count(),
      this.prisma.stock.count(),
      this.prisma.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" } }),
      this.prisma.trade.aggregate({ _sum: { totalAmount: true }, _count: true }),
      this.prisma.trade.aggregate({ where: { createdAt: { gte: today } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.dividend.aggregate({ _sum: { amount: true }, _count: true }),
      this.prisma.stock.findMany({
        select: {
          currentPrice: true,
          circulatingSupply: true
        }
      }),
      this.prisma.user.findMany({
        where: { role: Role.USER, createdAt: { gte: seriesStart } },
        select: { createdAt: true }
      }),
      this.prisma.trade.findMany({
        where: { createdAt: { gte: seriesStart } },
        select: {
          createdAt: true,
          totalAmount: true,
          stock: {
            select: {
              marketId: true,
              market: { select: { name: true } }
            }
          }
        }
      })
    ]);

    const totalMarketCap = stocks.reduce(
      (sum, stock) => sum.plus(stock.currentPrice.mul(stock.circulatingSupply)),
      new Prisma.Decimal(0)
    );

    return {
      totalUsers,
      activeUsers,
      aiAccountCount,
      stockCount,
      marketCount,
      totalMarketCap,
      dailyTradeVolume: dailyTradeAggregate._sum.totalAmount ?? 0,
      userGrowthSeries: this.userGrowthSeries(usersForSeries, seriesStart),
      marketVolumeSeries: this.marketVolumeSeries(tradesForSeries),
      activeSeason,
      users: totalUsers,
      aiAccounts: aiAccountCount,
      markets: marketCount,
      stocks: stockCount,
      trades: {
        count: tradeAggregate._count,
        totalAmount: tradeAggregate._sum.totalAmount ?? 0
      },
      dividends: {
        count: dividendAggregate._count,
        totalAmount: dividendAggregate._sum.amount ?? 0
      }
    };
  }

  listUsers(role?: Role) {
    return this.prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        cash: true,
        initialCash: true,
        totalAssetValue: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          email: dto.email?.toLowerCase(),
          nickname: dto.nickname,
          role: dto.role,
          cash: dto.cash === undefined ? undefined : money(dto.cash),
          initialCash: dto.initialCash === undefined ? undefined : money(dto.initialCash),
          isActive: dto.isActive
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          cash: true,
          initialCash: true,
          totalAssetValue: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      await this.rankingsService.recalculateUser(id);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Email is already in use.");
      }
      throw error;
    }
  }

  recalculateRankings() {
    return this.rankingsService.recalculateAll();
  }

  private startOfUtcDay(date: Date) {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }

  private userGrowthSeries(users: Array<{ createdAt: Date }>, start: Date) {
    const countsByDate = new Map<string, number>();
    for (const user of users) {
      const key = this.startOfUtcDay(user.createdAt).toISOString().slice(0, 10);
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }

    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        count: countsByDate.get(date) ?? 0
      };
    });
  }

  private marketVolumeSeries(
    trades: Array<{
      totalAmount: Prisma.Decimal;
      stock: { marketId: string; market: { name: string } };
    }>
  ) {
    const marketMap = new Map<string, { marketId: string; marketName: string; tradeVolume: Prisma.Decimal; tradeCount: number }>();

    for (const trade of trades) {
      const current =
        marketMap.get(trade.stock.marketId) ??
        {
          marketId: trade.stock.marketId,
          marketName: trade.stock.market.name,
          tradeVolume: new Prisma.Decimal(0),
          tradeCount: 0
        };

      current.tradeVolume = current.tradeVolume.plus(trade.totalAmount);
      current.tradeCount += 1;
      marketMap.set(trade.stock.marketId, current);
    }

    return [...marketMap.values()].sort((a, b) => b.tradeVolume.minus(a.tradeVolume).toNumber());
  }
}
