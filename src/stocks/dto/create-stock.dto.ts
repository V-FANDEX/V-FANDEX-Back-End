import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateStockDto {
  @ApiProperty()
  @IsString()
  marketId: string;

  @ApiProperty({ maxLength: 100, example: "루미아 라이브" })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ minimum: 0.0001, example: 10000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  initialPrice: number;

  @ApiProperty({ minimum: 1, example: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSupply: number;

  @ApiPropertyOptional({ minimum: 0, example: 80000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  circulatingSupply?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  volatilityLevel?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dividendEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, example: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseDividendRate?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isListed?: boolean;
}
