import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService, UnauthorizedError } from '../auth.service.js';
import { ConflictError } from '../food-item.service.js';
import { InMemoryUserRepository } from '../../adapters/outbound/persistence/user.in-memory.repository.js';

const SECRET = 'test-secret-not-for-production';
const GOOD_OPTS: jwt.SignOptions = {
  algorithm: 'HS256',
  issuer: 'myfood-service',
  audience: 'myfood-api',
};

describe('AuthService', () => {
  let userRepository: InMemoryUserRepository;
  let service: AuthService;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    service = new AuthService(userRepository, 'test-secret-not-for-production', '1h');
  });

  it('throws if constructed with an empty jwtSecret', () => {
    expect(() => new AuthService(userRepository, '', '1h')).toThrow();
  });

  describe('register', () => {
    it('creates a new user and returns a token plus the public user', async () => {
      const result = await service.register({ email: 'alice@example.com', password: 'password123' });

      expect(result.token).toEqual(expect.any(String));
      expect(result.user.email).toBe('alice@example.com');
      expect(result.user.id).toEqual(expect.any(String));
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('stores a bcrypt hash, not the plaintext password', async () => {
      await service.register({ email: 'alice@example.com', password: 'password123' });

      const stored = await userRepository.findByEmail('alice@example.com');
      expect(stored?.passwordHash).not.toBe('password123');
      expect(stored?.passwordHash).toEqual(expect.any(String));
    });

    it('throws ConflictError when the email is already registered', async () => {
      await service.register({ email: 'alice@example.com', password: 'password123' });

      await expect(
        service.register({ email: 'alice@example.com', password: 'different123' }),
      ).rejects.toThrow(ConflictError);
    });

    it('is case-insensitive when checking for an existing email', async () => {
      await service.register({ email: 'alice@example.com', password: 'password123' });

      await expect(
        service.register({ email: 'ALICE@EXAMPLE.COM', password: 'different123' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('returns a token and public user on correct credentials', async () => {
      await service.register({ email: 'alice@example.com', password: 'password123' });

      const result = await service.login({ email: 'alice@example.com', password: 'password123' });

      expect(result.token).toEqual(expect.any(String));
      expect(result.user.email).toBe('alice@example.com');
    });

    it('throws UnauthorizedError for an unknown email', async () => {
      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for a wrong password', async () => {
      await service.register({ email: 'alice@example.com', password: 'password123' });

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifyToken', () => {
    it('returns the user id for a valid token', async () => {
      const { token, user } = await service.register({
        email: 'alice@example.com',
        password: 'password123',
      });

      const userId = await service.verifyToken(token);
      expect(userId).toBe(user.id);
    });

    it('throws UnauthorizedError for a malformed token', async () => {
      await expect(service.verifyToken('not-a-real-token')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for a token signed with a different secret', async () => {
      const otherService = new AuthService(userRepository, 'a-different-secret', '1h');
      const { token } = await otherService.register({
        email: 'bob@example.com',
        password: 'password123',
      });

      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for an expired token', async () => {
      const { user } = await service.register({
        email: 'carol@example.com',
        password: 'password123',
      });
      const expiredToken = jwt.sign({ sub: user.id }, SECRET, {
        ...GOOD_OPTS,
        expiresIn: -10,
      });

      await expect(service.verifyToken(expiredToken)).rejects.toThrow(UnauthorizedError);
    });

    it('issues tokens with HS256 header, issuer and audience', async () => {
      const { token } = await service.register({ email: 'd@example.com', password: 'password123' });
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.header.alg).toBe('HS256');
      expect(decoded?.payload).toMatchObject({ iss: 'myfood-service', aud: 'myfood-api' });
    });

    it('accepts a correctly formed token', async () => {
      const token = jwt.sign({ sub: 'u1' }, SECRET, GOOD_OPTS);
      await expect(service.verifyToken(token)).resolves.toBe('u1');
    });

    it('rejects a token signed with HS512', async () => {
      const token = jwt.sign({ sub: 'u1' }, SECRET, { ...GOOD_OPTS, algorithm: 'HS512' });
      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it('rejects an alg=none token', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        sub: 'u1',
        iss: 'myfood-service',
        aud: 'myfood-api',
      })}.`;
      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it('rejects a token without sub', async () => {
      const token = jwt.sign({}, SECRET, GOOD_OPTS);
      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it('rejects a token with a non-string sub', async () => {
      const token = jwt.sign({ sub: 123 as unknown as string }, SECRET, GOOD_OPTS);
      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });

    it.each([
      ['wrong issuer', { issuer: 'evil', audience: 'myfood-api' }],
      ['wrong audience', { issuer: 'myfood-service', audience: 'other' }],
      ['missing issuer', { audience: 'myfood-api' }],
      ['missing audience', { issuer: 'myfood-service' }],
    ])('rejects a token with %s', async (_name, opts) => {
      const token = jwt.sign({ sub: 'u1' }, SECRET, { algorithm: 'HS256', ...opts });
      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedError);
    });
  });
});
