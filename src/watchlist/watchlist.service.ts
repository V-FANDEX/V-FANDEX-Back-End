import { BadRequestException, Injectable } from "@nestjs/common";
import { withLivePrice } from "../price-movements/price-movement.utils";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    const items = await this.prisma.watchlist.findMany({
      where: { userId },
      include: { stock: { include: { market: true } } },
      orderBy: { createdAt: "desc" }
    });
    const priceAsOf = new Date();
    return items.map((item) => ({ ...item, stock: withLivePrice(item.stock, priceAsOf) }));
  }

  async add(userId: string, stockId: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id: stockId }, select: { id: true } });
    if (!stock) {
      throw new BadRequestException("Stock does not exist.");
    }

    const item = await this.prisma.watchlist.upsert({
      where: { userId_stockId: { userId, stockId } },
      create: { userId, stockId },
      update: {},
      include: { stock: { include: { market: true } } }
    });
    return { ...item, stock: withLivePrice(item.stock) };
  }

  async remove(userId: string, stockId: string) {
    await this.prisma.watchlist.deleteMany({ where: { userId, stockId } });
    return { removed: true };
  }
}
