import { Router } from 'express';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';
import { AuthController } from './auth.controller.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { AuthServicePort } from '../../../core/ports/inbound/auth.port.js';

export function createRouter(
  foodItemController: FoodItemController,
  expiryAlertController: ExpiryAlertController,
  recipeController: RecipeController,
  shoppingSummaryController: ShoppingSummaryController,
  authController: AuthController,
  authService: AuthServicePort,
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Auth (public)
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);

  // Food Items
  router.post('/food-items', requireAuth, foodItemController.addItem);
  router.get('/food-items', requireAuth, foodItemController.listItems);
  router.get('/food-items/:id', requireAuth, foodItemController.getItem);
  router.patch('/food-items/:id', requireAuth, foodItemController.updateItem);
  router.delete('/food-items/:id', requireAuth, foodItemController.removeItem);

  // Expiry Alerts
  router.get('/alerts/expiry', requireAuth, expiryAlertController.getAlerts);

  // Recipe Suggestions
  router.get('/recipes/suggestions', requireAuth, recipeController.getSuggestions);

  // Shopping Summary
  router.get('/shopping/summary', requireAuth, shoppingSummaryController.getSummary);

  return router;
}
