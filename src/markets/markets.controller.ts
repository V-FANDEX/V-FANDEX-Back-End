import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateMarketDto } from "./dto/create-market.dto";
import { UpdateMarketDto } from "./dto/update-market.dto";
import { MarketsService } from "./markets.service";

@Controller()
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get("markets")
  list(@Query("includeInactive") includeInactive?: string) {
    return this.marketsService.list(includeInactive === "true");
  }

  @Get("markets/:id")
  get(@Param("id") id: string) {
    return this.marketsService.get(id);
  }

  @Post("admin/markets")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateMarketDto) {
    return this.marketsService.create(dto);
  }

  @Patch("admin/markets/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateMarketDto) {
    return this.marketsService.update(id, dto);
  }

  @Delete("admin/markets/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param("id") id: string) {
    return this.marketsService.deactivate(id);
  }
}
