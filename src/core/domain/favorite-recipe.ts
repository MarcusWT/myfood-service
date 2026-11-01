import { z } from 'zod';

export const FavoriteRecipeInputSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    imageUrl: z.string().url().max(2000).optional(),
    sourceUrl: z.string().url().max(2000).optional(),
  })
  .strict();
export type FavoriteRecipeInput = z.infer<typeof FavoriteRecipeInputSchema>;

export interface FavoriteRecipe {
  recipeId: number;
  title: string;
  imageUrl?: string;
  sourceUrl?: string;
  createdAt: Date;
}
