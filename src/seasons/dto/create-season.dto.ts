import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { SeasonStatus } from "@prisma/client";

export class CreateSeasonDto {
  @ApiProperty({ maxLength: 100, example: "Season 1" })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: "2026-07-08T00:00:00.000Z" })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: "2026-10-08T00:00:00.000Z" })
  @IsDateString()
  endsAt: string;

  @ApiProperty({ minimum: 0, example: 1000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCash: number;

  @ApiPropertyOptional({ enum: SeasonStatus })
  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;
}
