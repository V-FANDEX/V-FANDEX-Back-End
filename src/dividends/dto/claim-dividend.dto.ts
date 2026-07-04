import { IsOptional, IsString } from "class-validator";

export class ClaimDividendDto {
  @IsOptional()
  @IsString()
  stockId?: string;
}
