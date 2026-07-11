import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DividendsService } from "../dividends/dividends.service";
import { MarketSimulationService } from "../market-simulation/market-simulation.service";
import { PriceMovementsService } from "../price-movements/price-movements.service";
import { ScenarioAutomationService } from "../scenario-automation/scenario-automation.service";

type AutomationSource = "INTERNAL" | "EXTERNAL";

@Injectable()
export class AutomationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AutomationSchedulerService.name);
  private scheduler?: NodeJS.Timeout;
  private isRunning = false;
  private lastSlowTickAt?: Date;

  constructor(
    private readonly dividendsService: DividendsService,
    private readonly marketSimulationService: MarketSimulationService,
    private readonly priceMovementsService: PriceMovementsService,
    private readonly scenarioAutomationService: ScenarioAutomationService,
  ) {}

  onModuleInit() {
    this.scheduler = setInterval(() => {
      void this.tick("INTERNAL");
    }, 10_000);
    void this.tick("INTERNAL");
  }

  onModuleDestroy() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
    }
  }

  async tick(source: AutomationSource = "INTERNAL") {
    const startedAt = new Date();
    if (this.isRunning) {
      return {
        ok: true,
        status: "SKIPPED_ALREADY_RUNNING",
        source,
        startedAt,
        completedAt: new Date(),
        tasks: [],
      };
    }

    this.isRunning = true;
    try {
      const tasks = [];
      tasks.push(await this.runTask("priceMovement", () => this.priceMovementsService.processScheduledMovements()));

      const runSlowTasks =
        source === "EXTERNAL" ||
        !this.lastSlowTickAt ||
        startedAt.getTime() - this.lastSlowTickAt.getTime() >= 60_000;
      if (runSlowTasks) {
        this.lastSlowTickAt = startedAt;
        tasks.push(
          await this.runTask("marketSimulation", () =>
            this.marketSimulationService.runSimulation(),
          ),
        );
        tasks.push(
          await this.runTask("scenarioAutomation", () =>
            this.scenarioAutomationService.processDueScenarios(),
          ),
        );
        tasks.push(
          await this.runTask("dividendPayout", () =>
            this.dividendsService.processScheduledDividends(),
          ),
        );
      }

      return {
        ok: tasks.every((task) => task.status !== "FAILED"),
        status: "COMPLETED",
        source,
        startedAt,
        completedAt: new Date(),
        tasks,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async runTask(name: string, task: () => Promise<unknown>) {
    try {
      const result = await task();
      return {
        name,
        status: result === null ? "IDLE" : "COMPLETED",
        result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Automation task failed.";
      this.logger.error(`${name}: ${message}`);
      return {
        name,
        status: "FAILED",
        error: message,
      };
    }
  }
}
