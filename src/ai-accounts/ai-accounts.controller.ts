import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { AiAccountResponseDto, TradeResponseDto } from "../common/dto/api-models.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AiAccountsService } from "./ai-accounts.service";
import { CreateAiAccountDto } from "./dto/create-ai-account.dto";
import { UpdateAiAccountDto } from "./dto/update-ai-account.dto";

@Controller("admin/ai-accounts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiTags("AI Accounts")
@ApiBearerAuth()
export class AiAccountsController {
  constructor(private readonly aiAccountsService: AiAccountsService) {}

  @Get()
  @ApiOkResponse({ type: AiAccountResponseDto, isArray: true })
  list() {
    return this.aiAccountsService.list();
  }

  @Post()
  @ApiCreatedResponse({ type: AiAccountResponseDto })
  create(@Body() dto: CreateAiAccountDto) {
    return this.aiAccountsService.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ type: AiAccountResponseDto })
  update(@Param("id") id: string, @Body() dto: UpdateAiAccountDto) {
    return this.aiAccountsService.update(id, dto);
  }

  @Delete(":id")
  @ApiOkResponse({ type: AiAccountResponseDto })
  deactivate(@Param("id") id: string) {
    return this.aiAccountsService.deactivate(id);
  }

  @Post(":id/run-trade")
  @ApiCreatedResponse({ type: TradeResponseDto })
  runTrade(@Param("id") id: string) {
    return this.aiAccountsService.runTrade(id);
  }
}
