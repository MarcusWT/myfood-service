import { vi } from 'vitest';
import { Application } from 'express';
import { createApp } from '../app.js';
import { FoodItemController } from '../food-item.controller.js';
import { ExpiryAlertController } from '../expiry-alert.controller.js';
import { RecipeController } from '../recipe.controller.js';
import { ShoppingSummaryController } from '../shopping-summary.controller.js';
import { FoodItemService } from '../../../../application/food-item.service.js';
import { ExpiryAlertService } from '../../../../application/expiry-alert.service.js';
import { RecipeService } from '../../../../application/recipe.service.js';
import { ShoppingSummaryService } from '../../../../application/shopping-summary.service.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';
import type { RecipeProviderPort } from '../../../../core/ports/outbound/recipe-provider.port.js';
import type { CreateFoodItemInput, FoodItem } from '../../../../core/domain/food-item.js';

/**
 * Hand-rolled fake RecipeProviderPort. Real recipe provider (Spoonacular) is
 * an external HTTP dependency and is out of scope for these integration
 * tests; controllers/services are wired against this fake instead.
 */
export function fakeRecipeProvider(): RecipeProviderPort {
  return {
    findByIngredients: vi.fn().mockResolvedValue([]),
  };
}

export interface TestApp {
  app: Application;
  repo: InMemoryFoodItemRepository;
  recipeProvider: RecipeProviderPort;
}

/**
 * Builds a real Express app (via createApp) wired to real application
 * services and a fresh InMemoryFoodItemRepository. This gives true
 * integration-level coverage of the HTTP layer without hitting SQLite or
 * external APIs.
 */
export function buildTestApp(recipeProvider: RecipeProviderPort = fakeRecipeProvider()): TestApp {
  const repo = new InMemoryFoodItemRepository();

  const foodItemService = new FoodItemService(repo);
  const expiryAlertService = new ExpiryAlertService(repo);
  const recipeService = new RecipeService(repo, recipeProvider);
  const shoppingSummaryService = new ShoppingSummaryService(repo);

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

  return { app, repo, recipeProvider };
}

/**
 * Fixture factory for a valid HTTP creation payload (dates as ISO strings,
 * matching what a real client would send as JSON).
 */
export function makeCreateFoodItemInput(
  overrides?: Partial<Record<keyof CreateFoodItemInput, unknown>>,
): Record<string, unknown> {
  return {
    name: 'Eggs',
    quantity: 12,
    unit: 'UNITS',
    location: 'FRIDGE',
    category: 'OTHER',
    bestBefore: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    ...overrides,
  };
}

/**
 * Seeds a food item directly into the repository (bypassing HTTP) so tests
 * can set up fixtures with precise control (e.g. arbitrary bestBefore dates).
 */
export async function seedFoodItem(
  repo: InMemoryFoodItemRepository,
  overrides?: Partial<FoodItem>,
): Promise<FoodItem> {
  const now = new Date('2026-08-01T00:00:00.000Z');
  const item: FoodItem = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Milk',
    quantity: 1,
    unit: 'LITRES',
    location: 'FRIDGE',
    category: 'DAIRY',
    bestBefore: new Date('2026-09-01T00:00:00.000Z'),
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
  return repo.save(item);
}
