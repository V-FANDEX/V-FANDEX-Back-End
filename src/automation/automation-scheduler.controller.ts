import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AutomationTickResponseDto } from "../common/dto/api-models.dto";
import { SchedulerSecretGuard } from "../common/guards/scheduler-secret.guard";
import { AutomationSchedulerService } from "./automation-scheduler.service";

@Controller("internal/scheduler")
@UseGuards(SchedulerSecretGuard)
@ApiTags("Internal Scheduler")
export class AutomationSchedulerController {
  constructor(
    private readonly automationSchedulerService: AutomationSchedulerService,
  ) {}

  @Post("tick")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: "x-scheduler-secret", required: true })
  @ApiOkResponse({ type: AutomationTickResponseDto })
  tick() {
    return this.automationSchedulerService.tick("EXTERNAL");
  }
}
