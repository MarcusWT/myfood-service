import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { logger } from './logger.js';

// Ports
import type { FoodItemRepositoryPort } from './core/ports/outbound/food-item.repository.port.js';
import type { UserRepositoryPort } from './core/ports/outbound/user-repository.port.js';
import type { HealthCheckPort } from './core/ports/outbound/health-check.port.js';

// Outbound adapters
import { SqliteFoodItemRepository } from './adapters/outbound/persistence/food-item.sqlite.repository.js';
import { InMemoryFoodItemRepository } from './adapters/outbound/persistence/food-item.in-memory.repository.js';
import { SqliteUserRepository } from './adapters/outbound/persistence/user.sqlite.repository.js';
import { InMemoryUserRepository } from './adapters/outbound/persistence/user.in-memory.repository.js';
import { SqliteHealthCheckAdapter } from './adapters/outbound/persistence/health-check.sqlite.adapter.js';
import { InMemoryHealthCheckAdapter } from './adapters/outbound/persistence/health-check.in-memory.adapter.js';
import { SpoonacularRecipeAdapter } from './adapters/outbound/recipe-provider/spoonacular.adapter.js';
import { ConsoleNotificationAdapter } from './adapters/outbound/notification/console-notification.adapter.js';

// Application services
import { FoodItemService } from './application/food-item.service.js';
import { ExpiryAlertService } from './application/expiry-alert.service.js';
import { RecipeService } from './application/recipe.service.js';
import { ShoppingSummaryService } from './application/shopping-summary.service.js';
import { NotificationPoller } from './application/notification-poller.js';
import { AuthService } from './application/auth.service.js';

// Inbound adapters (HTTP)
import { FoodItemController } from './adapters/inbound/http/food-item.controller.js';
import { ExpiryAlertController } from './adapters/inbound/http/expiry-alert.controller.js';
import { RecipeController } from './adapters/inbound/http/recipe.controller.js';
import { ShoppingSummaryController } from './adapters/inbound/http/shopping-summary.controller.js';
import { AuthController } from './adapters/inbound/http/auth.controller.js';
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
const userRepository: UserRepositoryPort =
  config.dbPath === ':memory:'
    ? new InMemoryUserRepository()
    : new SqliteUserRepository(config.dbPath);
const healthCheckPort: HealthCheckPort =
  config.dbPath === ':memory:' || !(foodItemRepository instanceof SqliteFoodItemRepository)
    ? new InMemoryHealthCheckAdapter()
    : new SqliteHealthCheckAdapter(foodItemRepository.getConnection());
const recipeProvider = new SpoonacularRecipeAdapter(config.spoonacularApiKey);

const foodItemService = new FoodItemService(foodItemRepository);
const expiryAlertService = new ExpiryAlertService(foodItemRepository);
const recipeService = new RecipeService(foodItemRepository, recipeProvider);
const shoppingSummaryService = new ShoppingSummaryService(foodItemRepository);
const authService = new AuthService(userRepository, config.jwtSecret, config.jwtExpiresIn);

const foodItemController = new FoodItemController(foodItemService);
const expiryAlertController = new ExpiryAlertController(expiryAlertService);
const recipeController = new RecipeController(recipeService);
const shoppingSummaryController = new ShoppingSummaryController(shoppingSummaryService);
const authController = new AuthController(authService);

const app = createApp(
  foodItemController,
  expiryAlertController,
  recipeController,
  shoppingSummaryController,
  authController,
  authService,
  healthCheckPort,
);

const notificationPort = new ConsoleNotificationAdapter();
const notificationPoller = new NotificationPoller(
  expiryAlertService,
  notificationPort,
  userRepository,
  config.notificationPollIntervalMs,
  config.notificationWithinDays,
);

if (config.nodeEnv !== 'test') {
  notificationPoller.start();
}

process.on('SIGTERM', () => notificationPoller.stop());
process.on('SIGINT', () => notificationPoller.stop());

app.listen(config.port, () => {
  logger.info(`[MYFood Service] Listening on port ${config.port}`);
  logger.info(`[MYFood Service] Database: ${config.dbPath}`);
  logger.info(`[MYFood Service] Health: http://localhost:${config.port}/health`);
});
