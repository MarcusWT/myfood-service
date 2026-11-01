import { ChefHat } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/shell/PageHeader';
import { useRecipeSuggestions, type Recipe } from './api';
import { RecipesSkeleton } from './RecipesSkeleton';

export function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return err.message;
    if (err.status >= 500) return 'Recipe suggestions are currently unavailable. Try again later.';
    return err.message;
  }
  return 'Could not reach the server.';
}

function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const href = safeUrl(r.sourceUrl);
  const img = safeUrl(r.imageUrl);
  return (
    <Card>
      <CardContent className="flex gap-3">
        {img && (
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-20 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 space-y-2">
          <h2 className="font-medium">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {r.title}
              </a>
            ) : (
              r.title
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {r.readyInMinutes} min · {r.servings} servings
          </p>
          {r.usedIngredients.length > 0 && (
            <ul aria-label="Ingredients you have" className="flex flex-wrap gap-1">
              {r.usedIngredients.map((i, idx) => (
                <li key={`${i.name}-${idx}`}>
                  <Badge className="bg-success/15 text-success-foreground">Have: {i.name}</Badge>
                </li>
              ))}
            </ul>
          )}
          {r.missedIngredients.length > 0 && (
            <ul aria-label="Missing ingredients" className="flex flex-wrap gap-1">
              {r.missedIngredients.map((i, idx) => (
                <li key={`${i.name}-${idx}`}>
                  <Badge className="bg-warning text-warning-foreground">Missing: {i.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecipesPage() {
  const q = useRecipeSuggestions();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recipe suggestions"
        description="Based on the items you currently have in stock."
      />
      <Button onClick={() => void q.refetch()} disabled={q.isFetching}>
        {q.data ? 'Refresh suggestions' : 'Get suggestions'}
      </Button>
      {q.isFetching && !q.data && <RecipesSkeleton />}
      {q.isError && <p role="alert">{errorMessage(q.error)}</p>}
      {q.data && q.data.length === 0 && (
        <EmptyState
          icon={ChefHat}
          title="No recipes found"
          description="Add more items to your inventory and try again."
          action={{ label: 'Go to inventory', to: '/inventory', variant: 'outline' }}
        />
      )}
      {!!q.data?.length && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
