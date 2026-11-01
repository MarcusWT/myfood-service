import { Router } from 'express';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';
import { DisposalHistoryController } from './disposal-history.controller.js';
import { AuthController } from './auth.controller.js';
import { ShelfLifeController } from './shelf-life.controller.js';
import { ExportController } from './export.controller.js';
import { ShoppingListController } from './shopping-list.controller.js';
import { SettingsController } from './settings.controller.js';
import { FavoriteRecipeController } from './favorite-recipe.controller.js';
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
  disposalHistoryController: DisposalHistoryController,
  shelfLifeController: ShelfLifeController,
  exportController: ExportController,
  shoppingListController: ShoppingListController,
  settingsController: SettingsController,
  favoriteRecipeController: FavoriteRecipeController,
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
  // Static paths must stay above '/food-items/:id' or they get captured as ids.
  router.get('/food-items/history', requireAuth, disposalHistoryController.listHistory);
  router.get('/food-items/export', requireAuth, exportController.exportItems);
  router.get('/food-items/shelf-life', requireAuth, shelfLifeController.getSuggestion);
  router.get('/food-items/shelf-life/table', requireAuth, shelfLifeController.getTable);
  router.get('/food-items/:id', requireAuth, foodItemController.getItem);
  router.patch('/food-items/:id', requireAuth, foodItemController.updateItem);
  router.post('/food-items/:id/dispose', requireAuth, foodItemController.disposeItem);
  router.post('/food-items/:id/consume', requireAuth, foodItemController.consumeItem);
  router.post('/food-items/:id/restore', requireAuth, foodItemController.restoreItem);
  router.delete('/food-items/:id', requireAuth, foodItemController.removeItem);

  // Expiry Alerts
  router.get('/alerts/expiry', requireAuth, expiryAlertController.getAlerts);

  // User settings
  router.get('/settings', requireAuth, settingsController.getSettings);
  router.put('/settings', requireAuth, settingsController.updateSettings);

  // Favourite recipes (static '/recipes/favorites' paths must stay above any '/recipes/:x' route)
  router.get('/recipes/favorites', requireAuth, favoriteRecipeController.list);
  router.put('/recipes/favorites/:recipeId', requireAuth, favoriteRecipeController.add);
  router.delete('/recipes/favorites/:recipeId', requireAuth, favoriteRecipeController.remove);

  // Recipe Suggestions
  router.get(
    '/recipes/suggestions',
    requireAuth,
    recipeRateLimiter,
    recipeController.getSuggestions,
  );

  // Shopping Summary
  router.get('/shopping/summary', requireAuth, shoppingSummaryController.getSummary);

  // Stats
  router.get('/stats/waste', requireAuth, disposalHistoryController.getWasteStats);

  // Persisted shopping list (static paths before '/:id')
  router.get('/shopping/list', requireAuth, shoppingListController.list);
  router.post('/shopping/list', requireAuth, shoppingListController.create);
  router.post('/shopping/list/import', requireAuth, shoppingListController.importFromSummary);
  router.post('/shopping/list/clear-checked', requireAuth, shoppingListController.clearChecked);
  router.patch('/shopping/list/:id', requireAuth, shoppingListController.update);
  router.delete('/shopping/list/:id', requireAuth, shoppingListController.remove);

  return router;
}
