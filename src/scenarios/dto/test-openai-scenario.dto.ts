import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ScenarioType } from "@prisma/client";
import { GenerateScenarioDto } from "./generate-scenario.dto";

export class TestOpenAiScenarioDto extends GenerateScenarioDto {
  @ApiPropertyOptional({ enum: ScenarioType })
  @IsOptional()
  @IsEnum(ScenarioType)
  type?: ScenarioType;
}
