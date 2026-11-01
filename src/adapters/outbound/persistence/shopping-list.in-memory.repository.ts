import { ShoppingListItem, UpdateShoppingListItemInput } from '../../../core/domain/shopping-list.js';
import { ShoppingListRepositoryPort } from '../../../core/ports/outbound/shopping-list.repository.port.js';

export class InMemoryShoppingListRepository implements ShoppingListRepositoryPort {
  private readonly items = new Map<string, ShoppingListItem>();

  async findAll(userId: string): Promise<ShoppingListItem[]> {
    return [...this.items.values()]
      .filter((i) => i.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((i) => ({ ...i }));
  }

  async findById(userId: string, id: string): Promise<ShoppingListItem | null> {
    const i = this.items.get(id);
    return i && i.userId === userId ? { ...i } : null;
  }

  async create(item: ShoppingListItem): Promise<ShoppingListItem> {
    this.items.set(item.id, { ...item });
    return { ...item };
  }

  async createIfUnderLimit(item: ShoppingListItem, max: number): Promise<ShoppingListItem | null> {
    const n = [...this.items.values()].filter((i) => i.userId === item.userId).length;
    if (n >= max) return null;
    this.items.set(item.id, { ...item });
    return { ...item };
  }

  async createManyIfUnderLimit(
    items: ShoppingListItem[],
    max: number,
  ): Promise<ShoppingListItem[] | null> {
    if (items.length === 0) return [];
    const n = [...this.items.values()].filter((i) => i.userId === items[0].userId).length;
    if (n + items.length > max) return null;
    for (const item of items) this.items.set(item.id, { ...item });
    return items.map((i) => ({ ...i }));
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem | null> {
    const cur = this.items.get(id);
    if (!cur || cur.userId !== userId) return null;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next: ShoppingListItem = { ...cur, ...defined, updatedAt: new Date() };
    this.items.set(id, next);
    return { ...next };
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const cur = this.items.get(id);
    if (!cur || cur.userId !== userId) return false;
    return this.items.delete(id);
  }

  async deleteChecked(userId: string): Promise<number> {
    let n = 0;
    for (const [id, i] of this.items) {
      if (i.userId === userId && i.checked) {
        this.items.delete(id);
        n += 1;
      }
    }
    return n;
  }

  async countByUser(userId: string): Promise<number> {
    return [...this.items.values()].filter((i) => i.userId === userId).length;
  }
}
