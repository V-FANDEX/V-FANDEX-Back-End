import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types/auth-user";
import { WatchlistService } from "./watchlist.service";

@Controller("watchlist")
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.watchlistService.listMine(user.id);
  }

  @Post(":stockId")
  @UseGuards(JwtAuthGuard)
  add(@CurrentUser() user: AuthUser, @Param("stockId") stockId: string) {
    return this.watchlistService.add(user.id, stockId);
  }

  @Delete(":stockId")
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: AuthUser, @Param("stockId") stockId: string) {
    return this.watchlistService.remove(user.id, stockId);
  }
}
