import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath
} from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { ChartBucketResponseDto, PriceHistoryResponseDto, StockResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateStockDto } from "./dto/create-stock.dto";
import { UpdateListingStatusDto } from "./dto/update-listing-status.dto";
import { UpdateStockDto } from "./dto/update-stock.dto";
import { StocksService } from "./stocks.service";

@Controller()
@ApiTags("Stocks")
@ApiExtraModels(PriceHistoryResponseDto, ChartBucketResponseDto)
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get("stocks")
  @ApiOkResponse({ type: StockResponseDto, isArray: true })
  list(
    @Query("marketId") marketId?: string,
    @Query("includeUnlisted") includeUnlisted?: string,
    @Query("search") search?: string
  ) {
    return this.stocksService.list({ marketId, includeUnlisted: includeUnlisted === "true", search });
  }

  @Get("stocks/:id")
  @ApiOkResponse({ type: StockResponseDto })
  get(@Param("id") id: string) {
    return this.stocksService.get(id);
  }

  @Get("stocks/:id/chart")
  @ApiOkResponse({
    schema: {
      oneOf: [
        { type: "array", items: { $ref: getSchemaPath(PriceHistoryResponseDto) } },
        { type: "array", items: { $ref: getSchemaPath(ChartBucketResponseDto) } }
      ]
    }
  })
  chart(
    @Param("id") id: string,
    @Query("take") take?: string,
    @Query("interval") interval?: string,
    @Query("range") range?: string
  ) {
    return this.stocksService.chartData(id, {
      take: take ? Number(take) : 200,
      interval: interval ?? range
    });
  }

  @Get("markets/:marketId/stocks")
  @ApiOkResponse({ type: StockResponseDto, isArray: true })
  listByMarket(@Param("marketId") marketId: string, @Query("includeUnlisted") includeUnlisted?: string) {
    return this.stocksService.list({ marketId, includeUnlisted: includeUnlisted === "true" });
  }

  @Get("admin/stocks")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: StockResponseDto, isArray: true })
  adminList(
    @Query("marketId") marketId?: string,
    @Query("includeUnlisted") includeUnlisted?: string,
    @Query("search") search?: string
  ) {
    return this.stocksService.list({ marketId, includeUnlisted: includeUnlisted !== "false", search });
  }

  @Post("admin/stocks")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: StockResponseDto })
  create(@Body() dto: CreateStockDto) {
    return this.stocksService.create(dto);
  }

  @Patch("admin/stocks/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: StockResponseDto })
  update(@Param("id") id: string, @Body() dto: UpdateStockDto) {
    return this.stocksService.update(id, dto);
  }

  @Patch("admin/stocks/:id/listing-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: StockResponseDto })
  updateListingStatus(@Param("id") id: string, @Body() dto: UpdateListingStatusDto) {
    return this.stocksService.updateListingStatus(id, dto);
  }
}
