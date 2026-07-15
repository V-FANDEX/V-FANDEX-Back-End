import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AiStrategyType,
  ConditionalOrderStatus,
  ConditionType,
  OrderType,
  Role,
  ScenarioCreatedBy,
  ScenarioSentiment,
  ScenarioType,
  SeedSource,
  SeasonStatus,
  TradeType,
} from "@prisma/client";

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ example: "1000000.0000" })
  cash: string;

  @ApiProperty({ example: "1000000.0000" })
  initialCash: string;

  @ApiProperty({ example: "1000000.0000" })
  totalAssetValue: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class MarketResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  iconUrl?: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ example: "ACTIVE" })
  status: string;

  @ApiPropertyOptional()
  stockCount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class StockResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  marketId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ example: "14200.0000" })
  currentPrice: string;

  @ApiProperty({ example: "13800.0000" })
  previousPrice: string;

  @ApiProperty({ example: "13800.0000" })
  initialPrice: string;

  @ApiPropertyOptional({ nullable: true, example: "15500.0000" })
  targetPrice?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "14200.0000" })
  movementStartPrice?: string | null;

  @ApiPropertyOptional({ nullable: true })
  movementStartedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  movementEndsAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  movementReason?: string | null;

  @ApiPropertyOptional()
  isPriceMoving?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  priceMovementProgress?: number;

  @ApiPropertyOptional()
  priceAsOf?: Date;

  @ApiProperty()
  totalSupply: number;

  @ApiProperty()
  circulatingSupply: number;

  @ApiProperty()
  volatilityLevel: number;

  @ApiProperty()
  dividendEnabled: boolean;

  @ApiProperty({ example: "0.010000" })
  baseDividendRate: string;

  @ApiProperty()
  isListed: boolean;

  @ApiProperty()
  isTradingSuspended: boolean;

  @ApiPropertyOptional({ nullable: true })
  delistedAt?: Date | null;

  @ApiPropertyOptional({ enum: SeedSource, nullable: true })
  seedSource?: SeedSource | null;

  @ApiPropertyOptional({ nullable: true, example: "10000.0000" })
  seedPrice?: string | null;

  @ApiPropertyOptional({ nullable: true })
  seededAt?: Date | null;

  @ApiProperty()
  volume: number;

  @ApiProperty({ example: "1164400000.0000" })
  marketCap: string;

  @ApiProperty({ example: "0.0000" })
  tradeValue: string;

  @ApiProperty({ example: "LISTED" })
  status: string;

  @ApiPropertyOptional({ type: MarketResponseDto })
  market?: MarketResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class StockQuoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  marketId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: "14200.0000" })
  currentPrice: string;

  @ApiProperty({ example: "13800.0000" })
  previousPrice: string;

  @ApiProperty({ example: "2.898551" })
  changeRate: string;

  @ApiPropertyOptional({ nullable: true })
  targetPrice?: string | null;

  @ApiPropertyOptional({ nullable: true })
  movementStartPrice?: string | null;

  @ApiPropertyOptional({ nullable: true })
  movementStartedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  movementEndsAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  movementReason?: string | null;

  @ApiProperty()
  isPriceMoving: boolean;

  @ApiProperty({ minimum: 0, maximum: 1 })
  priceMovementProgress: number;

  @ApiProperty()
  priceAsOf: Date;
}

export class PriceHistoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stockId: string;

  @ApiProperty({ example: "14200.0000" })
  price: string;

  @ApiProperty({ example: "1.250000" })
  changeRate: string;

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class ChartBucketResponseDto {
  @ApiProperty()
  stockId: string;

  @ApiProperty({ enum: ["minute", "hour", "day"] })
  interval: "minute" | "hour" | "day";

  @ApiProperty()
  bucket: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ example: "14000.0000" })
  openPrice: string;

  @ApiProperty({ example: "14300.0000" })
  highPrice: string;

  @ApiProperty({ example: "13900.0000" })
  lowPrice: string;

  @ApiProperty({ example: "14200.0000" })
  closePrice: string;

  @ApiProperty({ example: "14200.0000" })
  price: string;

  @ApiProperty({ example: "1.250000" })
  changeRate: string;

  @ApiProperty()
  count: number;
}

export class HoldingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  stockId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ example: "10000.0000" })
  averageBuyPrice: string;

  @ApiProperty({ example: "0.0000" })
  realizedProfit: string;

  @ApiProperty({ type: StockResponseDto })
  stock: StockResponseDto;
}

export class PortfolioResponseDto extends UserResponseDto {
  @ApiProperty({ type: [HoldingResponseDto] })
  holdings: HoldingResponseDto[];
}

