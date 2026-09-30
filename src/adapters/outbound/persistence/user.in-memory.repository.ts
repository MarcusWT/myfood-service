import { User } from '../../../core/domain/user.js';
import { UserRepositoryPort } from '../../../core/ports/outbound/user-repository.port.js';

function clone(user: User): User {
  return { ...user };
}

/**
 * In-memory implementation of UserRepositoryPort, intended for fast,
 * isolated tests and as a DB_PATH=:memory: fallback for local development.
 */
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    const match = Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === needle,
    );
    return match ? clone(match) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async create(user: User): Promise<User> {
    this.users.set(user.id, clone(user));
    return clone(user);
  }

  async listAll(): Promise<User[]> {
    return Array.from(this.users.values()).map(clone);
  }

  /**
   * Test-only helper to reset repository state between tests without
   * constructing a new instance.
   */
  clear(): void {
    this.users.clear();
  }
}
