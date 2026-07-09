import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { SeasonResetResponseDto, SeasonResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { ResetSeasonDto } from "./dto/reset-season.dto";
import { SeasonsService } from "./seasons.service";

@Controller()
@ApiTags("Seasons")
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get("seasons")
  @ApiOkResponse({ type: SeasonResponseDto, isArray: true })
  list() {
    return this.seasonsService.list();
  }

  @Get("seasons/current")
  @ApiOkResponse({ type: SeasonResponseDto })
  current() {
    return this.seasonsService.current();
  }

  @Post("admin/seasons")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: SeasonResponseDto })
  create(@Body() dto: CreateSeasonDto) {
    return this.seasonsService.create(dto);
  }

  @Post("admin/seasons/:id/reset")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SeasonResetResponseDto })
  reset(@Param("id") id: string, @Body() dto: ResetSeasonDto) {
    return this.seasonsService.reset(id, dto);
  }
}
