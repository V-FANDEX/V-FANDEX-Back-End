import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsString, Min } from "class-validator";
import { ConditionType, TradeType } from "@prisma/client";

export class CreateConditionalOrderDto {
  @IsString()
  stockId: string;

  @IsEnum(TradeType)
  type: TradeType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  triggerPrice: number;

  @IsEnum(ConditionType)
  conditionType: ConditionType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
