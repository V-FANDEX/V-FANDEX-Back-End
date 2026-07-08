import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { MarketResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateMarketDto } from "./dto/create-market.dto";
import { UpdateMarketDto } from "./dto/update-market.dto";
import { MarketsService } from "./markets.service";

@Controller()
@ApiTags("Markets")
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get("markets")
  @ApiOkResponse({ type: MarketResponseDto, isArray: true })
  list(@Query("includeInactive") includeInactive?: string) {
    return this.marketsService.list(includeInactive === "true");
  }

  @Get("markets/:id")
  @ApiOkResponse({ type: MarketResponseDto })
  get(@Param("id") id: string) {
    return this.marketsService.get(id);
  }

  @Get("admin/markets")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MarketResponseDto, isArray: true })
  adminList(@Query("includeInactive") includeInactive?: string) {
    return this.marketsService.list(includeInactive !== "false");
  }

  @Post("admin/markets")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MarketResponseDto })
  create(@Body() dto: CreateMarketDto) {
    return this.marketsService.create(dto);
  }

  @Patch("admin/markets/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MarketResponseDto })
  update(@Param("id") id: string, @Body() dto: UpdateMarketDto) {
    return this.marketsService.update(id, dto);
  }

  @Delete("admin/markets/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MarketResponseDto })
  deactivate(@Param("id") id: string) {
    return this.marketsService.deactivate(id);
  }
}
