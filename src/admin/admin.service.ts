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
    const [userCount, aiCount, marketCount, stockCount, activeSeason, tradeAggregate, dividendAggregate] =
      await Promise.all([
        this.prisma.user.count({ where: { role: Role.USER } }),
        this.prisma.user.count({ where: { role: Role.AI } }),
        this.prisma.market.count(),
        this.prisma.stock.count(),
        this.prisma.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" } }),
        this.prisma.trade.aggregate({ _sum: { totalAmount: true }, _count: true }),
        this.prisma.dividend.aggregate({ _sum: { amount: true }, _count: true })
      ]);

    return {
      users: userCount,
      aiAccounts: aiCount,
      markets: marketCount,
      stocks: stockCount,
      activeSeason,
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
}
