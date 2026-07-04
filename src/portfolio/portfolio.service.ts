import { Injectable, NotFoundException } from "@nestjs/common";
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

    return user;
  }
}
