import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RankingResponseDto } from "../common/dto/api-models.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types/auth-user";
import { RankingsService } from "./rankings.service";

@Controller()
@ApiTags("Rankings")
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get("rankings")
  @ApiOkResponse({ type: RankingResponseDto, isArray: true })
  list(@Query("includeAi") includeAi?: string) {
    return this.rankingsService.list(undefined, includeAi !== "false");
  }

  @Get("rankings/season/:seasonId")
  @ApiOkResponse({ type: RankingResponseDto, isArray: true })
  listBySeason(@Param("seasonId") seasonId: string, @Query("includeAi") includeAi?: string) {
    return this.rankingsService.list(seasonId, includeAi !== "false");
  }

  @Get("rankings/me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RankingResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.rankingsService.getMyRanking(user.id);
  }
}
