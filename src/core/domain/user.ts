import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  passwordHash: z.string().min(1),
  createdAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Public-facing representation of a user (no password hash).
 */
export type PublicUser = Pick<User, 'id' | 'email'>;

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email };
}
