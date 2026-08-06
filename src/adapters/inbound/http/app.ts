import express, { Application } from 'express';
import { createRouter } from './router.js';
import { errorHandler } from './error-handler.js';
import { requestLogger } from './request-logger.middleware.js';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';

export function createApp(
  foodItemController: FoodItemController,
  expiryAlertController: ExpiryAlertController,
  recipeController: RecipeController,
  shoppingSummaryController: ShoppingSummaryController,
): Application {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'myfood-service', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', createRouter(
    foodItemController,
    expiryAlertController,
    recipeController,
    shoppingSummaryController,
  ));

  app.use(errorHandler);

  return app;
}
