import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { RegisterInput, LoginInput, User, toPublicUser } from '../core/domain/user.js';
import { AuthServicePort, AuthResult } from '../core/ports/inbound/auth.port.js';
import { UserRepositoryPort } from '../core/ports/outbound/user-repository.port.js';
import { ConflictError } from './food-item.service.js';

const SALT_ROUNDS = 10;

// A precomputed bcrypt hash of a random, unknown value. Used to perform a
// dummy comparison when the email lookup fails, so that login takes roughly
// the same amount of time whether or not the account exists — preventing
// user enumeration via response timing.
const DUMMY_PASSWORD_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8n1r/Su/vYmLxYw1pPJqPqYA9U9Lty';

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

interface JwtPayload {
  sub: string;
}

export class AuthService implements AuthServicePort {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {
    if (!jwtSecret) {
      throw new Error(
        'AuthService requires a non-empty jwtSecret; refusing to sign/verify tokens with an empty secret.',
      );
    }
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(`A user with email '${input.email}' already exists`);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user: User = {
      id: uuidv4(),
      email: input.email,
      passwordHash,
      createdAt: new Date(),
    };
    const created = await this.userRepository.create(user);
    const token = this.signToken(created.id);
    return { token, user: toPublicUser(created) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(input.email);
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const valid = await bcrypt.compare(input.password, passwordHash);

    if (!user || !valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = this.signToken(user.id);
    return { token, user: toPublicUser(user) };
  }

  async verifyToken(token: string): Promise<string> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return payload.sub;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  private signToken(userId: string): string {
    return jwt.sign({ sub: userId }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}
