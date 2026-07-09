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

## Fixed Demo Markets And Stocks

Default demo markets and stocks are defined in `prisma/seed-data.example.json`. To customize the fixed markets and stocks used before a season starts, copy it to a local seed file and edit the names, images, tags, prices, supply, volatility, and dividend options there:

```bash
cp prisma/seed-data.example.json prisma/seed-data.local.json
npm run db:seed
```

`prisma/seed-data.local.json` is ignored by Git, so local or production seed data can be managed separately without committing it. Each market can contain a `stocks` array. Each stock supports `name`, `description`, `imageUrl`, `tags`, `currentPrice`, `previousPrice`, `totalSupply`, `circulatingSupply`, `volatilityLevel`, `dividendEnabled`, and `baseDividendRate`.

Season reset keeps only the seed catalog. `POST /admin/seasons/:id/reset` clears holdings, orders, watchlists, trades, dividends, rankings, scenarios, impacts, and price history, deletes markets/stocks that are not present in the seed data, reapplies the seed markets/stocks, and resets USER/AI cash to the season initial cash. User, admin, and AI accounts themselves are not deleted.

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
npm run start:prod
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## AI Account Behavior

AI accounts are simulated traders, not login users. They are created by admins with `role=AI`, no password, and their trades always go through the same buy/sell service used by normal users.

AI accounts consider listed stocks across every market. `preferredMarketIds` can remain as profile metadata, but it does not restrict the trade universe.

When an admin applies a GPT-generated scenario, the server first updates impacted stock prices and writes `ScenarioImpact` records. After that, active AI accounts automatically react once:

- `POSITIVE`: buy an impacted stock with a positive price signal.
- `NEGATIVE`: sell held stocks affected by the issue.
- `MIXED`: choose between selling negatively affected holdings and buying positively affected stocks.
- `NEUTRAL`: usually skip, with a small chance to make a light reaction trade.

The AI decision uses the scenario sentiment, impact level, actual stock change rate, strategy type, risk level, cash, and current holdings. It does not call GPT again, so scenario reaction trades do not add OpenAI cost.

## OpenAI Scenario Test

Set `OPENAI_API_KEY` in `.env` or in your deployment environment. Do not put a real key in `.env.example`.

Admins can verify the OpenAI configuration without saving a scenario:

```bash
GET /admin/scenarios/openai-status
POST /admin/scenarios/test-openai
```

`test-openai` performs a real OpenAI call and returns the parsed scenario with `persisted: false`. The normal generation endpoints save the generated scenario:

```bash
POST /admin/scenarios/generate-main
POST /admin/scenarios/generate-big
POST /admin/scenarios/generate-small
```

## Notes

- AI accounts have no password and cannot log in through `/auth/login`.
- Admin-only routes are protected by JWT plus `ADMIN` role checks.
- Prices, rates, cash, and asset values are stored with PostgreSQL decimal fields.
- Scenario model names are configured with `OPENAI_MAIN_MODEL`, `OPENAI_BIG_MODEL`, and `OPENAI_SMALL_MODEL`.
