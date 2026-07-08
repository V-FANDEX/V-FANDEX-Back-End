import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ConditionalOrderResponseDto } from "../common/dto/api-models.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types/auth-user";
import { ConditionalOrdersService } from "./conditional-orders.service";
import { CreateConditionalOrderDto } from "./dto/create-conditional-order.dto";

@Controller("conditional-orders")
@ApiTags("Conditional Orders")
export class ConditionalOrdersController {
  constructor(private readonly conditionalOrdersService: ConditionalOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ConditionalOrderResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConditionalOrderDto) {
    return this.conditionalOrdersService.create(user.id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConditionalOrderResponseDto, isArray: true })
  mine(@CurrentUser() user: AuthUser) {
    return this.conditionalOrdersService.listMine(user.id);
  }

  @Patch(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConditionalOrderResponseDto })
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.conditionalOrdersService.cancel(user.id, id);
  }
}
