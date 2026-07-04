import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { OrderType } from "@prisma/client";

export class TradeRequestDto {
  @IsString()
  stockId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;
}
