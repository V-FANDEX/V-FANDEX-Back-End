import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      status: "ok",
      service: "v-fandex-back-end",
      timestamp: new Date().toISOString()
    };
  }
}
