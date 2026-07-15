import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Prisma,
  PrismaClient,
  Role,
  SeasonStatus,
  SeedSource,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface SeedStock {
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  currentPrice: number;
  previousPrice?: number;
  initialPrice?: number;
  totalSupply: number;
  circulatingSupply?: number;
  volatilityLevel?: number;
  dividendEnabled?: boolean;
  baseDividendRate?: number;
  isListed?: boolean;
}

interface SeedMarket {
  name: string;
  description?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  stocks?: SeedStock[];
}

interface SeedData {
  markets: SeedMarket[];
}

async function main() {
  const initialCash = process.env.DEFAULT_INITIAL_CASH ?? "1000000";
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@v-fandex.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminNickname = process.env.ADMIN_NICKNAME ?? "V-FANDEX Admin";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      nickname: adminNickname,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      nickname: adminNickname,
      role: Role.ADMIN,
      cash: initialCash,
      initialCash,
      totalAssetValue: initialCash,
      isActive: true,
    },
  });

  await prisma.dividendSetting.upsert({
    where: { id: "default" },
    create: {},
    update: {},
  });

  await prisma.marketSimulationSetting.upsert({
    where: { id: "default" },
    create: {},
    update: {},
  });

  await prisma.scenarioAutomationSetting.upsert({
    where: { id: "default" },
    create: {},
    update: {},
  });

  await seedMarketsAndStocks(loadSeedData());

  const now = new Date();
  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
  });
  if (!season) {
    await prisma.season.create({
      data: {
        name: "Preseason",
        startsAt: now,
        endsAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90),
        initialCash,
        status: SeasonStatus.ACTIVE,
      },
    });
  }
}

function loadSeedData(): SeedData {
  const localPath = join(__dirname, "seed-data.local.json");
  const examplePath = join(__dirname, "seed-data.example.json");
  const path = existsSync(localPath) ? localPath : examplePath;
  return JSON.parse(readFileSync(path, "utf8")) as SeedData;
}

async function seedMarketsAndStocks(seedData: SeedData) {
  for (const [index, marketSeed] of seedData.markets.entries()) {
    const market = await prisma.market.upsert({
      where: { name: marketSeed.name },
      update: {
        description: marketSeed.description,
        iconUrl: marketSeed.iconUrl,
        sortOrder: marketSeed.sortOrder ?? index,
        isActive: marketSeed.isActive ?? true,
      },
      create: {
        name: marketSeed.name,
        description: marketSeed.description,
        iconUrl: marketSeed.iconUrl,
        sortOrder: marketSeed.sortOrder ?? index,
        isActive: marketSeed.isActive ?? true,
      },
    });

    for (const stockSeed of marketSeed.stocks ?? []) {
      await seedStock(market.id, stockSeed);
    }
  }
}

async function seedStock(marketId: string, stockSeed: SeedStock) {
  const currentPrice = new Prisma.Decimal(stockSeed.currentPrice);
  const previousPrice = new Prisma.Decimal(
    stockSeed.previousPrice ?? stockSeed.currentPrice,
  );
  const initialPrice = new Prisma.Decimal(
    stockSeed.initialPrice ?? stockSeed.previousPrice ?? stockSeed.currentPrice,
  );
  const circulatingSupply =
    stockSeed.circulatingSupply ?? stockSeed.totalSupply;

  const stock = await prisma.stock.upsert({
    where: {
      marketId_name: {
        marketId,
        name: stockSeed.name,
      },
    },
    update: {
      description: stockSeed.description,
      imageUrl: stockSeed.imageUrl,
      tags: stockSeed.tags ?? [],
      currentPrice,
      previousPrice,
      initialPrice,
      targetPrice: null,
      movementStartPrice: null,
      movementStartedAt: null,
      movementEndsAt: null,
      movementReason: null,
      lastPriceHistoryAt: null,
      totalSupply: stockSeed.totalSupply,
      circulatingSupply,
      volatilityLevel: stockSeed.volatilityLevel ?? 5,
      dividendEnabled: stockSeed.dividendEnabled ?? false,
      baseDividendRate: new Prisma.Decimal(stockSeed.baseDividendRate ?? 0),
      isListed: stockSeed.isListed ?? true,
      seedSource: SeedSource.FILE,
      seedPrice: initialPrice,
      seededAt: null,
    },
    create: {
      marketId,
      name: stockSeed.name,
      description: stockSeed.description,
      imageUrl: stockSeed.imageUrl,
      tags: stockSeed.tags ?? [],
      currentPrice,
      previousPrice,
      initialPrice,
      totalSupply: stockSeed.totalSupply,
      circulatingSupply,
      volatilityLevel: stockSeed.volatilityLevel ?? 5,
      dividendEnabled: stockSeed.dividendEnabled ?? false,
      baseDividendRate: new Prisma.Decimal(stockSeed.baseDividendRate ?? 0),
      isListed: stockSeed.isListed ?? true,
      seedSource: SeedSource.FILE,
      seedPrice: initialPrice,
    },
  });

  const historyCount = await prisma.priceHistory.count({
    where: { stockId: stock.id },
  });
  if (historyCount === 0) {
    await prisma.priceHistory.createMany({
      data: buildDemoPriceHistory(
        stock.id,
        stockSeed.name,
        currentPrice,
        previousPrice,
      ),
    });
  }
}

function buildDemoPriceHistory(
  stockId: string,
  stockName: string,
  currentPrice: Prisma.Decimal,
  previousPrice: Prisma.Decimal,
) {
  const now = Date.now();
  const points: Array<{
    createdAt: Date;
    price: Prisma.Decimal;
    reason: string;
  }> = [];

  for (let i = 29; i >= 1; i -= 1) {
    points.push({
      createdAt: new Date(now - i * 24 * 60 * 60 * 1000),
      price: demoPrice(stockName, currentPrice, 30 - i, 0.82, 1.1),
      reason: "SEED_DAILY",
    });
  }

  for (let i = 23; i >= 1; i -= 1) {
    points.push({
      createdAt: new Date(now - i * 60 * 60 * 1000),
      price: demoPrice(stockName, currentPrice, 80 - i, 0.94, 1.04),
      reason: "SEED_HOURLY",
    });
  }

  for (let i = 59; i >= 1; i -= 1) {
    points.push({
      createdAt: new Date(now - i * 60 * 1000),
      price: demoPrice(stockName, currentPrice, 140 - i, 0.985, 1.015),
      reason: "SEED_MINUTE",
    });
  }

  points.push({
    createdAt: new Date(now - 30_000),
    price: previousPrice,
    reason: "SEED_PREVIOUS",
  });
  points.push({
    createdAt: new Date(now),
    price: currentPrice,
    reason: "SEED_CURRENT",
  });

  let lastPrice = points[0]?.price ?? currentPrice;
  return points.map((point) => {
    const changeRate = lastPrice.equals(0)
      ? new Prisma.Decimal(0)
      : point.price.minus(lastPrice).div(lastPrice).mul(100);
    lastPrice = point.price;
    return {
      stockId,
      price: point.price,
      changeRate,
      reason: point.reason,
      createdAt: point.createdAt,
    };
  });
}

function demoPrice(
  stockName: string,
  basePrice: Prisma.Decimal,
  index: number,
  minFactor: number,
  maxFactor: number,
) {
  const seed = [...stockName].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const wave = Math.sin((seed + index * 17) / 9);
  const factor = minFactor + ((wave + 1) / 2) * (maxFactor - minFactor);
  return new Prisma.Decimal(
    Math.max(1, Math.round(basePrice.toNumber() * factor)),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
