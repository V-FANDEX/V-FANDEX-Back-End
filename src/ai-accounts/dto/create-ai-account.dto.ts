import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { AiStrategyType } from "@prisma/client";

export class CreateAiAccountDto {
  @ApiProperty({ maxLength: 32, example: "AI 공격형 1호" })
  @IsString()
  @MaxLength(32)
  nickname: string;

  @ApiProperty({ enum: AiStrategyType })
  @IsEnum(AiStrategyType)
  strategyType: AiStrategyType;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  preferredMarketIds?: string[];

  @ApiProperty({ minimum: 1, maximum: 10, example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  riskLevel: number;

  @ApiPropertyOptional({ minimum: 0, example: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialCash?: number;
}
