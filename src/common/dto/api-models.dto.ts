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
  SeasonStatus,
  TradeType
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
