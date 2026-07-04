# V-FANDEX Back-End

팬덤/콘텐츠 기반 가상 주식 시뮬레이터 V-FANDEX의 REST API 서버입니다.

## Stack

- Node.js + NestJS + TypeScript
- PostgreSQL
- Prisma ORM
- JWT authentication
- OpenAI Responses API for scenario generation

## Quick Start

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npx prisma db push
npm run db:seed
npm run start:dev
```

API server: `http://localhost:3000`

Swagger docs: `http://localhost:3000/docs`

Health check:

```bash
curl http://localhost:3000/health
```

## Seeded Admin

The seed script creates an initial admin account. Change these values in `.env` before using a shared environment.

```text
ADMIN_EMAIL=admin@v-fandex.local
ADMIN_PASSWORD=ChangeMe123!
```

## Main Domains

- Auth: register, login, current user
- Markets and stocks: public listing plus admin CRUD
- Trading: buy/sell transactions with cash, holding, average price, realized P/L updates
- Conditional orders: active order checks after price changes
- Dividends: claim cooldown, seasonal limit, progressive claim multiplier
- Seasons: active season and admin reset
- Rankings: season rankings for users and AI accounts
- Scenarios: OpenAI-generated narratives and server-side price impact calculation
- AI accounts: admin-managed virtual traders that use the same trade service as users
- Admin: dashboard, users, manual ranking recalculation

## Useful Commands

```bash
npm run typecheck
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## Notes

- AI accounts have no password and cannot log in through `/auth/login`.
- Admin-only routes are protected by JWT plus `ADMIN` role checks.
- Prices, rates, cash, and asset values are stored with PostgreSQL decimal fields.
- Scenario model names are configured with `OPENAI_MAIN_MODEL`, `OPENAI_BIG_MODEL`, and `OPENAI_SMALL_MODEL`.
