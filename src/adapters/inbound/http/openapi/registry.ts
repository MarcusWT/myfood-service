import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  FoodItemSchema,
  CreateFoodItemSchema,
  UpdateFoodItemSchema,
  DisposeFoodItemSchema,
  ConsumeFoodItemSchema,
  FOOD_ITEM_SORT_FIELDS,
  SortOrderSchema,
  FoodItemStatusSchema,
  DisposalOutcomeSchema,
  StrictIsoDateSchema,
} from '../../../../core/domain/food-item.js';
import { LocationSchema, CategorySchema } from '../../../../core/domain/value-objects.js';
import { RegisterInputSchema, LoginInputSchema } from '../../../../core/domain/user.js';
import { AlertQuerySchema } from '../expiry-alert.controller.js';
import { RecipeQuerySchema } from '../recipe.controller.js';
import { DIETS, INTOLERANCES, NOTIFICATION_CHANNELS } from '../../../../core/domain/user-settings.js';
import { ShelfLifeQuerySchema } from '../shelf-life.controller.js';
import { ExportQuerySchema } from '../export.controller.js';
import {
  ShoppingListItemSchema,
  CreateShoppingListItemSchema,
  UpdateShoppingListItemSchema,
} from '../../../../core/domain/shopping-list.js';

// Adds the `.openapi()` helper to Zod schemas. This is confined to this
// adapter module (not `core/domain`) so the domain layer stays free of
// infrastructure-specific imports.
extendZodWithOpenApi(z);

// Docs-only variants: the domain transform hides the wire format, so describe
// bestBefore explicitly. Runtime validation still uses the domain schemas.
const BestBeforeDoc = StrictIsoDateSchema.openapi({
  type: 'string',
  format: 'date-time',
  example: '2026-08-12T00:00:00Z',
  description:
    'ISO 8601 datetime with timezone, or a date-only value (YYYY-MM-DD) which is interpreted as UTC midnight. On create, a date-only value for today is not in the future and is rejected.',
});
const CreateFoodItemDoc = CreateFoodItemSchema.innerType().extend({ bestBefore: BestBeforeDoc });
const UpdateFoodItemDoc = UpdateFoodItemSchema.extend({ bestBefore: BestBeforeDoc.optional() });

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});
const authSecurity = [{ [bearerAuth.name]: [] }];

// ---------------------------------------------------------------------------
// Reusable component schemas
// ---------------------------------------------------------------------------

const FoodItemComponent = registry.register('FoodItem', FoodItemSchema.openapi('FoodItem'));

const PaginatedFoodItemsComponent = registry.register(
  'PaginatedFoodItems',
  z
    .object({
      data: z.array(FoodItemComponent),
      total: z.number().int(),
      page: z.number().int(),
      limit: z.number().int(),
      totalPages: z.number().int().openapi({ description: '0 when total is 0, else ceil(total / limit)' }),
    })
    .openapi('PaginatedFoodItems'),
);

const ConsumeResultComponent = registry.register(
  'ConsumeResult',
  z
    .object({
      item: FoodItemComponent,
      disposed: z.boolean().openapi({ description: 'True when the amount used up the item (disposed as CONSUMED)' }),
      lowStock: z.boolean().openapi({ description: 'True when the remaining quantity is below minimumQuantity' }),
    })
    .openapi('ConsumeResult'),
);

const WasteStatsComponent = registry.register(
  'WasteStats',
  z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
      totals: z.object({
        consumed: z.number().int(),
        discarded: z.number().int(),
        total: z.number().int(),
        wasteRate: z.number().openapi({ description: 'discarded / total; 0 when total is 0' }),
      }),
      byCategory: z.array(
        z.object({ category: z.string(), consumed: z.number().int(), discarded: z.number().int() }),
      ),
      byMonth: z.array(
        z.object({
          month: z.string().openapi({ example: '2026-10', description: 'UTC month, ascending' }),
          consumed: z.number().int(),
          discarded: z.number().int(),
        }),
      ),
    })
    .openapi('WasteStats'),
);

