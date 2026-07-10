import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import {
  MarketSimulationRunResponseDto,
  MarketSimulationSettingResponseDto
} from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UpdateMarketSimulationSettingsDto } from "./dto/update-market-simulation-settings.dto";
import { MarketSimulationService } from "./market-simulation.service";

@Controller("admin/market-simulation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiTags("Market Simulation")
@ApiBearerAuth()
export class MarketSimulationController {
  constructor(private readonly marketSimulationService: MarketSimulationService) {}

  @Get("settings")
  @ApiOkResponse({ type: MarketSimulationSettingResponseDto })
  getSettings() {
    return this.marketSimulationService.getSettings();
  }

  @Patch("settings")
  @ApiOkResponse({ type: MarketSimulationSettingResponseDto })
  updateSettings(@Body() dto: UpdateMarketSimulationSettingsDto) {
    return this.marketSimulationService.updateSettings(dto);
  }

  @Post("run")
  @ApiOkResponse({ type: MarketSimulationRunResponseDto })
  runNow() {
    return this.marketSimulationService.runSimulation({ force: true });
  }
}
