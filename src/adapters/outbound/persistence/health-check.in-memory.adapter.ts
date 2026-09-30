import { HealthCheckPort } from '../../../core/ports/outbound/health-check.port.js';

/**
 * Readiness check for the in-memory repository (used when
 * `DB_PATH=:memory:` or in tests). There's no real connection to verify, so
 * it always reports healthy.
 */
export class InMemoryHealthCheckAdapter implements HealthCheckPort {
  async checkReadiness(): Promise<boolean> {
    return true;
  }
}