const ExpiryAlertComponent = registry.register(
  'ExpiryAlert',
  z
    .object({
      item: FoodItemComponent,
      daysUntilExpiry: z.number().int(),
      status: z.enum(['EXPIRED', 'CRITICAL', 'WARNING', 'UPCOMING']),
    })
    .openapi('ExpiryAlert'),
);

const RecipeIngredientComponent = z.object({
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
});

const RecipeComponent = registry.register(
  'Recipe',
  z
    .object({
      id: z.number(),
      title: z.string(),
      imageUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      readyInMinutes: z.number(),
      servings: z.number(),
      usedIngredients: z.array(RecipeIngredientComponent),
      missedIngredients: z.array(RecipeIngredientComponent),
      matchScore: z.number(),
      isFavorite: z.boolean().optional(),
      expiringSoon: z.array(z.string()).optional(),
    })
    .openapi('Recipe'),
);

// Docs-only variant: the domain schema has a transform (dedupe/sort).
const UserSettingsComponent = registry.register(
  'UserSettings',
  z
    .object({
      alertWithinDays: z.number().int().min(1).max(365).nullable(),
      diet: z.enum(DIETS).nullable(),
      intolerances: z.array(z.enum(INTOLERANCES)).max(12),
      channel: z.enum(NOTIFICATION_CHANNELS).describe('Reserved; stored but not yet honoured by the notification poller.'),
    })
    .openapi('UserSettings'),
);

const FavoriteRecipeComponent = registry.register(
  'FavoriteRecipe',
  z
    .object({
      recipeId: z.number().int(),
      title: z.string(),
      imageUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      createdAt: z.coerce.date(),
    })
    .openapi('FavoriteRecipe'),
);

const FavoriteRecipeInputComponent = z.object({
  title: z.string().min(1).max(300),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
});

const ShoppingItemComponent = z.object({
  name: z.string(),
  category: z.string(),
  reason: z.enum(['EXPIRED', 'LOW_STOCK', 'EXPIRING_SOON']),
  currentQuantity: z.number().optional(),
  currentUnit: z.string().optional(),
});

const ShoppingSummaryComponent = registry.register(
  'ShoppingSummary',
  z
    .object({
      generatedAt: z.coerce.date(),
      totalItems: z.number().int(),
      byCategory: z.record(z.array(ShoppingItemComponent)),
    })
    .openapi('ShoppingSummary'),
);

const ValidationErrorComponent = registry.register(
  'ValidationError',
  z
    .object({
      error: z.literal('Validation Error'),
      details: z.array(z.unknown()),
    })
    .openapi('ValidationError'),
);

const NotFoundErrorComponent = registry.register(
  'NotFoundError',
  z
    .object({
      error: z.string(),
    })
    .openapi('NotFoundError'),
);

const ConflictErrorComponent = registry.register(
  'ConflictError',
  z
    .object({
      error: z.string(),
    })
    .openapi('ConflictError'),
);

const InternalErrorComponent = registry.register(
  'InternalError',
  z
    .object({
      error: z.literal('Internal Server Error'),
    })
    .openapi('InternalError'),
);

const badRequest = {
  description: 'Validation error',
  content: { 'application/json': { schema: ValidationErrorComponent } },
};
const notFound = {
  description: 'Resource not found',
  content: { 'application/json': { schema: NotFoundErrorComponent } },
};
const conflict = {
  description: 'Conflicting resource',
  content: { 'application/json': { schema: ConflictErrorComponent } },
};
const internalError = {
  description: 'Unexpected server error',
  content: { 'application/json': { schema: InternalErrorComponent } },
};

const IdParam = z.object({
  id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }),
});

const PublicUserComponent = registry.register(
  'PublicUser',
  z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
    })
    .openapi('PublicUser'),
);

const AuthResultComponent = registry.register(
  'AuthResult',
  z
    .object({
      token: z.string(),
      user: PublicUserComponent,
    })
    .openapi('AuthResult'),
);

const UnauthorizedErrorComponent = registry.register(
  'UnauthorizedError',
  z
    .object({
      error: z.string(),
    })
    .openapi('UnauthorizedError'),
);

