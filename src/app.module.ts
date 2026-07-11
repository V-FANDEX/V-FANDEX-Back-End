import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { AiAccountsController } from "./ai-accounts/ai-accounts.controller";
import { AiAccountsService } from "./ai-accounts/ai-accounts.service";
import { AutomationSchedulerController } from "./automation/automation-scheduler.controller";
import { AutomationSchedulerService } from "./automation/automation-scheduler.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { ConditionalOrdersController } from "./conditional-orders/conditional-orders.controller";
import { ConditionalOrdersService } from "./conditional-orders/conditional-orders.service";
import { SchedulerSecretGuard } from "./common/guards/scheduler-secret.guard";
import { DividendsController } from "./dividends/dividends.controller";
import { DividendsService } from "./dividends/dividends.service";
import { HealthController } from "./health/health.controller";
import { MarketsController } from "./markets/markets.controller";
import { MarketsService } from "./markets/markets.service";
import { MarketSimulationController } from "./market-simulation/market-simulation.controller";
import { MarketSimulationService } from "./market-simulation/market-simulation.service";
import { PortfolioController } from "./portfolio/portfolio.controller";
import { PortfolioService } from "./portfolio/portfolio.service";
import { PriceMovementsService } from "./price-movements/price-movements.service";
import { PrismaService } from "./prisma/prisma.service";
import { RankingsController } from "./rankings/rankings.controller";
import { RankingsService } from "./rankings/rankings.service";
import { ScenarioAutomationController } from "./scenario-automation/scenario-automation.controller";
import { ScenarioAutomationService } from "./scenario-automation/scenario-automation.service";
import { ScenariosController } from "./scenarios/scenarios.controller";
import { ScenariosService } from "./scenarios/scenarios.service";
import { SeasonsController } from "./seasons/seasons.controller";
import { SeasonsService } from "./seasons/seasons.service";
import { StocksController } from "./stocks/stocks.controller";
import { StocksService } from "./stocks/stocks.service";
import { TradingController } from "./trading/trading.controller";
import { TradingService } from "./trading/trading.service";
import { UsersService } from "./users/users.service";
import { WatchlistController } from "./watchlist/watchlist.controller";
import { WatchlistService } from "./watchlist/watchlist.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "dev-secret",
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [
    AdminController,
    AiAccountsController,
    AutomationSchedulerController,
    AuthController,
    ConditionalOrdersController,
    DividendsController,
    HealthController,
    MarketsController,
    MarketSimulationController,
    PortfolioController,
    RankingsController,
    ScenarioAutomationController,
    ScenariosController,
    SeasonsController,
    StocksController,
    TradingController,
    WatchlistController,
  ],
  providers: [
    AdminService,
    AiAccountsService,
    AutomationSchedulerService,
    AuthService,
    ConditionalOrdersService,
    DividendsService,
    MarketsService,
    MarketSimulationService,
    PortfolioService,
    PriceMovementsService,
    PrismaService,
    RankingsService,
    ScenarioAutomationService,
    SchedulerSecretGuard,
    ScenariosService,
    SeasonsService,
    StocksService,
    TradingService,
    UsersService,
    WatchlistService,
  ],
})
export class AppModule {}