export class TradeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  stockId: string;

  @ApiPropertyOptional({ nullable: true })
  seasonId?: string | null;

  @ApiProperty({ enum: TradeType })
  type: TradeType;

  @ApiProperty({ enum: OrderType })
  orderType: OrderType;

  @ApiProperty({ example: "14200.0000" })
  price: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ example: "142000.0000" })
  totalAmount: string;

  @ApiProperty({ example: "0.0000" })
  fee: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: StockResponseDto })
  stock?: StockResponseDto;
}

export class ConditionalOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  stockId: string;

  @ApiProperty({ enum: TradeType })
  type: TradeType;

  @ApiProperty({ example: "10000.0000" })
  triggerPrice: string;

  @ApiProperty({ enum: ConditionType })
  conditionType: ConditionType;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ enum: ConditionalOrderStatus })
  status: ConditionalOrderStatus;

  @ApiPropertyOptional({ nullable: true })
  failureReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  triggeredAt?: Date | null;

  @ApiPropertyOptional({ type: StockResponseDto })
  stock?: StockResponseDto;
}

export class DividendResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ nullable: true })
  stockId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  seasonId?: string | null;

  @ApiProperty({ example: "1000.0000" })
  amount: string;

  @ApiProperty({ example: "0.010000" })
  dividendRate: string;

  @ApiProperty()
  claimCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class DividendSettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: "0.010000" })
  baseDividendRate: string;

  @ApiProperty({ example: "0.100000" })
  claimCountMultiplier: string;

  @ApiProperty()
  claimCooldownMinutes: number;

  @ApiProperty()
  seasonalClaimLimit: number;

  @ApiProperty()
  isEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextRunAt?: Date | null;

  @ApiProperty()
  updatedAt: Date;
}

export class RankingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seasonId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: "1000000.0000" })
  totalAssetValue: string;

  @ApiProperty({ example: "1000000.0000" })
  cash: string;

  @ApiProperty({ example: "0.000000" })
  profitRate: string;

  @ApiProperty({ example: "0.0000" })
  realizedProfit: string;

  @ApiProperty({ example: "0.0000" })
  totalDividendReceived: string;

  @ApiProperty({ example: "0.0000" })
  tradeVolume: string;

  @ApiProperty()
  rank: number;

  @ApiProperty()
  updatedAt: Date;
}

export class ScenarioImpactResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  scenarioId: string;

  @ApiProperty()
  stockId: string;

  @ApiProperty({ example: "10000.0000" })
  oldPrice: string;

  @ApiProperty({ example: "10800.0000" })
  newPrice: string;

  @ApiProperty({ example: "8.000000" })
  changeRate: string;

  @ApiPropertyOptional({ nullable: true })
  impactReason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: StockResponseDto })
  stock?: StockResponseDto;
}

export class ScenarioResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ScenarioType })
  type: ScenarioType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  affectedMarketIds: string[];

  @ApiProperty({ type: [String] })
  affectedStockIds: string[];

  @ApiProperty({ enum: ScenarioSentiment })
  sentiment: ScenarioSentiment;

  @ApiProperty()
  impactLevel: number;

  @ApiProperty({ enum: ScenarioCreatedBy })
  createdBy: ScenarioCreatedBy;

  @ApiPropertyOptional()
  rawAiResponse?: unknown;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true })
  appliedAt?: Date | null;

  @ApiProperty({ type: [ScenarioImpactResponseDto] })
  impacts: ScenarioImpactResponseDto[];
}

export class AiTradeResultResponseDto {
  @ApiProperty()
  aiAccountId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: "BUY" })
  action: string;

  @ApiPropertyOptional()
  stockId?: string;

  @ApiPropertyOptional()
  quantity?: number;

  @ApiPropertyOptional()
  tradeId?: string;

  @ApiProperty()
  reason: string;
}

export class ScenarioApplyResponseDto extends ScenarioResponseDto {
  @ApiProperty({ type: [Object] })
  affectedStocks: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  conditionalOrderResults: Array<Record<string, unknown>>;

  @ApiProperty({ type: [AiTradeResultResponseDto] })
  aiTradeResults: AiTradeResultResponseDto[];
}

export class SeasonResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty({ example: "1000000.0000" })
  initialCash: string;

  @ApiProperty({ enum: SeasonStatus })
  status: SeasonStatus;
}

export class SeasonResetResponseDto {
  @ApiProperty()
  seasonId: string;

  @ApiProperty({ example: "SEED_CATALOG_ONLY" })
  resetMode: string;

