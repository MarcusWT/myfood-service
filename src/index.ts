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
import { createNotificationAdapter } from './adapters/outbound/notification/create-notification-adapter.js';
import type { UserSettingsRepositoryPort } from './core/ports/outbound/user-settings.repository.port.js';
import type { FavoriteRecipeRepositoryPort } from './core/ports/outbound/favorite-recipe.repository.port.js';
import { InMemoryUserSettingsRepository } from './adapters/outbound/persistence/user-settings.in-memory.repository.js';
import { SqliteUserSettingsRepository } from './adapters/outbound/persistence/user-settings.sqlite.repository.js';
import { InMemoryFavoriteRecipeRepository } from './adapters/outbound/persistence/favorite-recipe.in-memory.repository.js';
import { SqliteFavoriteRecipeRepository } from './adapters/outbound/persistence/favorite-recipe.sqlite.repository.js';
import { UserSettingsService } from './application/user-settings.service.js';
import { FavoriteRecipeService } from './application/favorite-recipe.service.js';
import { SettingsController } from './adapters/inbound/http/settings.controller.js';
import { FavoriteRecipeController } from './adapters/inbound/http/favorite-recipe.controller.js';

// Application services
import { FoodItemService } from './application/food-item.service.js';
import { ExpiryAlertService } from './application/expiry-alert.service.js';
import { RecipeService } from './application/recipe.service.js';
import { ShoppingSummaryService } from './application/shopping-summary.service.js';
import { NotificationPoller } from './application/notification-poller.js';
import { NotificationLogPort } from './core/ports/outbound/notification-log.port.js';
import { InMemoryNotificationLogRepository } from './adapters/outbound/persistence/notification-log.in-memory.repository.js';
import { SqliteNotificationLogRepository } from './adapters/outbound/persistence/notification-log.sqlite.repository.js';
import { DisposalHistoryService } from './application/disposal-history.service.js';
import { DisposedPurgeJob } from './application/disposed-purge-job.js';
import { DisposalHistoryController } from './adapters/inbound/http/disposal-history.controller.js';
import { AuthService } from './application/auth.service.js';

// Inbound adapters (HTTP)
import { FoodItemController } from './adapters/inbound/http/food-item.controller.js';
import { ExpiryAlertController } from './adapters/inbound/http/expiry-alert.controller.js';
import { RecipeController } from './adapters/inbound/http/recipe.controller.js';
import { ShoppingSummaryController } from './adapters/inbound/http/shopping-summary.controller.js';
import { AuthController } from './adapters/inbound/http/auth.controller.js';
import { ShelfLifeController } from './adapters/inbound/http/shelf-life.controller.js';
import { ExportController } from './adapters/inbound/http/export.controller.js';
import { ShoppingListController } from './adapters/inbound/http/shopping-list.controller.js';
import { ExportService } from './application/export.service.js';
import { ShoppingListService } from './application/shopping-list.service.js';
import type { ShoppingListRepositoryPort } from './core/ports/outbound/shopping-list.repository.port.js';
import { InMemoryShoppingListRepository } from './adapters/outbound/persistence/shopping-list.in-memory.repository.js';
import { SqliteShoppingListRepository } from './adapters/outbound/persistence/shopping-list.sqlite.repository.js';
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
const recipeProvider = new SpoonacularRecipeAdapter(config.spoonacularApiKey, {
  searchTimeoutMs: config.spoonacularTimeoutMs,
  enrichmentTimeoutMs: config.spoonacularEnrichmentTimeoutMs,
  searchTtlMs: config.recipeCacheTtlMs,
  searchCacheMaxEntries: config.recipeCacheMaxEntries,
});

const userSettingsRepository: UserSettingsRepositoryPort =
  config.dbPath === ':memory:'
    ? new InMemoryUserSettingsRepository()
    : new SqliteUserSettingsRepository(config.dbPath);
const favoriteRecipeRepository: FavoriteRecipeRepositoryPort =
  config.dbPath === ':memory:'
    ? new InMemoryFavoriteRecipeRepository()
    : new SqliteFavoriteRecipeRepository(config.dbPath);
