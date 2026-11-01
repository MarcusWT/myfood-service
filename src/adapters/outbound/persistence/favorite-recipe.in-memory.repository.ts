import { FavoriteRecipe } from '../../../core/domain/favorite-recipe.js';
import { FavoriteRecipeRepositoryPort } from '../../../core/ports/outbound/favorite-recipe.repository.port.js';

export class InMemoryFavoriteRecipeRepository implements FavoriteRecipeRepositoryPort {
  private readonly store = new Map<string, Map<number, FavoriteRecipe>>();
  private seq = 0;
  private readonly order = new Map<string, number>();

  private bucket(userId: string): Map<number, FavoriteRecipe> {
    let b = this.store.get(userId);
    if (!b) this.store.set(userId, (b = new Map()));
    return b;
  }

  async list(userId: string): Promise<FavoriteRecipe[]> {
    const key = (f: FavoriteRecipe) => this.order.get(`${userId}:${f.recipeId}`) ?? 0;
    return [...this.bucket(userId).values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || key(b) - key(a))
      .map((f) => ({ ...f }));
  }

  async upsert(userId: string, favorite: FavoriteRecipe): Promise<FavoriteRecipe> {
    const b = this.bucket(userId);
    const existing = b.get(favorite.recipeId);
    const saved = { ...favorite, createdAt: existing?.createdAt ?? favorite.createdAt };
    b.set(favorite.recipeId, saved);
    if (!existing) this.order.set(`${userId}:${favorite.recipeId}`, ++this.seq);
    return { ...saved };
  }

  async remove(userId: string, recipeId: number): Promise<boolean> {
    this.order.delete(`${userId}:${recipeId}`);
    return this.bucket(userId).delete(recipeId);
  }

  async ids(userId: string): Promise<Set<number>> {
    return new Set(this.bucket(userId).keys());
  }
}
