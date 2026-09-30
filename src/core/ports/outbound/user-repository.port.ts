import { User } from '../../domain/user.js';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
  /**
   * Lists all registered users. Used by cross-user background jobs (e.g.
   * the notification poller) that need to fan out per-user work.
   */
  listAll(): Promise<User[]>;
}
