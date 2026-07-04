import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { AiStrategyType } from "@prisma/client";

export class CreateAiAccountDto {
  @IsString()
  @MaxLength(32)
  nickname: string;

  @IsEnum(AiStrategyType)
  strategyType: AiStrategyType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  preferredMarketIds?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  riskLevel: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialCash?: number;
}
