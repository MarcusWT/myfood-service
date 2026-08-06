import path from 'path';
import fs from 'fs';
import { config } from './config.js';

// Ports
import type { FoodItemRepositoryPort } from './core/ports/outbound/food-item.repository.port.js';

// Outbound adapters
import { SqliteFoodItemRepository } from './adapters/outbound/persistence/food-item.sqlite.repository.js';
import { InMemoryFoodItemRepository } from './adapters/outbound/persistence/food-item.in-memory.repository.js';
import { SpoonacularRecipeAdapter } from './adapters/outbound/recipe-provider/spoonacular.adapter.js';

// Application services
import { FoodItemService } from './application/food-item.service.js';
import { ExpiryAlertService } from './application/expiry-alert.service.js';
import { RecipeService } from './application/recipe.service.js';
import { ShoppingSummaryService } from './application/shopping-summary.service.js';

// Inbound adapters (HTTP)
import { FoodItemController } from './adapters/inbound/http/food-item.controller.js';
import { ExpiryAlertController } from './adapters/inbound/http/expiry-alert.controller.js';
import { RecipeController } from './adapters/inbound/http/recipe.controller.js';
import { ShoppingSummaryController } from './adapters/inbound/http/shopping-summary.controller.js';
import { createApp } from './adapters/inbound/http/app.js';

// Ensure data directory exists (not applicable for the in-memory repository)
if (config.dbPath !== ':memory:') {
  const dataDir = path.dirname(config.dbPath);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Wire up the hexagon
const foodItemRepository: FoodItemRepositoryPort =
  config.dbPath === ':memory:'
    ? new InMemoryFoodItemRepository()
    : new SqliteFoodItemRepository(config.dbPath);
const recipeProvider = new SpoonacularRecipeAdapter(config.spoonacularApiKey);

const foodItemService = new FoodItemService(foodItemRepository);
const expiryAlertService = new ExpiryAlertService(foodItemRepository);
const recipeService = new RecipeService(foodItemRepository, recipeProvider);
const shoppingSummaryService = new ShoppingSummaryService(foodItemRepository);

const foodItemController = new FoodItemController(foodItemService);
const expiryAlertController = new ExpiryAlertController(expiryAlertService);
const recipeController = new RecipeController(recipeService);
const shoppingSummaryController = new ShoppingSummaryController(shoppingSummaryService);

const app = createApp(
  foodItemController,
  expiryAlertController,
  recipeController,
  shoppingSummaryController,
);

app.listen(config.port, () => {
  console.log(`[MYFood Service] Listening on port ${config.port}`);
  console.log(`[MYFood Service] Database: ${config.dbPath}`);
  console.log(`[MYFood Service] Health: http://localhost:${config.port}/health`);
});
