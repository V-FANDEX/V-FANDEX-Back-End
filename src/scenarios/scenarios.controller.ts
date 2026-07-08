import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role, ScenarioType } from "@prisma/client";
import { ScenarioApplyResponseDto, ScenarioResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { GenerateScenarioDto } from "./dto/generate-scenario.dto";
import { TestOpenAiScenarioDto } from "./dto/test-openai-scenario.dto";
import { ScenariosService } from "./scenarios.service";

@Controller()
@ApiTags("Scenarios")
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Get("scenarios")
  @ApiOkResponse({ type: ScenarioResponseDto, isArray: true })
  list() {
    return this.scenariosService.list();
  }

  @Get("scenarios/:id")
  @ApiOkResponse({ type: ScenarioResponseDto })
  get(@Param("id") id: string) {
    return this.scenariosService.get(id);
  }

  @Get("admin/scenarios/openai-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  openAiStatus() {
    return this.scenariosService.getOpenAiStatus();
  }

  @Post("admin/scenarios/test-openai")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  testOpenAi(@Body() dto: TestOpenAiScenarioDto) {
    return this.scenariosService.testOpenAi(dto);
  }

  @Post("admin/scenarios/generate-main")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ScenarioResponseDto })
  generateMain(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.MAIN, dto);
  }

  @Post("admin/scenarios/generate-big")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ScenarioResponseDto })
  generateBig(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.BIG, dto);
  }

  @Post("admin/scenarios/generate-small")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ScenarioResponseDto })
  generateSmall(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.SMALL, dto);
  }

  @Post("admin/scenarios/:id/apply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ScenarioApplyResponseDto })
  apply(@Param("id") id: string) {
    return this.scenariosService.apply(id);
  }
}
