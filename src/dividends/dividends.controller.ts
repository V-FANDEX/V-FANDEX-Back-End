import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { DividendResponseDto, DividendSettingResponseDto } from "../common/dto/api-models.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types/auth-user";
import { DividendsService } from "./dividends.service";
import { ClaimDividendDto } from "./dto/claim-dividend.dto";
import { UpdateDividendSettingsDto } from "./dto/update-dividend-settings.dto";

@Controller()
@ApiTags("Dividends")
export class DividendsController {
  constructor(private readonly dividendsService: DividendsService) {}

  @Get("dividends/me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: DividendResponseDto, isArray: true })
  mine(@CurrentUser() user: AuthUser) {
    return this.dividendsService.listMine(user.id);
  }

  @Post("dividends/claim")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: DividendResponseDto })
  claim(@CurrentUser() user: AuthUser, @Body() dto: ClaimDividendDto) {
    return this.dividendsService.claim(user.id, dto);
  }

  @Get("admin/dividend-settings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: DividendSettingResponseDto })
  getSettings() {
    return this.dividendsService.getSettings();
  }

  @Patch("admin/dividend-settings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: DividendSettingResponseDto })
  updateSettings(@Body() dto: UpdateDividendSettingsDto) {
    return this.dividendsService.updateSettings(dto);
  }

  @Post("admin/dividend-settings/run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  runScheduledPayout() {
    return this.dividendsService.processScheduledDividends(true);
  }
}
