import { z } from 'zod';
import { insertPairingRequestSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  pairing: {
    request: {
      method: 'POST' as const,
      path: '/api/pairing/request' as const,
      input: insertPairingRequestSchema,
      responses: {
        200: z.object({
          code: z.string(),
          status: z.string(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/pairing/status/:phone' as const,
      responses: {
        200: z.object({
          status: z.string(),
        }),
      }
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
