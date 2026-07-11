import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, ScenarioCreatedBy, ScenarioType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { UpdateScenarioAutomationSettingsDto } from "./dto/update-scenario-automation-settings.dto";

type AutomatedScenarioType =
  typeof ScenarioType.MAIN | typeof ScenarioType.SMALL;

interface RunScenarioOptions {
  force?: boolean;
}

@Injectable()
export class ScenarioAutomationService {
  private readonly logger = new Logger(ScenarioAutomationService.name);
  private readonly runningTypes = new Set<AutomatedScenarioType>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scenariosService: ScenariosService,
  ) {}

  getSettings() {
    return this.prisma.scenarioAutomationSetting.upsert({
      where: { id: "default" },
      create: {},
      update: {},
    });
  }

  async getStatus() {
    const now = new Date();
    const [settings, todayMainCount, todaySmallCount] = await Promise.all([
      this.getSettings(),
      this.countToday(ScenarioType.MAIN, now),
      this.countToday(ScenarioType.SMALL, now),
    ]);
    return {
      id: settings.id,
      isEnabled: settings.isEnabled,
      mainEnabled: settings.mainEnabled,
      smallEnabled: settings.smallEnabled,
      autoApply: settings.autoApply,
      mainMinIntervalHours: settings.mainMinIntervalHours,
      mainMaxIntervalHours: settings.mainMaxIntervalHours,
      smallMinIntervalMinutes: settings.smallMinIntervalMinutes,
      smallMaxIntervalMinutes: settings.smallMaxIntervalMinutes,
      dailyMainLimit: settings.dailyMainLimit,
      dailySmallLimit: settings.dailySmallLimit,
      retryDelayMinutes: settings.retryDelayMinutes,
      lastMainRunAt: settings.lastMainRunAt,
      nextMainRunAt: settings.nextMainRunAt,
      lastMainError: settings.lastMainError,
      lastMainErrorAt: settings.lastMainErrorAt,
      lastSmallRunAt: settings.lastSmallRunAt,
      nextSmallRunAt: settings.nextSmallRunAt,
      lastSmallError: settings.lastSmallError,
      lastSmallErrorAt: settings.lastSmallErrorAt,
      updatedAt: settings.updatedAt,
      todayMainCount,
      todaySmallCount,
      serverTime: now,
    };
  }

  async updateSettings(dto: UpdateScenarioAutomationSettingsDto) {
    const current = await this.getSettings();
    this.assertValidRanges(dto, current);

    const now = new Date();
    const nextMainRunAt = this.resolveNextMainRunAt(dto, current, now);
    const nextSmallRunAt = this.resolveNextSmallRunAt(dto, current, now);
    const data = {
      isEnabled: dto.isEnabled,
      mainEnabled: dto.mainEnabled,
      smallEnabled: dto.smallEnabled,
      autoApply: dto.autoApply,
      mainMinIntervalHours: dto.mainMinIntervalHours,
      mainMaxIntervalHours: dto.mainMaxIntervalHours,
      smallMinIntervalMinutes: dto.smallMinIntervalMinutes,
      smallMaxIntervalMinutes: dto.smallMaxIntervalMinutes,
      dailyMainLimit: dto.dailyMainLimit,
      dailySmallLimit: dto.dailySmallLimit,
      retryDelayMinutes: dto.retryDelayMinutes,
      nextMainRunAt,
      nextSmallRunAt,
    };

    await this.prisma.scenarioAutomationSetting.upsert({
      where: { id: "default" },
      create: data,
      update: data,
    });

    return this.getStatus();
  }

  async processDueScenarios() {
    const settings = await this.getSettings();
    const checkedAt = new Date();
    if (!settings.isEnabled) {
      return {
        ok: true,
        status: "DISABLED",
        checkedAt,
        results: [],
      };
    }

    const dueTypes: AutomatedScenarioType[] = [];
    if (
      settings.mainEnabled &&
      (!settings.nextMainRunAt || settings.nextMainRunAt <= checkedAt)
    ) {
      dueTypes.push(ScenarioType.MAIN);
    }
    if (
      settings.smallEnabled &&
      (!settings.nextSmallRunAt || settings.nextSmallRunAt <= checkedAt)
    ) {
      dueTypes.push(ScenarioType.SMALL);
    }

    const results = [];
    for (const type of dueTypes) {
      try {
        results.push(await this.runScenario(type));
      } catch (error) {
        results.push({
          type,
          status: "FAILED",
          error: this.errorMessage(error),
        });
      }
    }

    return {
      ok: results.every((result) => result?.status !== "FAILED"),
      status: dueTypes.length ? "PROCESSED" : "IDLE",
      checkedAt,
      results,
    };
  }

  runMainNow() {
    return this.runScenario(ScenarioType.MAIN, { force: true });
  }

  runSmallNow() {
    return this.runScenario(ScenarioType.SMALL, { force: true });
  }

  private async runScenario(
    type: AutomatedScenarioType,
    options: RunScenarioOptions = {},
  ) {
    if (this.runningTypes.has(type)) {
      return { type, status: "SKIPPED_ALREADY_RUNNING" };
    }

    const settings = await this.getSettings();
    const now = new Date();
    if (!options.force && !this.isRunnable(type, settings, now)) {
      return { type, status: "SKIPPED_NOT_DUE" };
    }

    this.runningTypes.add(type);
    let leaseAcquired = false;
    try {
      leaseAcquired = await this.acquireLease(
        type,
        now,
        Boolean(options.force),
      );
      if (!leaseAcquired) {
        return { type, status: "SKIPPED_LEASED" };
      }

      const dailyCount = await this.countToday(type, now);
      const dailyLimit =
        type === ScenarioType.MAIN
          ? settings.dailyMainLimit
          : settings.dailySmallLimit;
      if (!options.force && dailyCount >= dailyLimit) {
        const nextRunAt = this.nextUtcDayRun(now);
        await this.releaseLease(type, {
          nextRunAt,
          error: null,
          errorAt: null,
        });
        return {
          type,
          status: "SKIPPED_DAILY_LIMIT",
          dailyCount,
          dailyLimit,
          nextRunAt,
        };
      }

      const scenario = await this.scenariosService.generate(
        type,
        { prompt: this.promptFor(type) },
        ScenarioCreatedBy.SYSTEM,
      );

      let application: Awaited<ReturnType<ScenariosService["apply"]>> | null =
        null;
      let applyError: string | null = null;
      if (settings.autoApply) {
        try {
          application = await this.scenariosService.apply(scenario.id);
        } catch (error) {
          applyError = this.errorMessage(error);
          this.logger.error(
            `Automatic ${type} scenario apply failed: ${applyError}`,
          );
        }
      }

      const completedAt = new Date();
      const nextRunAt = this.nextRunFor(type, settings, completedAt);
      await this.completeRun(type, completedAt, nextRunAt, applyError);

      return {
        type,
        status: applyError ? "GENERATED_APPLY_FAILED" : "COMPLETED",
        scenario,
        autoApply: settings.autoApply,
        application,
        applyError,
        completedAt,
        nextRunAt,
      };
    } catch (error) {
      if (leaseAcquired) {
        try {
          await this.scheduleRetry(type, settings.retryDelayMinutes, error);
        } catch (retryError) {
          this.logger.error(
            `Could not schedule ${type} retry: ${this.errorMessage(retryError)}`,
          );
        }
      }
      throw error;
    } finally {
      this.runningTypes.delete(type);
    }
  }

  private isRunnable(
    type: AutomatedScenarioType,
    settings: Awaited<ReturnType<ScenarioAutomationService["getSettings"]>>,
    now: Date,
  ) {
    if (!settings.isEnabled) {
      return false;
    }

    if (type === ScenarioType.MAIN) {
      return (
        settings.mainEnabled &&
        (!settings.nextMainRunAt || settings.nextMainRunAt <= now)
      );
    }

    return (
      settings.smallEnabled &&
      (!settings.nextSmallRunAt || settings.nextSmallRunAt <= now)
    );
  }

  private async acquireLease(
    type: AutomatedScenarioType,
    now: Date,
    force: boolean,
  ) {
    const leaseUntil = new Date(now.getTime() + 10 * 60_000);
    if (type === ScenarioType.MAIN) {
      const conditions: Prisma.ScenarioAutomationSettingWhereInput[] = [
        { OR: [{ mainLeaseUntil: null }, { mainLeaseUntil: { lte: now } }] },
      ];
      if (!force) {
        conditions.push(
          { isEnabled: true, mainEnabled: true },
          { OR: [{ nextMainRunAt: null }, { nextMainRunAt: { lte: now } }] },
        );
      }

      const claimed = await this.prisma.scenarioAutomationSetting.updateMany({
        where: { id: "default", AND: conditions },
        data: { mainLeaseUntil: leaseUntil },
      });
      return claimed.count === 1;
    }

    const conditions: Prisma.ScenarioAutomationSettingWhereInput[] = [
      { OR: [{ smallLeaseUntil: null }, { smallLeaseUntil: { lte: now } }] },
    ];
    if (!force) {
      conditions.push(
        { isEnabled: true, smallEnabled: true },
        { OR: [{ nextSmallRunAt: null }, { nextSmallRunAt: { lte: now } }] },
      );
    }

    const claimed = await this.prisma.scenarioAutomationSetting.updateMany({
      where: { id: "default", AND: conditions },
      data: { smallLeaseUntil: leaseUntil },
    });
    return claimed.count === 1;
  }

  private completeRun(
    type: AutomatedScenarioType,
    completedAt: Date,
    nextRunAt: Date,
    applyError: string | null,
  ) {
    if (type === ScenarioType.MAIN) {
      return this.prisma.scenarioAutomationSetting.update({
        where: { id: "default" },
        data: {
          lastMainRunAt: completedAt,
          nextMainRunAt: nextRunAt,
          mainLeaseUntil: null,
          lastMainError: applyError,
          lastMainErrorAt: applyError ? completedAt : null,
        },
      });
    }

    return this.prisma.scenarioAutomationSetting.update({
      where: { id: "default" },
      data: {
        lastSmallRunAt: completedAt,
        nextSmallRunAt: nextRunAt,
        smallLeaseUntil: null,
        lastSmallError: applyError,
        lastSmallErrorAt: applyError ? completedAt : null,
      },
    });
  }

  private releaseLease(
    type: AutomatedScenarioType,
    values: {
      nextRunAt: Date;
      error: string | null;
      errorAt: Date | null;
    },
  ) {
    if (type === ScenarioType.MAIN) {
      return this.prisma.scenarioAutomationSetting.update({
        where: { id: "default" },
        data: {
          mainLeaseUntil: null,
          nextMainRunAt: values.nextRunAt,
          lastMainError: values.error,
          lastMainErrorAt: values.errorAt,
        },
      });
    }

    return this.prisma.scenarioAutomationSetting.update({
      where: { id: "default" },
      data: {
        smallLeaseUntil: null,
        nextSmallRunAt: values.nextRunAt,
        lastSmallError: values.error,
        lastSmallErrorAt: values.errorAt,
      },
    });
  }

  private scheduleRetry(
    type: AutomatedScenarioType,
    retryDelayMinutes: number,
    error: unknown,
  ) {
    const failedAt = new Date();
    return this.releaseLease(type, {
      nextRunAt: new Date(failedAt.getTime() + retryDelayMinutes * 60_000),
      error: this.errorMessage(error).slice(0, 1000),
      errorAt: failedAt,
    });
  }

  private async countToday(type: AutomatedScenarioType, now: Date) {
    return this.prisma.scenario.count({
      where: {
        type,
        createdBy: ScenarioCreatedBy.SYSTEM,
        createdAt: { gte: this.startOfUtcDay(now) },
      },
    });
  }

  private startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private nextUtcDayRun(date: Date) {
    const nextDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      ),
    );
    return new Date(nextDay.getTime() + this.randomInteger(5, 30) * 60_000);
  }

  private nextRunFor(
    type: AutomatedScenarioType,
    settings: Awaited<ReturnType<ScenarioAutomationService["getSettings"]>>,
    from: Date,
  ) {
    const intervalMinutes =
      type === ScenarioType.MAIN
        ? this.randomInteger(
            settings.mainMinIntervalHours,
            settings.mainMaxIntervalHours,
          ) * 60
        : this.randomInteger(
            settings.smallMinIntervalMinutes,
            settings.smallMaxIntervalMinutes,
          );
    return new Date(from.getTime() + intervalMinutes * 60_000);
  }

  private resolveNextMainRunAt(
    dto: UpdateScenarioAutomationSettingsDto,
    current: Awaited<ReturnType<ScenarioAutomationService["getSettings"]>>,
    now: Date,
  ) {
    if (dto.nextMainRunAt) {
      return new Date(dto.nextMainRunAt);
    }

    const enabled =
      (dto.isEnabled ?? current.isEnabled) &&
      (dto.mainEnabled ?? current.mainEnabled);
    const turnedOn =
      enabled &&
      ((!current.isEnabled && dto.isEnabled === true) ||
        (!current.mainEnabled && dto.mainEnabled === true) ||
        !current.nextMainRunAt);
    if (turnedOn) {
      return now;
    }

    if (
      (dto.mainMinIntervalHours !== undefined ||
        dto.mainMaxIntervalHours !== undefined) &&
      current.nextMainRunAt
    ) {
      return this.nextRunFor(
        ScenarioType.MAIN,
        {
          ...current,
          mainMinIntervalHours:
            dto.mainMinIntervalHours ?? current.mainMinIntervalHours,
          mainMaxIntervalHours:
            dto.mainMaxIntervalHours ?? current.mainMaxIntervalHours,
        },
        current.lastMainRunAt ?? now,
      );
    }

    return undefined;
  }

  private resolveNextSmallRunAt(
    dto: UpdateScenarioAutomationSettingsDto,
    current: Awaited<ReturnType<ScenarioAutomationService["getSettings"]>>,
    now: Date,
  ) {
    if (dto.nextSmallRunAt) {
      return new Date(dto.nextSmallRunAt);
    }

    const enabled =
      (dto.isEnabled ?? current.isEnabled) &&
      (dto.smallEnabled ?? current.smallEnabled);
    const turnedOn =
      enabled &&
      ((!current.isEnabled && dto.isEnabled === true) ||
        (!current.smallEnabled && dto.smallEnabled === true) ||
        !current.nextSmallRunAt);
    if (turnedOn) {
      return now;
    }

    if (
      (dto.smallMinIntervalMinutes !== undefined ||
        dto.smallMaxIntervalMinutes !== undefined) &&
      current.nextSmallRunAt
    ) {
      return this.nextRunFor(
        ScenarioType.SMALL,
        {
          ...current,
          smallMinIntervalMinutes:
            dto.smallMinIntervalMinutes ?? current.smallMinIntervalMinutes,
          smallMaxIntervalMinutes:
            dto.smallMaxIntervalMinutes ?? current.smallMaxIntervalMinutes,
        },
        current.lastSmallRunAt ?? now,
      );
    }

    return undefined;
  }

  private assertValidRanges(
    dto: UpdateScenarioAutomationSettingsDto,
    current: Awaited<ReturnType<ScenarioAutomationService["getSettings"]>>,
  ) {
    const mainMin = dto.mainMinIntervalHours ?? current.mainMinIntervalHours;
    const mainMax = dto.mainMaxIntervalHours ?? current.mainMaxIntervalHours;
    const smallMin =
      dto.smallMinIntervalMinutes ?? current.smallMinIntervalMinutes;
    const smallMax =
      dto.smallMaxIntervalMinutes ?? current.smallMaxIntervalMinutes;

    if (mainMin > mainMax) {
      throw new BadRequestException(
        "mainMinIntervalHours cannot be greater than mainMaxIntervalHours.",
      );
    }
    if (smallMin > smallMax) {
      throw new BadRequestException(
        "smallMinIntervalMinutes cannot be greater than smallMaxIntervalMinutes.",
      );
    }
  }

  private promptFor(type: AutomatedScenarioType) {
    if (type === ScenarioType.MAIN) {
      return "Create a major Korean-language market event with a broad, meaningful impact across relevant V-FANDEX markets.";
    }
    return "Create a concise Korean-language minor event affecting a focused set of V-FANDEX stocks or one market.";
  }

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : "Unknown scenario automation error.";
  }
}
