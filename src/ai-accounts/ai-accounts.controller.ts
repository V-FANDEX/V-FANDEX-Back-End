import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AiAccountsService } from "./ai-accounts.service";
import { CreateAiAccountDto } from "./dto/create-ai-account.dto";
import { UpdateAiAccountDto } from "./dto/update-ai-account.dto";

@Controller("admin/ai-accounts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AiAccountsController {
  constructor(private readonly aiAccountsService: AiAccountsService) {}

  @Get()
  list() {
    return this.aiAccountsService.list();
  }

  @Post()
  create(@Body() dto: CreateAiAccountDto) {
    return this.aiAccountsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAiAccountDto) {
    return this.aiAccountsService.update(id, dto);
  }

  @Delete(":id")
  deactivate(@Param("id") id: string) {
    return this.aiAccountsService.deactivate(id);
  }

  @Post(":id/run-trade")
  runTrade(@Param("id") id: string) {
    return this.aiAccountsService.runTrade(id);
  }
}