const foodItemService = new FoodItemService(foodItemRepository, config.expiryAlertDefaultDays);
const expiryAlertService = new ExpiryAlertService(foodItemRepository, {
  settings: userSettingsRepository,
  defaultDays: config.expiryAlertDefaultDays,
});
const recipeService = new RecipeService(foodItemRepository, recipeProvider, {
  maxIngredients: config.recipeMaxIngredients,
  settings: userSettingsRepository,
  favorites: favoriteRecipeRepository,
  defaultAlertDays: config.expiryAlertDefaultDays,
});
const shoppingSummaryService = new ShoppingSummaryService(foodItemRepository);
const authService = new AuthService(userRepository, config.jwtSecret, config.jwtExpiresIn);

const foodItemController = new FoodItemController(foodItemService);
const expiryAlertController = new ExpiryAlertController(expiryAlertService);
const recipeController = new RecipeController(recipeService);
const shoppingSummaryController = new ShoppingSummaryController(shoppingSummaryService);
const authController = new AuthController(authService);
const disposalHistoryService = new DisposalHistoryService(foodItemRepository);
const disposalHistoryController = new DisposalHistoryController(disposalHistoryService);

const shoppingListRepository: ShoppingListRepositoryPort =
  config.dbPath === ':memory:'
    ? new InMemoryShoppingListRepository()
    : new SqliteShoppingListRepository(config.dbPath);
const shelfLifeController = new ShelfLifeController();
const exportController = new ExportController(new ExportService(foodItemRepository));
const shoppingListController = new ShoppingListController(
  new ShoppingListService(shoppingListRepository, foodItemRepository),
);

const settingsController = new SettingsController(new UserSettingsService(userSettingsRepository));
const favoriteRecipeController = new FavoriteRecipeController(
  new FavoriteRecipeService(favoriteRecipeRepository),
);

const app = createApp(
  foodItemController,
  expiryAlertController,
  recipeController,
  shoppingSummaryController,
  authController,
  authService,
  healthCheckPort,
  disposalHistoryController,
  shelfLifeController,
  exportController,
  shoppingListController,
  settingsController,
  favoriteRecipeController,
);

const notificationLog: NotificationLogPort =
  config.dbPath === ':memory:'
    ? new InMemoryNotificationLogRepository()
    : new SqliteNotificationLogRepository(config.dbPath);
const notificationPort = createNotificationAdapter(config, undefined, notificationLog);
const notificationPoller = new NotificationPoller(
  expiryAlertService,
  notificationPort,
  userRepository,
  notificationLog,
  config.notificationPollIntervalMs,
  config.notificationWithinDays,
);

if (config.nodeEnv !== 'test') {
  notificationPoller.start();
}

const disposedPurgeJob = new DisposedPurgeJob(
  foodItemRepository,
  config.disposedRetentionDays,
  config.disposedPurgeIntervalMs,
);
if (config.nodeEnv !== 'test' && config.disposedRetentionDays > 0) {
  disposedPurgeJob.start();
}

const server = app.listen(config.port, () => {
  logger.info(`[MYFood Service] Listening on port ${config.port}`);
  logger.info(`[MYFood Service] Database: ${config.dbPath}`);
  logger.info(`[MYFood Service] Health: http://localhost:${config.port}/health`);
});

function closeIfPossible(repo: unknown): void {
  if (repo !== null && typeof repo === 'object' && 'close' in repo && typeof (repo as { close: unknown }).close === 'function') {
    (repo as { close: () => void }).close();
  }
}

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) {
    logger.info(`[MYFood Service] Received ${signal} during shutdown, ignoring duplicate signal.`);
    return;
  }
  isShuttingDown = true;

  logger.info(`[MYFood Service] Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('[MYFood Service] Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref?.();

  const stopPoller = notificationPoller
    .stop()
    .catch((err) => logger.error({ err }, '[MYFood Service] Error while stopping poller'));
  const stopPurgeJob = disposedPurgeJob
    .stop()
    .catch((err) => logger.error({ err }, '[MYFood Service] Error while stopping purge job'));
  const closeServer = new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) {
        logger.error({ err }, '[MYFood Service] Error while closing HTTP server');
      } else {
        logger.info('[MYFood Service] HTTP server closed.');
      }
      resolve();
    });
  });

  void Promise.all([stopPoller, stopPurgeJob, closeServer]).then(() => {
    closeIfPossible(foodItemRepository);
    closeIfPossible(userRepository);
    closeIfPossible(shoppingListRepository);
    closeIfPossible(notificationLog);
    closeIfPossible(userSettingsRepository);
    closeIfPossible(favoriteRecipeRepository);
    logger.info('[MYFood Service] Database connections closed. Exiting.');

    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
