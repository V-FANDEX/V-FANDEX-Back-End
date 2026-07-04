import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role, ScenarioType } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { GenerateScenarioDto } from "./dto/generate-scenario.dto";
import { ScenariosService } from "./scenarios.service";

@Controller()
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Get("scenarios")
  list() {
    return this.scenariosService.list();
  }

  @Get("scenarios/:id")
  get(@Param("id") id: string) {
    return this.scenariosService.get(id);
  }

  @Post("admin/scenarios/generate-main")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  generateMain(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.MAIN, dto);
  }

  @Post("admin/scenarios/generate-big")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  generateBig(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.BIG, dto);
  }

  @Post("admin/scenarios/generate-small")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  generateSmall(@Body() dto: GenerateScenarioDto) {
    return this.scenariosService.generate(ScenarioType.SMALL, dto);
  }

  @Post("admin/scenarios/:id/apply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  apply(@Param("id") id: string) {
    return this.scenariosService.apply(id);
  }
}
