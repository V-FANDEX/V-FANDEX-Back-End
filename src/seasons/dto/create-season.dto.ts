import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { SeasonStatus } from "@prisma/client";

export class CreateSeasonDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCash: number;

  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;
}
