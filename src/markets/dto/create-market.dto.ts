import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from "class-validator";

export class CreateMarketDto {
  @ApiProperty({ maxLength: 80, example: "버츄얼&스트리머장" })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  iconUrl?: string;

  @ApiPropertyOptional({ minimum: 0, example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
