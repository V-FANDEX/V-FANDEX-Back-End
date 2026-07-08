import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { PortfolioResponseDto } from "../common/dto/api-models.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types/auth-user";
import { PortfolioService } from "./portfolio.service";

@Controller("portfolio")
@ApiTags("Portfolio")
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortfolioResponseDto })
  mine(@CurrentUser() user: AuthUser) {
    return this.portfolioService.getForUser(user.id);
  }

  @Get("users/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PortfolioResponseDto })
  byUser(@Param("userId") userId: string) {
    return this.portfolioService.getForUser(userId);
  }
}
