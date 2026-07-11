import { timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class SchedulerSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>("SCHEDULER_SECRET")?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        "SCHEDULER_SECRET is not configured.",
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-scheduler-secret")?.trim();
    if (!provided || !this.matches(provided, expected)) {
      throw new UnauthorizedException("Invalid scheduler secret.");
    }

    return true;
  }

  private matches(provided: string, expected: string) {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }
}