  @ApiProperty()
  usersReset: number;

  @ApiProperty()
  holdingsCleared: number;

  @ApiProperty()
  conditionalOrdersCleared: number;

  @ApiProperty()
  watchlistItemsCleared: number;

  @ApiProperty()
  tradesCleared: number;

  @ApiProperty()
  dividendsCleared: number;

  @ApiProperty()
  rankingsCleared: number;

  @ApiProperty()
  scenarioImpactsCleared: number;

  @ApiProperty()
  scenariosCleared: number;

  @ApiProperty()
  priceHistoriesCleared: number;

  @ApiProperty()
  nonSeedStocksDeleted: number;

  @ApiProperty()
  nonSeedMarketsDeleted: number;

  @ApiProperty()
  seedMarketsApplied: number;

  @ApiProperty()
  seedStocksApplied: number;

  @ApiProperty()
  adminSeedMarketsPreserved: number;

  @ApiProperty()
  adminSeedStocksRestored: number;

  @ApiProperty()
  seedPriceHistoriesCreated: number;
}

export class AiAccountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: AiStrategyType })
  strategyType: AiStrategyType;

  @ApiProperty({ type: [String] })
  preferredMarketIds: string[];

  @ApiProperty()
  riskLevel: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ example: "1000000.0000" })
  cash: string;

  @ApiProperty({ example: "1000000.0000" })
  totalAssetValue: string;

  @ApiProperty({ example: "ACTIVE" })
  status: string;

  @ApiPropertyOptional({ type: UserResponseDto })
  user?: UserResponseDto;
}

export class DashboardSeriesPointDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
}

export class MarketVolumeSeriesPointDto {
  @ApiProperty()
  marketId: string;

  @ApiProperty()
  marketName: string;

  @ApiProperty({ example: "100000.0000" })
  tradeVolume: string;

  @ApiProperty()
  tradeCount: number;
}

export class AdminDashboardResponseDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  aiAccountCount: number;

  @ApiProperty()
  stockCount: number;

  @ApiProperty()
  marketCount: number;

  @ApiProperty({ example: "1000000000.0000" })
  totalMarketCap: string;

  @ApiProperty({ example: "100000.0000" })
  dailyTradeVolume: string;

  @ApiProperty({ type: [DashboardSeriesPointDto] })
  userGrowthSeries: DashboardSeriesPointDto[];

  @ApiProperty({ type: [MarketVolumeSeriesPointDto] })
  marketVolumeSeries: MarketVolumeSeriesPointDto[];
}

export class MarketSimulationSettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  intervalMinutes: number;

  @ApiProperty()
  randomIntervalEnabled: boolean;

  @ApiProperty()
  minIntervalMinutes: number;

  @ApiProperty()
  maxIntervalMinutes: number;

  @ApiProperty({ example: "-7.000000" })
  minChangeRate: string;

  @ApiProperty({ example: "7.000000" })
  maxChangeRate: string;

  @ApiProperty({ example: "-80.000000" })
  extremeMinRate: string;

  @ApiProperty({ example: "300.000000" })
  extremeMaxRate: string;

  @ApiProperty({ example: "0.040000" })
  extremeChance: string;

  @ApiProperty({ example: "1.000000" })
  volatilityWeight: string;

  @ApiPropertyOptional({ nullable: true })
  targetStockCount?: number | null;

  @ApiProperty()
  priceMovementEnabled: boolean;

  @ApiProperty({ example: 30 })
  priceTickSeconds: number;

  @ApiProperty({ example: 3 })
  minMovementMinutes: number;

  @ApiProperty({ example: 8 })
  maxMovementMinutes: number;

  @ApiPropertyOptional({ nullable: true })
  lastPriceTickAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextPriceTickAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextRunAt?: Date | null;

  @ApiProperty()
  updatedAt: Date;
}

export class MarketSimulationAffectedStockDto {
  @ApiProperty()
  stockId: string;

  @ApiProperty()
  stockName: string;

  @ApiProperty({ example: "10000.0000" })
  beforePrice: string;

  @ApiProperty({ example: "12000.0000" })
  afterPrice: string;

  @ApiProperty({ example: "12000.0000" })
  targetPrice: string;

  @ApiProperty({ example: "20.000000" })
  appliedRate: string;

  @ApiProperty({ enum: ["NORMAL", "EXTREME"] })
  mode: "NORMAL" | "EXTREME";

  @ApiProperty()
  reason: string;

  @ApiProperty()
  movementStartedAt: Date;

  @ApiProperty()
  movementEndsAt: Date;

