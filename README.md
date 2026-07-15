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

Season reset keeps the file seed catalog and markets/stocks saved to the database seed catalog by an admin. `POST /admin/seasons/:id/reset` clears holdings, orders, watchlists, trades, dividends, rankings, scenarios, impacts, and price history, deletes other markets/stocks, reapplies the seed markets/stocks, and resets USER/AI cash to the season initial cash. User, admin, and AI accounts themselves are not deleted.

### Saving A Market To The Seed Catalog

Admins can preserve a market created during a season, even when it has no persistent stocks:

```text
POST /admin/markets/:id/save-to-seed
Authorization: Bearer <admin-access-token>
```

The market response includes `seedSource` and `seededAt`. Saving a market does not automatically save its stocks; call the stock seed endpoint for every stock that must also survive a season reset. Each market promotion is recorded as `MARKET_SAVED_TO_SEED` in the admin audit log.

### Saving A Listed Stock To The Seed Catalog

Admins can promote a stock listed during a season into the persistent seed catalog:

```text
POST /admin/stocks/:id/save-to-seed
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{}
```

By default, the stock's `initialPrice` becomes the price restored at the next season reset. To choose another reset price, send:

```json
{
  "seedPrice": 12500
}
```

The stock response includes `seedSource`, `seedPrice`, and `seededAt`. `seedSource=FILE` identifies stocks from the JSON seed file, while `seedSource=ADMIN` identifies stocks promoted through this API. Promoting a stock also preserves its market because a market containing an admin seed stock is not deleted during season reset. Each promotion is recorded as `STOCK_SAVED_TO_SEED` in the admin audit log.

This feature adds database columns to both `Market` and `Stock`, so apply the Prisma schema in every deployed environment before starting the updated server:

```bash
npx prisma db push
```

Frontend integration details are documented in [`docs/frontend-seed-catalog-spec.md`](docs/frontend-seed-catalog-spec.md). A concise handoff for the market update is available in [`docs/frontend-market-seed-update.md`](docs/frontend-market-seed-update.md).

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

## Market Simulation

The server can move listed stock prices without calling GPT. Admins can manage the scheduler and volatility from:

```text
GET /admin/market-simulation/settings
PATCH /admin/market-simulation/settings
POST /admin/market-simulation/run
```

Normal moves use `minChangeRate` and `maxChangeRate`. Occasional high-risk moves use `extremeMinRate`, `extremeMaxRate`, and `extremeChance`; the default extreme range is `-80%` to `+300%`. Downside moves are clamped so prices never become negative. Each run writes price history, checks conditional orders, and recalculates rankings.

Set `randomIntervalEnabled=true`, `minIntervalMinutes=5`, and `maxIntervalMinutes=15` to schedule each price update at a new random interval between 5 and 15 minutes. Set `randomIntervalEnabled=false` to use the fixed `intervalMinutes` value instead. The scheduler remains inactive until `isEnabled=true` is saved.

### Gradual Price Movement

Market simulations and applied GPT scenarios set a target price instead of replacing `currentPrice` immediately. The server advances active prices every `priceTickSeconds` and records chart history at most once per minute while a stock is moving. Default movement duration is randomly selected between `minMovementMinutes=3` and `maxMovementMinutes=8`.

SMALL scenarios use the base duration, MAIN scenarios use twice the base duration, and BIG scenarios use three times the base duration. If another event arrives before the old target is reached, the server calculates the live price at that instant and starts a new path toward the latest target. Conditional orders are checked against each actual intermediate price rather than the future target price.

Stock responses include `targetPrice`, `movementStartPrice`, `movementStartedAt`, `movementEndsAt`, `movementReason`, `isPriceMoving`, `priceMovementProgress`, and `priceAsOf`. Frontends can use these fields to animate between API polls while all trades use the same server-side movement curve.

For lightweight polling, use `GET /stocks/quotes` or filter it with `GET /stocks/quotes?marketId=:marketId`. It returns only the live quote and movement fields, avoiding repeated trade-volume and chart queries.

Admins can force one movement tick for diagnostics:

```text
POST /admin/market-simulation/price-tick
```

## Automatic GPT Scenarios

Automatic MAIN and SMALL scenario generation is controlled through:

```text
GET /admin/scenario-automation/settings
PATCH /admin/scenario-automation/settings
POST /admin/scenario-automation/run-main
POST /admin/scenario-automation/run-small
POST /admin/scenario-automation/run-due
```

The defaults schedule MAIN scenarios every 12 to 24 hours with a maximum of two per UTC day, and SMALL scenarios every 120 to 240 minutes with a maximum of twelve per UTC day. `autoApply=true` immediately applies generated price impacts, checks conditional orders, recalculates rankings, and lets active AI accounts react. Failed GPT generations are retried after `retryDelayMinutes`. Database leases prevent duplicate GPT calls when scheduler ticks overlap.

Automatic scenario generation is disabled by default to prevent accidental API charges. Enable `isEnabled`, then keep `mainEnabled` and/or `smallEnabled` active through the admin settings endpoint.

## Scheduler On Sleeping Hosts

The application checks active price movements every ten seconds and slower market simulation, scenario automation, and dividend jobs once per minute while the process is awake. For a Render service that can sleep, configure a long random `SCHEDULER_SECRET` in the deployment environment and call the following endpoint from an external cron service every minute:

```text
POST /internal/scheduler/tick
x-scheduler-secret: <SCHEDULER_SECRET>
```

The endpoint is idempotent for overlapping calls: an already running tick is skipped, and scenario jobs additionally use a database lease. Do not expose the scheduler secret in frontend code.

Without an external wake-up call, scheduled runs only happen while the server is awake.

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
