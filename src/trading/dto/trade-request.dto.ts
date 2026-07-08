import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { OrderType } from "@prisma/client";

export class TradeRequestDto {
  @ApiProperty()
  @IsString()
  stockId: string;

  @ApiProperty({ minimum: 1, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ enum: OrderType, default: OrderType.MARKET })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;
}
