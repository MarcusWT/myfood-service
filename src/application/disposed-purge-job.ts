import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import { logger } from '../logger.js';

const DAY_MS = 86_400_000;

export class DisposedPurgeJob {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private started = false;

  constructor(
    private readonly repository: FoodItemRepositoryPort,
    private readonly retentionDays: number,
    private readonly intervalMs: number,
    private readonly initialDelayMs: number = 60_000,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.schedule(this.initialDelayMs);
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.running) await this.running;
  }

  async runOnce(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
    const count = await this.repository.purgeDisposedBefore(cutoff);
    if (count > 0) logger.info({ count }, '[DisposedPurgeJob] Purged disposed items');
    return count;
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      this.running = this.runOnce()
        .then(() => undefined)
        .catch((err) => logger.error({ err }, '[DisposedPurgeJob] Purge failed'))
        .finally(() => {
          this.running = null;
          if (this.started) this.schedule(this.intervalMs);
        });
    }, delay);
    this.timer.unref?.();
  }
}
