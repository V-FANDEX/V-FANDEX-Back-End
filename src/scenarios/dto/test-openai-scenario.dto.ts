import { IsEnum, IsOptional } from "class-validator";
import { ScenarioType } from "@prisma/client";
import { GenerateScenarioDto } from "./generate-scenario.dto";

export class TestOpenAiScenarioDto extends GenerateScenarioDto {
  @IsOptional()
  @IsEnum(ScenarioType)
  type?: ScenarioType;
}
