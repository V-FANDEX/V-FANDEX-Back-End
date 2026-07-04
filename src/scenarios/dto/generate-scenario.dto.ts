import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class GenerateScenarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  affectedMarketIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  affectedStockIds?: string[];
}
