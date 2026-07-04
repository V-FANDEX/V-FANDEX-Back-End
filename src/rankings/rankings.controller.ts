import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types/auth-user";
import { RankingsService } from "./rankings.service";

@Controller()
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get("rankings")
  list(@Query("includeAi") includeAi?: string) {
    return this.rankingsService.list(undefined, includeAi !== "false");
  }

  @Get("rankings/season/:seasonId")
  listBySeason(@Param("seasonId") seasonId: string, @Query("includeAi") includeAi?: string) {
    return this.rankingsService.list(seasonId, includeAi !== "false");
  }

  @Get("rankings/me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.rankingsService.getMyRanking(user.id);
  }
}
