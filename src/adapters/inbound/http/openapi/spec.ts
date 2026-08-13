import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { createRequire } from 'module';
import { registry } from './registry.js';

const require = createRequire(import.meta.url);
const pkg = require('../../../../../package.json') as { name: string; version: string };

let cachedDocument: ReturnType<OpenApiGeneratorV3['generateDocument']> | undefined;

/**
 * Builds (and caches) the OpenAPI 3.0 document from the route/schema registry.
 * The registry is static at runtime, so the document only needs to be
 * generated once per process.
 */
export function generateOpenApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  if (!cachedDocument) {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    cachedDocument = generator.generateDocument({
      openapi: '3.0.0',
      info: {
        title: pkg.name,
        version: pkg.version,
        description: 'Backend service for tracking food stock and expiry',
      },
      servers: [{ url: '/api/v1' }],
    });
  }
  return cachedDocument;
}
