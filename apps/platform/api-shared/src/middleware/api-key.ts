import type { Database } from '@doccov/db';
import type { Kysely } from 'kysely';
import { hashApiKey, isValidKeyFormat } from '../utils/api-keys';

export interface ApiKeyContext {
  apiKey: { id: string; orgId: string; name: string };
  org: { id: string; plan: string; aiCallsUsed: number; aiCallsResetAt: Date | null };
}

export type ApiKeyValidationResult =
  | {
      ok: true;
      context: ApiKeyContext;
    }
  | {
      ok: false;
      error: string;
      status: number;
      docs?: string;
      upgrade?: string;
    };

/**
 * Validate an API key from a request
 * Framework-agnostic - works with any Request object
 */
export async function validateApiKey(
  request: Request,
  db: Kysely<Database>,
): Promise<ApiKeyValidationResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return {
      ok: false,
      error: 'API key required',
      status: 401,
      docs: 'https://docs.doccov.com/api-keys',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      error: 'Invalid Authorization header. Use: Bearer <api_key>',
      status: 401,
    };
  }

  const key = authHeader.slice(7);

  if (!isValidKeyFormat(key)) {
    return {
      ok: false,
      error: 'Invalid API key format',
      status: 401,
    };
  }

  const keyHash = hashApiKey(key);

  const result = await db
    .selectFrom('api_keys')
    .innerJoin('organizations', 'organizations.id', 'api_keys.orgId')
    .where('api_keys.keyHash', '=', keyHash)
    .where((eb) =>
      eb.or([eb('api_keys.expiresAt', 'is', null), eb('api_keys.expiresAt', '>', new Date())]),
    )
    .select([
      'api_keys.id as keyId',
      'api_keys.orgId',
      'api_keys.name as keyName',
      'organizations.plan',
      'organizations.aiCallsUsed',
      'organizations.aiCallsResetAt',
    ])
    .executeTakeFirst();

  if (!result) {
    return {
      ok: false,
      error: 'Invalid or expired API key',
      status: 401,
    };
  }

  // Free tier shouldn't have API keys, but guard anyway
  if (result.plan === 'free') {
    return {
      ok: false,
      error: 'API access requires a paid plan',
      status: 403,
      upgrade: 'https://doccov.com/pricing',
    };
  }

  // Update last used (async, don't block)
  db.updateTable('api_keys')
    .set({ lastUsedAt: new Date() })
    .where('id', '=', result.keyId)
    .execute()
    .catch(console.error);

  return {
    ok: true,
    context: {
      apiKey: {
        id: result.keyId,
        orgId: result.orgId,
        name: result.keyName,
      },
      org: {
        id: result.orgId,
        plan: result.plan,
        aiCallsUsed: result.aiCallsUsed,
        aiCallsResetAt: result.aiCallsResetAt,
      },
    },
  };
}
