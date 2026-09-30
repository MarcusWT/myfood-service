import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem, registerTestUser } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';
import type { RecipeProviderPort } from '../../../../core/ports/outbound/recipe-provider.port.js';
import type { Recipe } from '../../../../core/domain/recipe.js';

function makeRecipe(overrides?: Partial<Recipe>): Recipe {
  return {
    id: 1,
    title: 'Omelette',
    readyInMinutes: 10,
    servings: 2,
    usedIngredients: [],
    missedIngredients: [],
    matchScore: 100,
    ...overrides,
  };
}

describe('RecipeController (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;
  let recipeProvider: RecipeProviderPort;
  let authHeader: string;
  let userId: string;

  beforeEach(async () => {
    recipeProvider = { findByIngredients: vi.fn().mockResolvedValue([makeRecipe()]) };
    ({ app, repo } = buildTestApp(recipeProvider));
    ({ userId, authHeader } = await registerTestUser(app));
  });

  describe('GET /api/v1/recipes/suggestions', () => {
    it('returns an empty array when there are no food items', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/suggestions')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(recipeProvider.findByIngredients).not.toHaveBeenCalled();
    });

    it('returns suggestions from the recipe provider using available ingredient names', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        userId,
        name: 'Eggs',
        bestBefore: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      });

      const res = await request(app)
        .get('/api/v1/recipes/suggestions')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([makeRecipe()]);
      expect(recipeProvider.findByIngredients).toHaveBeenCalledWith(['Eggs'], 5);
    });

    it('passes the limit query param through to the recipe provider', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        userId,
        name: 'Eggs',
        bestBefore: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      });

      const res = await request(app)
        .get('/api/v1/recipes/suggestions')
        .query({ limit: 2 })
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(recipeProvider.findByIngredients).toHaveBeenCalledWith(['Eggs'], 2);
    });

    it('returns 400 when limit exceeds the maximum', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/suggestions')
        .query({ limit: 21 })
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when limit is not positive', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/suggestions')
        .query({ limit: 0 })
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
    });
  });
});
