import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class SaveStockToSeedDto {
  @ApiPropertyOptional({
    description:
      "Price restored at season reset. Defaults to the stock initialPrice.",
    minimum: 0.0001,
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  seedPrice?: number;
}
