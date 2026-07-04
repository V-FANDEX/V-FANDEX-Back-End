import { PrismaClient, Role, SeasonStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
      isActive: true
    },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      nickname: adminNickname,
      role: Role.ADMIN,
      cash: initialCash,
      initialCash,
      totalAssetValue: initialCash,
      isActive: true
    }
  });

  await prisma.dividendSetting.upsert({
    where: { id: "default" },
    create: {},
    update: {}
  });

  const markets = [
    "버츄얼&스트리머장",
    "가수장",
    "캐릭터장",
    "애니메이션장"
  ];

  for (const [index, name] of markets.entries()) {
    await prisma.market.upsert({
      where: { name },
      update: { sortOrder: index },
      create: {
        name,
        sortOrder: index,
        isActive: true
      }
    });
  }

  const now = new Date();
  const season = await prisma.season.findFirst({ where: { status: SeasonStatus.ACTIVE } });
  if (!season) {
    await prisma.season.create({
      data: {
        name: "Preseason",
        startsAt: now,
        endsAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90),
        initialCash,
        status: SeasonStatus.ACTIVE
      }
    });
  }
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
