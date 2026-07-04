import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class UpdateDividendSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseDividendRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  claimCountMultiplier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  claimCooldownMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seasonalClaimLimit?: number;
}
