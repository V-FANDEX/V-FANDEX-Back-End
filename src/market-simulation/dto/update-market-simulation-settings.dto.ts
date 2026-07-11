import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateMarketSimulationSettingsDto {
  @ApiPropertyOptional({
    description: "Enables periodic server-side market simulation.",
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  intervalMinutes?: number;

  @ApiPropertyOptional({
    description:
      "Uses a random interval between minIntervalMinutes and maxIntervalMinutes.",
  })
  @IsOptional()
  @IsBoolean()
  randomIntervalEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  maxIntervalMinutes?: number;

  @ApiPropertyOptional({
    description: "Normal minimum percent change per run.",
    example: -7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  minChangeRate?: number;

  @ApiPropertyOptional({
    description: "Normal maximum percent change per run.",
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxChangeRate?: number;

  @ApiPropertyOptional({
    description: "Extreme minimum percent change per run.",
    example: -80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  extremeMinRate?: number;

  @ApiPropertyOptional({
    description: "Extreme maximum percent change per run.",
    example: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  extremeMaxRate?: number;

  @ApiPropertyOptional({
    description: "Probability from 0 to 1 that a stock uses the extreme range.",
    example: 0.04,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  extremeChance?: number;

  @ApiPropertyOptional({
    description: "How strongly stock volatilityLevel widens the random move.",
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volatilityWeight?: number;

  @ApiPropertyOptional({
    description:
      "Optional number of listed stocks to affect each run. Omit for all.",
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetStockCount?: number;

  @ApiPropertyOptional({
    description: "Optional ISO datetime for the next automatic run.",
  })
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;
}
