import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
import { FormError } from '@/components/form-error';
import { focusFirstInvalid } from '@/lib/focusFirstInvalid';
import { MAIN_CONTENT_ID } from '@/shell/constants';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
type Values = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const expired = (location.state as { expired?: boolean } | null)?.expired === true;
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (focusTick > 0) focusFirstInvalid(formRef.current);
  }, [focusTick]);

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
        if (mapped) setFocusTick((n) => n + 1);
        else setFormError(err.message);
      } else {
        setFormError(err.message);
      }
    }
  });

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="mx-auto flex min-h-screen max-w-sm items-center p-4 outline-none"
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h1>{isLogin ? 'Log in' : 'Create account'}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
            {expired && !formError && (
              <p
                role="status"
                className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground"
              >
                Your session has expired. Please log in again.
              </p>
            )}
            <FormError>{formError}</FormError>
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
              <FormError id="email-error">{errors.email?.message}</FormError>
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="pr-10"
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              <FormError id="password-error">{errors.password?.message}</FormError>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
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
