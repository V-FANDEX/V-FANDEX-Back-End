import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types/auth-user";
import { TradeRequestDto } from "./dto/trade-request.dto";
import { TradingService } from "./trading.service";

@Controller("trades")
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post("buy")
  @UseGuards(JwtAuthGuard)
  buy(@CurrentUser() user: AuthUser, @Body() dto: TradeRequestDto) {
    return this.tradingService.buy(user.id, dto);
  }

  @Post("sell")
  @UseGuards(JwtAuthGuard)
  sell(@CurrentUser() user: AuthUser, @Body() dto: TradeRequestDto) {
    return this.tradingService.sell(user.id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.tradingService.listForUser(user.id);
  }

  @Get("users/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  byUser(@CurrentUser() user: AuthUser, @Param("userId") userId: string) {
    return this.tradingService.listForUser(user.id, userId);
  }
}
