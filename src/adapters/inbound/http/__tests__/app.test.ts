import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, registerTestUser } from './test-app.js';
import { createApp } from '../app.js';
import { FoodItemController } from '../food-item.controller.js';
import { ExpiryAlertController } from '../expiry-alert.controller.js';
import { RecipeController } from '../recipe.controller.js';
import { ShoppingSummaryController } from '../shopping-summary.controller.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../../../../application/auth.service.js';
import { InMemoryUserRepository } from '../../../outbound/persistence/user.in-memory.repository.js';
import { InMemoryHealthCheckAdapter } from '../../../outbound/persistence/health-check.in-memory.adapter.js';
import type { FoodItemServicePort } from '../../../../core/ports/inbound/food-item.service.port.js';
import type { ExpiryAlertServicePort } from '../../../../core/ports/inbound/expiry-alert.service.port.js';
import type { RecipeServicePort } from '../../../../core/ports/inbound/recipe.service.port.js';
import type { ShoppingSummaryServicePort } from '../../../../core/ports/inbound/shopping-summary.service.port.js';
import type { HealthCheckPort } from '../../../../core/ports/outbound/health-check.port.js';
import { logger } from '../../../../logger.js';

describe('App (cross-cutting)', () => {
  describe('GET /health', () => {
    it('returns service status', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'myfood-service' });
      expect(res.body.timestamp).toEqual(expect.any(String));
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when the database is reachable', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'myfood-service' });
      expect(res.body.timestamp).toEqual(expect.any(String));
    });

    it('returns 503 when the database is unreachable', async () => {
      const failingHealthCheckPort: HealthCheckPort = {
        checkReadiness: vi.fn().mockResolvedValue(false),
      };
      const { app } = buildTestApp(undefined, failingHealthCheckPort);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: 'error', service: 'myfood-service' });
    });

    it('does not require authentication', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/health/ready');

      expect(res.status).not.toBe(401);
    });
  });

  describe('unmatched routes', () => {
    it('returns Express default 404 for unknown paths', async () => {
      const { app } = buildTestApp();

      const res = await request(app).get('/api/v1/does-not-exist');

      expect(res.status).toBe(404);
    });
  });

  describe('unhandled errors', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 500 with a generic message when a service throws an unexpected error', async () => {
      vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);

      const throwingFoodItemService: FoodItemServicePort = {
        addItem: vi.fn(),
        getItem: vi.fn(),
        listItems: vi.fn().mockRejectedValue(new Error('boom')),
        updateItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const noopExpiryAlertService: ExpiryAlertServicePort = { getAlerts: vi.fn() };
      const noopRecipeService: RecipeServicePort = { getSuggestions: vi.fn() };
      const noopShoppingSummaryService: ShoppingSummaryServicePort = { getSummary: vi.fn() };
      const authService = new AuthService(
        new InMemoryUserRepository(),
        'test-secret-not-for-production',
        '24h',
      );

      const app = createApp(
        new FoodItemController(throwingFoodItemService),
        new ExpiryAlertController(noopExpiryAlertService),
        new RecipeController(noopRecipeService),
        new ShoppingSummaryController(noopShoppingSummaryService),
        new AuthController(authService),
        authService,
        new InMemoryHealthCheckAdapter(),
      );

      const { authHeader } = await registerTestUser(app);

      const res = await request(app)
        .get('/api/v1/food-items')
        .set('Authorization', authHeader);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal Server Error' });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
