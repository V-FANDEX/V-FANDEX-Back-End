import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsString, Min } from "class-validator";
import { ConditionType, TradeType } from "@prisma/client";

export class CreateConditionalOrderDto {
  @ApiProperty()
  @IsString()
  stockId: string;

  @ApiProperty({ enum: TradeType })
  @IsEnum(TradeType)
  type: TradeType;

  @ApiProperty({ minimum: 0.0001, example: 10000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  triggerPrice: number;

  @ApiProperty({ enum: ConditionType })
  @IsEnum(ConditionType)
  conditionType: ConditionType;

  @ApiProperty({ minimum: 1, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
