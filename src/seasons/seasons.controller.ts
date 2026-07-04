import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { ResetSeasonDto } from "./dto/reset-season.dto";
import { SeasonsService } from "./seasons.service";

@Controller()
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get("seasons")
  list() {
    return this.seasonsService.list();
  }

  @Get("seasons/current")
  current() {
    return this.seasonsService.current();
  }

  @Post("admin/seasons")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSeasonDto) {
    return this.seasonsService.create(dto);
  }

  @Post("admin/seasons/:id/reset")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reset(@Param("id") id: string, @Body() dto: ResetSeasonDto) {
    return this.seasonsService.reset(id, dto);
  }
}
