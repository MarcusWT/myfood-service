import { Router } from 'express';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';
import { AuthController } from './auth.controller.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { createAuthRateLimiter, createRecipeRateLimiter } from './middleware/rate-limit.middleware.js';
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
  const authRateLimiter = createAuthRateLimiter();
  const recipeRateLimiter = createRecipeRateLimiter();

  // Auth (public)
  router.post('/auth/register', authRateLimiter, authController.register);
  router.post('/auth/login', authRateLimiter, authController.login);
  router.get('/auth/me', requireAuth, authController.me);

  // Food Items
  router.post('/food-items', requireAuth, foodItemController.addItem);
  router.get('/food-items', requireAuth, foodItemController.listItems);
  router.get('/food-items/:id', requireAuth, foodItemController.getItem);
  router.patch('/food-items/:id', requireAuth, foodItemController.updateItem);
  router.post('/food-items/:id/dispose', requireAuth, foodItemController.disposeItem);
  router.delete('/food-items/:id', requireAuth, foodItemController.removeItem);

  // Expiry Alerts
  router.get('/alerts/expiry', requireAuth, expiryAlertController.getAlerts);

  // Recipe Suggestions
  router.get(
    '/recipes/suggestions',
    requireAuth,
    recipeRateLimiter,
    recipeController.getSuggestions,
  );

  // Shopping Summary
  router.get('/shopping/summary', requireAuth, shoppingSummaryController.getSummary);

  return router;
}
