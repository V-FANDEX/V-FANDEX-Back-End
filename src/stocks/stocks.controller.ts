import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateStockDto } from "./dto/create-stock.dto";
import { UpdateListingStatusDto } from "./dto/update-listing-status.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";
import { StocksService } from "./stocks.service";

@Controller()
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get("stocks")
  list(
    @Query("marketId") marketId?: string,
    @Query("includeUnlisted") includeUnlisted?: string,
    @Query("search") search?: string
  ) {
    return this.stocksService.list({ marketId, includeUnlisted: includeUnlisted === "true", search });
  }

  @Get("stocks/:id")
  get(@Param("id") id: string) {
    return this.stocksService.get(id);
  }

  @Get("stocks/:id/chart")
  chart(@Param("id") id: string, @Query("take") take?: string) {
    return this.stocksService.chartData(id, take ? Number(take) : 200);
  }

  @Get("markets/:marketId/stocks")
  listByMarket(@Param("marketId") marketId: string, @Query("includeUnlisted") includeUnlisted?: string) {
    return this.stocksService.list({ marketId, includeUnlisted: includeUnlisted === "true" });
  }

  @Post("admin/stocks")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStockDto) {
    return this.stocksService.create(dto);
  }

  @Patch("admin/stocks/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateStockDto) {
    return this.stocksService.update(id, dto);
  }

  @Patch("admin/stocks/:id/listing-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateListingStatus(@Param("id") id: string, @Body() dto: UpdateListingStatusDto) {
    return this.stocksService.updateListingStatus(id, dto);
  }
}
