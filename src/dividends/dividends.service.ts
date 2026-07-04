import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SeasonStatus } from "@prisma/client";
import { money, rate, zero } from "../common/utils/decimal";
import { PrismaService } from "../prisma/prisma.service";
import { RankingsService } from "../rankings/rankings.service";
import { ClaimDividendDto } from "./dto/claim-dividend.dto";
import { UpdateDividendSettingsDto } from "./dto/update-dividend-settings.dto";

@Injectable()
export class DividendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService
  ) {}

  listMine(userId: string) {
    return this.prisma.dividend.findMany({
      where: { userId },
      include: { stock: true, season: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async claim(userId: string, dto: ClaimDividendDto) {
    const settings = await this.getSettings();
    const season = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { startsAt: "desc" },
      select: { id: true }
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        holdings: {
          include: { stock: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const stockId = dto.stockId ?? null;
    const claimWhere = { userId, stockId, seasonId: season?.id };
    const seasonalClaimCount = await this.prisma.dividend.count({ where: claimWhere });
    if (seasonalClaimCount >= settings.seasonalClaimLimit) {
      throw new BadRequestException("Seasonal dividend claim limit reached.");
    }

    const cooldownStartedAt = new Date(Date.now() - settings.claimCooldownMinutes * 60_000);
    const cooldownClaim = await this.prisma.dividend.findFirst({
      where: {
        ...claimWhere,
        createdAt: { gt: cooldownStartedAt }
      },
      orderBy: { createdAt: "desc" }
    });
    if (cooldownClaim) {
      throw new BadRequestException("Dividend claim cooldown is still active.");
    }

    const basis = await this.calculateBasis(user, stockId);
    if (basis.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Dividend basis amount must be positive.");
    }

    const baseRate = await this.resolveBaseRate(stockId, settings.baseDividendRate);
    const dividendRate = rate(baseRate.mul(new Prisma.Decimal(1).plus(settings.claimCountMultiplier.mul(seasonalClaimCount))));
    const amount = money(basis.mul(dividendRate));

    const dividend = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { cash: { increment: amount } }
      });

      return tx.dividend.create({
        data: {
          userId,
          stockId,
          seasonId: season?.id,
          amount,
          dividendRate,
          claimCount: seasonalClaimCount + 1
        },
        include: { stock: true, season: true }
      });
    });

    await this.rankingsService.recalculateUser(userId, season?.id);
    return dividend;
  }

  async getSettings() {
    return this.prisma.dividendSetting.upsert({
      where: { id: "default" },
      create: {},
      update: {}
    });
  }

  async updateSettings(dto: UpdateDividendSettingsDto) {
    return this.prisma.dividendSetting.upsert({
      where: { id: "default" },
      create: {
        baseDividendRate: dto.baseDividendRate === undefined ? undefined : rate(dto.baseDividendRate),
        claimCountMultiplier: dto.claimCountMultiplier === undefined ? undefined : rate(dto.claimCountMultiplier),
        claimCooldownMinutes: dto.claimCooldownMinutes,
        seasonalClaimLimit: dto.seasonalClaimLimit
      },
      update: {
        baseDividendRate: dto.baseDividendRate === undefined ? undefined : rate(dto.baseDividendRate),
        claimCountMultiplier: dto.claimCountMultiplier === undefined ? undefined : rate(dto.claimCountMultiplier),
        claimCooldownMinutes: dto.claimCooldownMinutes,
        seasonalClaimLimit: dto.seasonalClaimLimit
      }
    });
  }

  private async calculateBasis(
    user: Prisma.UserGetPayload<{ include: { holdings: { include: { stock: true } } } }>,
    stockId: string | null
  ) {
    if (stockId) {
      const holding = user.holdings.find((item) => item.stockId === stockId);
      if (!holding || holding.quantity <= 0) {
        throw new BadRequestException("Stock dividend requires an active holding.");
      }

      if (!holding.stock.dividendEnabled) {
        throw new BadRequestException("Dividend is disabled for this stock.");
      }

      return money(holding.stock.currentPrice.mul(holding.quantity));
    }

    const holdingValue = user.holdings.reduce(
      (sum, holding) => sum.plus(holding.stock.currentPrice.mul(holding.quantity)),
      zero()
    );
    const totalAssetValue = user.cash.plus(holdingValue);
    const lossAmount = Prisma.Decimal.max(user.initialCash.minus(totalAssetValue), 0);
    const minimumRecoveryBasis = user.initialCash.mul(0.05);
    return money(Prisma.Decimal.max(lossAmount, minimumRecoveryBasis));
  }

  private async resolveBaseRate(stockId: string | null, fallback: Prisma.Decimal) {
    if (!stockId) {
      return fallback;
    }

    const stock = await this.prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) {
      throw new NotFoundException("Stock not found.");
    }

    return stock.baseDividendRate.greaterThan(0) ? stock.baseDividendRate : fallback;
  }
}
