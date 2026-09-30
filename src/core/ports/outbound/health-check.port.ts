/**
 * Outbound port for a deep readiness check — verifies that the underlying
 * persistence connection is actually usable (as opposed to `/health`, which
 * is a static liveness check with no dependency verification).
 */
export interface HealthCheckPort {
  /**
   * Resolves `true` if the persistence layer is reachable and can serve a
   * trivial query, `false` otherwise. Implementations should not throw —
   * failures are reported via the boolean result so callers can respond
   * with an appropriate HTTP status (e.g. 503) without needing try/catch.
   */
  checkReadiness(): Promise<boolean>;
}
