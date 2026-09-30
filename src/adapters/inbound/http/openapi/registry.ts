import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  FoodItemSchema,
  CreateFoodItemSchema,
  UpdateFoodItemSchema,
} from '../../../../core/domain/food-item.js';
import { RegisterInputSchema, LoginInputSchema } from '../../../../core/domain/user.js';
import { AlertQuerySchema } from '../expiry-alert.controller.js';
import { RecipeQuerySchema } from '../recipe.controller.js';

// Adds the `.openapi()` helper to Zod schemas. This is confined to this
// adapter module (not `core/domain`) so the domain layer stays free of
// infrastructure-specific imports.
extendZodWithOpenApi(z);

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
    })
    .openapi('PaginatedFoodItems'),
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
    })
    .openapi('Recipe'),
);

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
  method: 'post',
  path: '/food-items',
  tags: ['Food Items'],
  summary: 'Add a new food item',
  security: authSecurity,
  request: {
    body: {
      content: { 'application/json': { schema: CreateFoodItemSchema } },
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
      location: z.string().optional(),
      category: z.string().optional(),
      name: z.string().optional(),
      page: z.coerce.number().int().optional(),
      limit: z.coerce.number().int().optional(),
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
  security: authSecurity,
  request: {
    params: IdParam,
    body: {
      content: { 'application/json': { schema: UpdateFoodItemSchema } },
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
  method: 'delete',
  path: '/food-items/{id}',
  tags: ['Food Items'],
  summary: 'Delete a food item',
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
