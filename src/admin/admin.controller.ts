import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { AdminDashboardResponseDto, RankingResponseDto, UserResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminService } from "./admin.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiTags("Admin")
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("dashboard")
  @ApiOkResponse({ type: AdminDashboardResponseDto })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get("users")
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  users(@Query("role") role?: Role) {
    return this.adminService.listUsers(role);
  }

  @Patch("users/:id")
  @ApiOkResponse({ type: UserResponseDto })
  updateUser(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Post("rankings/recalculate")
  @ApiOkResponse({ type: RankingResponseDto, isArray: true })
  recalculateRankings() {
    return this.adminService.recalculateRankings();
  }
}
