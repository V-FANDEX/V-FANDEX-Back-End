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
  @IsString()
  marketId: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  initialPrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSupply: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  circulatingSupply?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  volatilityLevel?: number;

  @IsOptional()
  @IsBoolean()
  dividendEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseDividendRate?: number;

  @IsOptional()
  @IsBoolean()
  isListed?: boolean;
}
