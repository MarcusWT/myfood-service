import { describe, it, expect } from 'vitest';
import { CreateShoppingListItemSchema, UpdateShoppingListItemSchema } from '../shopping-list.js';

describe('shopping list schemas', () => {
  it('defaults category and trims name', () => {
    expect(CreateShoppingListItemSchema.parse({ name: '  Rice ' })).toEqual({ name: 'Rice', category: 'OTHER' });
  });
  it('rejects empty name and non-positive quantity', () => {
    expect(CreateShoppingListItemSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(CreateShoppingListItemSchema.safeParse({ name: 'a', quantity: 0 }).success).toBe(false);
  });
  it('rejects an empty patch and does not default category on patch', () => {
    expect(UpdateShoppingListItemSchema.safeParse({}).success).toBe(false);
    expect(UpdateShoppingListItemSchema.parse({ checked: true })).toEqual({ checked: true });
  });
});