const unauthorized = {
  description: 'Missing, invalid, or expired credentials',
  content: { 'application/json': { schema: UnauthorizedErrorComponent } },
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Service health check',
  responses: {
    200: {
      description: 'Service is up',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            service: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/ready',
  tags: ['Health'],
  summary: 'Deep readiness check (verifies the database connection is usable)',
  responses: {
    200: {
      description: 'Service and database are ready',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            service: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    503: {
      description: 'Database is unreachable',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('error'),
            service: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user account',
  request: {
    body: {
      content: { 'application/json': { schema: RegisterInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'User registered',
      content: { 'application/json': { schema: AuthResultComponent } },
    },
    400: badRequest,
    409: conflict,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in with email and password',
  request: {
    body: {
      content: { 'application/json': { schema: LoginInputSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: { 'application/json': { schema: AuthResultComponent } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Get the currently authenticated user',
  security: authSecurity,
  responses: {
    200: {
      description: 'Current user',
      content: { 'application/json': { schema: PublicUserComponent } },
    },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/food-items',
  tags: ['Food Items'],
  summary: 'Add a new food item',
  security: authSecurity,
  request: {
    body: {
      content: { 'application/json': { schema: CreateFoodItemDoc } },
    },
  },
  responses: {
    201: {
      description: 'Food item created',
      content: { 'application/json': { schema: FoodItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    409: conflict,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/food-items',
  tags: ['Food Items'],
  summary: 'List food items (paginated, filterable)',
  security: authSecurity,
  request: {
    query: z.object({
      location: LocationSchema.optional(),
      category: CategorySchema.optional(),
      name: z.string().optional(),
      sort: z.enum(FOOD_ITEM_SORT_FIELDS).default('bestBefore').optional(),
      order: SortOrderSchema.default('asc').optional(),
      lowStock: z.enum(['true', 'false']).optional(),
      expiringBefore: z
        .string()
        .optional()
        .openapi({ description: 'ISO date; items with bestBefore <= this value (inclusive, includes expired)' }),
      status: FoodItemStatusSchema.optional().openapi({
        description: 'Relative to now; "expiring" uses EXPIRY_ALERT_DEFAULT_DAYS',
      }),
      page: z.coerce.number().int().min(1).default(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of food items',
      content: { 'application/json': { schema: PaginatedFoodItemsComponent } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/food-items/history',
  tags: ['Food Items'],
  summary: 'Disposal history (consumed/discarded items, newest first)',
  description:
    'Items kept after disposal, sorted by disposedAt descending. Disposed rows older than DISPOSED_RETENTION_DAYS are purged.',
  security: authSecurity,
  request: {
    query: z.object({
      outcome: DisposalOutcomeSchema.optional(),
      from: z.string().optional().openapi({ description: 'ISO date; disposedAt >= from' }),
      to: z.string().optional().openapi({ description: 'ISO date; disposedAt <= to' }),
      page: z.coerce.number().int().min(1).default(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Paginated disposed items',
      content: { 'application/json': { schema: PaginatedFoodItemsComponent } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/stats/waste',
  tags: ['Stats'],
  summary: 'Waste statistics from disposal history',
  description:
    'Counts items (not quantities). Defaults to the last 90 days. Limited by DISPOSED_RETENTION_DAYS.',
  security: authSecurity,
  request: {
    query: z.object({
      from: z.string().optional().openapi({ description: 'ISO date; default 90 days before to' }),
      to: z.string().optional().openapi({ description: 'ISO date; default now' }),
    }),
  },
  responses: {
    200: {
      description: 'Waste statistics',
      content: { 'application/json': { schema: WasteStatsComponent } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/food-items/{id}',
  tags: ['Food Items'],
  summary: 'Get a single food item by id',
  security: authSecurity,
  request: { params: IdParam },
  responses: {
    200: {
      description: 'Food item found',
      content: { 'application/json': { schema: FoodItemComponent } },
    },
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/food-items/{id}',
  tags: ['Food Items'],
  summary: 'Update a food item',
  description:
    'Partial update. Omitted fields are unchanged; send null for notes or minimumQuantity to clear them. bestBefore must be a future date only when it differs from the stored value.',
  security: authSecurity,
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: UpdateFoodItemDoc } },
    },
  },
  responses: {
    200: {
      description: 'Food item updated',
      content: { 'application/json': { schema: FoodItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/food-items/{id}/dispose',
  tags: ['Food Items'],
  summary: 'Mark a food item as consumed or discarded (keeps the record, removes it from active lists)',
  security: authSecurity,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: DisposeFoodItemSchema } } },
  },
  responses: {
    200: {
      description: 'Food item disposed',
      content: { 'application/json': { schema: FoodItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/food-items/{id}/consume',
  tags: ['Food Items'],
  summary: 'Consume part of a food item',
  description:
    'Atomically decrements quantity. If amount >= quantity the item is disposed as CONSUMED (disposed: true). Unlike /dispose, the response is {item, disposed, lowStock}, not a bare item. Partial consumes create no history/stats; only the final full consume counts.',
  security: authSecurity,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: ConsumeFoodItemSchema } } },
  },
  responses: {
    200: {
      description: 'Quantity decremented or item disposed',
      content: { 'application/json': { schema: ConsumeResultComponent } },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/food-items/{id}/restore',
  tags: ['Food Items'],
  summary: 'Restore a disposed food item to the active list',
  security: authSecurity,
  request: { params: IdParam },
  responses: {
    200: {
      description: 'Food item restored',
      content: { 'application/json': { schema: FoodItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
    500: internalError,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/food-items/{id}',
  tags: ['Food Items'],
  summary: 'Permanently delete a food item (hard delete, active or disposed)',
  security: authSecurity,
  request: { params: IdParam },
  responses: {
    204: { description: 'Food item deleted' },
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/alerts/expiry',
  tags: ['Expiry Alerts'],
  summary: 'List expiry alerts for tracked food items',
  security: authSecurity,
  request: { query: AlertQuerySchema },
  responses: {
    200: {
      description: 'List of expiry alerts',
      content: { 'application/json': { schema: z.array(ExpiryAlertComponent) } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/recipes/suggestions',
  tags: ['Recipes'],
  summary: 'Get recipe suggestions based on current food items',
  security: authSecurity,
  request: { query: RecipeQuerySchema },
  responses: {
    200: {
      description: 'List of suggested recipes',
      content: { 'application/json': { schema: z.array(RecipeComponent) } },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/settings',
  tags: ['Settings'],
  summary: 'Get the effective user settings (defaults when none saved)',
  security: authSecurity,
  responses: {
    200: { description: 'Settings', content: { 'application/json': { schema: UserSettingsComponent } } },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'put',
  path: '/settings',
  tags: ['Settings'],
  summary: 'Replace the user settings (full replace, idempotent)',
  security: authSecurity,
  request: { body: { content: { 'application/json': { schema: UserSettingsComponent } } } },
  responses: {
    200: { description: 'Saved settings', content: { 'application/json': { schema: UserSettingsComponent } } },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/recipes/favorites',
  tags: ['Recipes'],
  summary: 'List favourite recipes (newest first)',
  security: authSecurity,
  responses: {
    200: { description: 'Favourites', content: { 'application/json': { schema: z.array(FavoriteRecipeComponent) } } },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'put',
  path: '/recipes/favorites/{recipeId}',
  tags: ['Recipes'],
  summary: 'Add a favourite recipe (idempotent upsert)',
  security: authSecurity,
  request: {
    params: z.object({ recipeId: z.coerce.number().int().positive() }),
    body: { content: { 'application/json': { schema: FavoriteRecipeInputComponent } } },
  },
  responses: {
    200: { description: 'Saved favourite', content: { 'application/json': { schema: FavoriteRecipeComponent } } },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/recipes/favorites/{recipeId}',
  tags: ['Recipes'],
  summary: 'Remove a favourite recipe (idempotent)',
  security: authSecurity,
  request: { params: z.object({ recipeId: z.coerce.number().int().positive() }) },
  responses: {
    204: { description: 'Removed (or not present)' },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/shopping/summary',
  tags: ['Shopping Summary'],
  summary: 'Get a shopping summary derived from expiring and low-stock items',
  security: authSecurity,
  responses: {
    200: {
      description: 'Shopping summary',
      content: { 'application/json': { schema: ShoppingSummaryComponent } },
    },
    401: unauthorized,
    500: internalError,
  },
});

// ---------------------------------------------------------------------------
// Shelf life, export, persisted shopping list
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/food-items/shelf-life',
  tags: ['Food Items'],
  summary: 'Suggest a best-before date for a category and location (advisory)',
  security: authSecurity,
  request: { query: ShelfLifeQuerySchema },
  responses: {
    200: {
      description: 'Suggestion; days and suggestedBestBefore are null when not recommended',
      content: {
        'application/json': {
          schema: z.object({
            category: z.string(),
            location: z.string(),
            days: z.number().int().nullable(),
            suggestedBestBefore: z.string().nullable(),
            source: z.literal('default-table'),
          }),
        },
      },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/food-items/shelf-life/table',
  tags: ['Food Items'],
  summary: 'Full default shelf-life table (days per category and location)',
  security: authSecurity,
  responses: {
    200: {
      description: 'Shelf-life table',
      content: {
        'application/json': {
          schema: z.object({
            source: z.literal('default-table'),
            table: z.record(z.record(z.number().int().nullable())),
          }),
        },
      },
    },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'get',
  path: '/food-items/export',
  tags: ['Food Items'],
  summary: 'Export all active food items as JSON (lossless) or CSV (formula-guarded)',
  description:
    'CSV cells starting with =, +, -, @, tab or CR are prefixed with a single quote to prevent spreadsheet formula injection, so CSV data may differ slightly from stored values. JSON is lossless.',
  security: authSecurity,
  request: { query: ExportQuerySchema },
  responses: {
    200: {
      description: 'Attachment download',
      content: {
        'application/json': {
          schema: z.object({
            exportedAt: z.string(),
            count: z.number().int(),
            items: z.array(FoodItemComponent),
          }),
        },
        'text/csv': { schema: z.string() },
      },
    },
    400: badRequest,
    401: unauthorized,
    500: internalError,
  },
});

const ShoppingListItemComponent = registry.register(
  'ShoppingListItem',
  ShoppingListItemSchema.openapi('ShoppingListItem'),
);

registry.registerPath({
  method: 'get',
  path: '/shopping/list',
  tags: ['Shopping List'],
  summary: 'List the persisted shopping list',
  security: authSecurity,
  responses: {
    200: {
      description: 'Shopping list items',
      content: { 'application/json': { schema: z.array(ShoppingListItemComponent) } },
    },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/shopping/list',
  tags: ['Shopping List'],
  summary: 'Add an item to the shopping list (max 500 per user)',
  security: authSecurity,
  request: {
    body: { content: { 'application/json': { schema: CreateShoppingListItemSchema } } },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ShoppingListItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    422: { description: 'Shopping list limit reached' },
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/shopping/list/import',
  tags: ['Shopping List'],
  summary: 'Import items from the derived shopping summary, skipping names already listed',
  security: authSecurity,
  responses: {
    201: {
      description: 'Newly created items',
      content: { 'application/json': { schema: z.array(ShoppingListItemComponent) } },
    },
    401: unauthorized,
    422: { description: 'Shopping list limit reached' },
    500: internalError,
  },
});

registry.registerPath({
  method: 'post',
  path: '/shopping/list/clear-checked',
  tags: ['Shopping List'],
  summary: 'Delete all checked items',
  security: authSecurity,
  responses: {
    200: {
      description: 'Number of removed items',
      content: { 'application/json': { schema: z.object({ removed: z.number().int() }) } },
    },
    401: unauthorized,
    500: internalError,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/shopping/list/{id}',
  tags: ['Shopping List'],
  summary: 'Update or check/uncheck a shopping list item',
  security: authSecurity,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateShoppingListItemSchema } } },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: ShoppingListItemComponent } },
    },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/shopping/list/{id}',
  tags: ['Shopping List'],
  summary: 'Delete a shopping list item',
  security: authSecurity,
  request: { params: IdParam },
  responses: {
    204: { description: 'Deleted' },
    401: unauthorized,
    404: notFound,
    500: internalError,
  },
});
