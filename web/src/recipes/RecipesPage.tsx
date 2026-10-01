import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';

export function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return err.message;
    if (err.status >= 500) return 'Recipe suggestions are currently unavailable. Try again later.';
    return err.message;
  }
  return 'Could not reach the server.';
}

export function RecipesPage() {
  const m = useMutation({
    mutationFn: async () => {
      const { data } = await api.GET('/recipes/suggestions', { params: { query: { limit: 10 } } });
      return data!;
    },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Recipe suggestions</h1>
      <p className="text-sm">Based on the items you currently have in stock.</p>
      <Button onClick={() => m.mutate()} disabled={m.isPending}>
        {m.data ? 'Refresh suggestions' : 'Get suggestions'}
      </Button>
      {m.isPending && <p role="status">Finding recipes…</p>}
      {m.isError && <p role="alert">{errorMessage(m.error)}</p>}
      {m.data && m.data.length === 0 && (
        <p>No recipes found. Add some items to your inventory and try again.</p>
      )}
      <ul className="space-y-3">
        {m.data?.map((r) => {
          const href = safeUrl(r.sourceUrl);
          const img = safeUrl(r.imageUrl);
          return (
            <li key={r.id} className="flex gap-3 rounded-md border p-3">
              {img && <img src={img} alt="" className="size-20 rounded object-cover" />}
              <div className="space-y-1">
                <h2 className="font-medium">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </h2>
                <p className="text-sm">
                  {r.readyInMinutes} min · {r.servings} servings · uses {r.usedIngredients.length},
                  missing {r.missedIngredients.length}
                </p>
                {r.missedIngredients.length > 0 && (
                  <p className="text-sm">
                    Missing: {r.missedIngredients.map((i) => i.name).join(', ')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
