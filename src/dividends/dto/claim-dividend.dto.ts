import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ClaimDividendDto {
  @ApiPropertyOptional({ description: "Omit for system-wide recovery dividend." })
  @IsOptional()
  @IsString()
  stockId?: string;
}
