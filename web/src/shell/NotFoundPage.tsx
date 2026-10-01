import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md space-y-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="underline">
        Back to dashboard
      </Link>
    </main>
  );
}
