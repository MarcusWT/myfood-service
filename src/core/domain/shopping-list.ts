import { z } from 'zod';
import { CategorySchema, UnitSchema } from './value-objects.js';

const MAX_QUANTITY = 100_000;

export const MAX_SHOPPING_LIST_ITEMS = 500;

export const ShoppingListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(MAX_QUANTITY).optional(),
  unit: UnitSchema.optional(),
  category: CategorySchema.default('OTHER'),
  checked: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

export const CreateShoppingListItemSchema = ShoppingListItemSchema.omit({
  id: true,
  userId: true,
  checked: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateShoppingListItemInput = z.infer<typeof CreateShoppingListItemSchema>;

export const UpdateShoppingListItemSchema = CreateShoppingListItemSchema.partial()
  .extend({ checked: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateShoppingListItemInput = z.infer<typeof UpdateShoppingListItemSchema>;
