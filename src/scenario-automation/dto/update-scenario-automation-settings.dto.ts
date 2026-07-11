import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateScenarioAutomationSettingsDto {
  @ApiPropertyOptional({
    description: "Enables automatic GPT scenario generation.",
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: "Enables automatic MAIN scenarios." })
  @IsOptional()
  @IsBoolean()
  mainEnabled?: boolean;

  @ApiPropertyOptional({ description: "Enables automatic SMALL scenarios." })
  @IsOptional()
  @IsBoolean()
  smallEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      "Applies generated scenarios immediately and triggers AI trades.",
  })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 168, example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  mainMinIntervalHours?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 168, example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  mainMaxIntervalHours?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 10080, example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  smallMinIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 10080, example: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  smallMaxIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 24, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  dailyMainLimit?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 288, example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(288)
  dailySmallLimit?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  retryDelayMinutes?: number;

  @ApiPropertyOptional({
    description: "Optional ISO datetime for the next MAIN scenario.",
  })
  @IsOptional()
  @IsDateString()
  nextMainRunAt?: string;

  @ApiPropertyOptional({
    description: "Optional ISO datetime for the next SMALL scenario.",
  })
  @IsOptional()
  @IsDateString()
  nextSmallRunAt?: string;
}
