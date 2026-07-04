import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Role, SeasonStatus } from "@prisma/client";
import { money } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { ResetSeasonDto } from "./dto/reset-season.dto";

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  list() {
    return this.prisma.season.findMany({ orderBy: { startsAt: "desc" } });
  }

  async current() {
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { startsAt: "desc" }
    });

    if (!season) {
      throw new NotFoundException("Active season not found.");
    }

    return season;
  }

  async create(dto: CreateSeasonDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException("Season startsAt must be before endsAt.");
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.status === SeasonStatus.ACTIVE) {
        await tx.season.updateMany({
          where: { status: SeasonStatus.ACTIVE },
          data: { status: SeasonStatus.ENDED }
        });
      }

      return tx.season.create({
        data: {
          name: dto.name,
          startsAt,
          endsAt,
          initialCash: money(dto.initialCash),
          status: dto.status ?? SeasonStatus.UPCOMING
        }
      });
    });
  }

  async reset(id: string, dto: ResetSeasonDto) {
    if (!dto.confirm) {
      throw new BadRequestException("Season reset requires confirm=true.");
    }

    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) {
      throw new NotFoundException("Season not found.");
    }

    const initialCash = money(season.initialCash);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.season.updateMany({
        where: { status: SeasonStatus.ACTIVE, id: { not: id } },
        data: { status: SeasonStatus.ENDED }
      });
      await tx.season.update({ where: { id }, data: { status: SeasonStatus.ACTIVE } });

      const users = await tx.user.updateMany({
        where: { role: { in: [Role.USER, Role.AI] } },
        data: {
          cash: initialCash,
          initialCash,
          totalAssetValue: initialCash
        }
      });

      const holdings = await tx.holding.deleteMany({
        where: { user: { role: { in: [Role.USER, Role.AI] } } }
      });

      const conditionalOrders = await tx.conditionalOrder.deleteMany({
        where: { user: { role: { in: [Role.USER, Role.AI] } } }
      });

      await tx.ranking.deleteMany({ where: { seasonId: id } });

      return {
        seasonId: id,
        usersReset: users.count,
        holdingsCleared: holdings.count,
        conditionalOrdersCleared: conditionalOrders.count
      };
    });

    await this.rankingsService.recalculateAll(id);
    return result;
  }
}