  @ApiProperty()
  movementDurationMinutes: number;
}

export class MarketSimulationRunResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ enum: ["MANUAL", "SCHEDULED"] })
  mode: "MANUAL" | "SCHEDULED";

  @ApiProperty()
  affectedCount: number;

  @ApiProperty({ type: [MarketSimulationAffectedStockDto] })
  affectedStocks: MarketSimulationAffectedStockDto[];

  @ApiProperty({ type: [Object] })
  conditionalOrderResults: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ nullable: true })
  nextRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true, example: 11 })
  scheduledIntervalMinutes?: number | null;
}

export class PriceMovementAffectedStockDto {
  @ApiProperty()
  stockId: string;

  @ApiProperty()
  stockName: string;

  @ApiProperty({ example: "10000.0000" })
  beforePrice: string;

  @ApiProperty({ example: "10250.0000" })
  afterPrice: string;

  @ApiProperty({ example: "12000.0000" })
  targetPrice: string;

  @ApiProperty()
  reachedTarget: boolean;

  @ApiPropertyOptional({ nullable: true })
  movementReason?: string | null;
}

export class PriceMovementTickResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty()
  affectedCount: number;

  @ApiProperty()
  reachedTargetCount: number;

  @ApiProperty({ type: [PriceMovementAffectedStockDto] })
  affectedStocks: PriceMovementAffectedStockDto[];

  @ApiProperty({ type: [Object] })
  conditionalOrderResults: Array<Record<string, unknown>>;

  @ApiProperty({ type: [String] })
  affectedUserIds: string[];

  @ApiProperty()
  lastPriceTickAt: Date;

  @ApiProperty()
  nextPriceTickAt: Date;
}

export class ScenarioAutomationSettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  mainEnabled: boolean;

  @ApiProperty()
  smallEnabled: boolean;

  @ApiProperty()
  autoApply: boolean;

  @ApiProperty({ example: 12 })
  mainMinIntervalHours: number;

  @ApiProperty({ example: 24 })
  mainMaxIntervalHours: number;

  @ApiProperty({ example: 120 })
  smallMinIntervalMinutes: number;

  @ApiProperty({ example: 240 })
  smallMaxIntervalMinutes: number;

  @ApiProperty({ example: 2 })
  dailyMainLimit: number;

  @ApiProperty({ example: 12 })
  dailySmallLimit: number;

  @ApiProperty({ example: 15 })
  retryDelayMinutes: number;

  @ApiPropertyOptional({ nullable: true })
  lastMainRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextMainRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastSmallRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextSmallRunAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastMainError?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastMainErrorAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastSmallError?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastSmallErrorAt?: Date | null;

  @ApiProperty()
  todayMainCount: number;

  @ApiProperty()
  todaySmallCount: number;

  @ApiProperty()
  serverTime: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ScenarioAutomationRunResponseDto {
  @ApiProperty({ enum: [ScenarioType.MAIN, ScenarioType.SMALL] })
  type: ScenarioType;

  @ApiProperty({
    enum: [
      "COMPLETED",
      "GENERATED_APPLY_FAILED",
      "FAILED",
      "SKIPPED_ALREADY_RUNNING",
      "SKIPPED_NOT_DUE",
      "SKIPPED_LEASED",
      "SKIPPED_DAILY_LIMIT",
    ],
  })
  status: string;

  @ApiPropertyOptional({ type: ScenarioResponseDto })
  scenario?: ScenarioResponseDto;

  @ApiPropertyOptional()
  autoApply?: boolean;

  @ApiPropertyOptional({ type: ScenarioApplyResponseDto, nullable: true })
  application?: ScenarioApplyResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  applyError?: string | null;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  nextRunAt?: Date;
}

export class ScenarioAutomationProcessResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ enum: ["DISABLED", "IDLE", "PROCESSED"] })
  status: string;

  @ApiProperty()
  checkedAt: Date;

  @ApiProperty({ type: [ScenarioAutomationRunResponseDto] })
  results: ScenarioAutomationRunResponseDto[];
}

export class AutomationTaskResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ["IDLE", "COMPLETED", "FAILED"] })
  status: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  error?: string;
}

export class AutomationTickResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ enum: ["COMPLETED", "SKIPPED_ALREADY_RUNNING"] })
  status: string;

  @ApiProperty({ enum: ["INTERNAL", "EXTERNAL"] })
  source: string;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty()
  completedAt: Date;

  @ApiProperty({ type: [AutomationTaskResponseDto] })
  tasks: AutomationTaskResponseDto[];
}
