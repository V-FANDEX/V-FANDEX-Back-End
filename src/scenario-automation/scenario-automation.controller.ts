import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import {
  ScenarioAutomationProcessResponseDto,
  ScenarioAutomationRunResponseDto,
  ScenarioAutomationSettingResponseDto,
} from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UpdateScenarioAutomationSettingsDto } from "./dto/update-scenario-automation-settings.dto";
import { ScenarioAutomationService } from "./scenario-automation.service";

@Controller("admin/scenario-automation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiTags("Scenario Automation")
@ApiBearerAuth()
export class ScenarioAutomationController {
  constructor(
    private readonly scenarioAutomationService: ScenarioAutomationService,
  ) {}

  @Get("settings")
  @ApiOkResponse({ type: ScenarioAutomationSettingResponseDto })
  getSettings() {
    return this.scenarioAutomationService.getStatus();
  }

  @Patch("settings")
  @ApiOkResponse({ type: ScenarioAutomationSettingResponseDto })
  updateSettings(@Body() dto: UpdateScenarioAutomationSettingsDto) {
    return this.scenarioAutomationService.updateSettings(dto);
  }

  @Post("run-main")
  @ApiOkResponse({ type: ScenarioAutomationRunResponseDto })
  runMain() {
    return this.scenarioAutomationService.runMainNow();
  }

  @Post("run-small")
  @ApiOkResponse({ type: ScenarioAutomationRunResponseDto })
  runSmall() {
    return this.scenarioAutomationService.runSmallNow();
  }

  @Post("run-due")
  @ApiOkResponse({ type: ScenarioAutomationProcessResponseDto })
  runDue() {
    return this.scenarioAutomationService.processDueScenarios();
  }
}
