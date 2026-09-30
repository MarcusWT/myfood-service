import { RegisterInput, LoginInput, PublicUser } from '../../domain/user.js';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface AuthServicePort {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  verifyToken(token: string): Promise<string>;
}
