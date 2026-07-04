import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: { stock: { include: { market: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async add(userId: string, stockId: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id: stockId }, select: { id: true } });
    if (!stock) {
      throw new BadRequestException("Stock does not exist.");
    }

    return this.prisma.watchlist.upsert({
      where: { userId_stockId: { userId, stockId } },
      create: { userId, stockId },
      update: {},
      include: { stock: { include: { market: true } } }
    });
  }

  async remove(userId: string, stockId: string) {
    await this.prisma.watchlist.deleteMany({ where: { userId, stockId } });
    return { removed: true };
  }
}
