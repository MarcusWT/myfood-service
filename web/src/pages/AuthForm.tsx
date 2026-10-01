import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { safeNext } from '@/auth/safeRedirect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
type Values = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const isLogin = mode === 'login';

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await (isLogin ? login : registerUser)(email, password);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError('Could not reach the server. Check your connection and try again.');
        return;
      }
      if (err.status === 400) {
        let mapped = false;
        for (const issue of err.issues) {
          if (issue.path === 'email' || issue.path === 'password') {
            setError(issue.path, { message: issue.message });
            mapped = true;
          }
        }
        if (!mapped) setFormError(err.message);
      } else {
        setFormError(err.message);
      }
    }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h1>{isLogin ? 'Log in' : 'Create account'}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-sm">
            {isLogin ? (
              <>
                No account?{' '}
                <Link to="/register" className="underline">
                  Register
                </Link>
              </>
            ) : (
              <>
                Already registered?{' '}
                <Link to="/login" className="underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
