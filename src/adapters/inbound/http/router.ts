import { Router } from 'express';
import { FoodItemController } from './food-item.controller.js';
import { ExpiryAlertController } from './expiry-alert.controller.js';
import { RecipeController } from './recipe.controller.js';
import { ShoppingSummaryController } from './shopping-summary.controller.js';

export function createRouter(
  foodItemController: FoodItemController,
  expiryAlertController: ExpiryAlertController,
  recipeController: RecipeController,
  shoppingSummaryController: ShoppingSummaryController,
): Router {
  const router = Router();

  // Food Items
  router.post('/food-items', foodItemController.addItem);
  router.get('/food-items', foodItemController.listItems);
  router.get('/food-items/:id', foodItemController.getItem);
  router.patch('/food-items/:id', foodItemController.updateItem);
  router.delete('/food-items/:id', foodItemController.removeItem);

  // Expiry Alerts
  router.get('/alerts/expiry', expiryAlertController.getAlerts);

  // Recipe Suggestions
  router.get('/recipes/suggestions', recipeController.getSuggestions);

  // Shopping Summary
  router.get('/shopping/summary', shoppingSummaryController.getSummary);

  return router;
}
