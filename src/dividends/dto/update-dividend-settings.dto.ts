import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class UpdateDividendSettingsDto {
  @ApiPropertyOptional({ minimum: 0, example: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseDividendRate?: number;

  @ApiPropertyOptional({ minimum: 0, example: 0.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  claimCountMultiplier?: number;

  @ApiPropertyOptional({ minimum: 0, example: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  claimCooldownMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seasonalClaimLimit?: number;

  @ApiPropertyOptional({ description: "Enables scheduled automatic dividend payout." })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: "Optional ISO datetime for the next scheduled payout." })
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;
}
