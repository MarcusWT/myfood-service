import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { createRouter } from './router.js';
import { errorHandler } from './error-handler.js';
import { requestLogger } from './request-logger.middleware.js';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';
import { AuthController } from './auth.controller.js';
import { generateOpenApiDocument } from './openapi/spec.js';
import { AuthServicePort } from '../../../core/ports/inbound/auth.port.js';
import { HealthCheckPort } from '../../../core/ports/outbound/health-check.port.js';

export function createApp(
  foodItemController: FoodItemController,
  expiryAlertController: ExpiryAlertController,
  recipeController: RecipeController,
  shoppingSummaryController: ShoppingSummaryController,
  authController: AuthController,
  authService: AuthServicePort,
  healthCheckPort: HealthCheckPort,
): Application {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'myfood-service', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req, res) => {
    let ready: boolean;
    try {
      ready = await healthCheckPort.checkReadiness();
    } catch {
      // Defensive: checkReadiness() implementations are expected to catch
      // their own failures and resolve `false`, but Express 4 does not
      // automatically handle rejected promises in async route handlers —
      // an unhandled rejection here could crash the process. Treat any
      // unexpected throw as "not ready" rather than letting it propagate.
      ready = false;
    }
    if (!ready) {
      res.status(503).json({
        status: 'error',
        service: 'myfood-service',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ status: 'ok', service: 'myfood-service', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', createRouter(
    foodItemController,
    expiryAlertController,
    recipeController,
    shoppingSummaryController,
    authController,
    authService,
  ));

  app.get('/api/docs.json', (_req, res) => {
    res.json(generateOpenApiDocument());
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: '/api/docs.json' },
    }),
  );

  app.use(errorHandler);

  return app;
}
