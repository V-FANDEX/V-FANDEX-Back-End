import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMarketDto } from "./dto/create-market.dto";
import { UpdateMarketDto } from "./dto/update-market.dto";

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.market.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async get(id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
      include: {
        stocks: {
          where: { isListed: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    return market;
  }

  async create(dto: CreateMarketDto) {
    try {
      return await this.prisma.market.create({
        data: {
          name: dto.name,
          description: dto.description,
          iconUrl: dto.iconUrl,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true
        }
      });
    } catch {
      throw new BadRequestException("Market name is already in use.");
    }
  }

  async update(id: string, dto: UpdateMarketDto) {
    await this.ensureExists(id);
    return this.prisma.market.update({
      where: { id },
      data: dto
    });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.market.update({
      where: { id },
      data: { isActive: false }
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.market.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Market not found.");
    }
  }
}
