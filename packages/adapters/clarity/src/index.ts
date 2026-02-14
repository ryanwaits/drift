/**
 * Clarity adapter for Drift.
 *
 * Maps ClarityContract (ABI) + ContractDoc (parsed docs) → ApiSpec.
 */
import type { ClarityContract } from '@secondlayer/clarity-types';
import type { ApiSpec } from '@driftdev/sdk/types';
import { extractDocs } from '@secondlayer/clarity-docs';
import { toApiSpec as _toApiSpec } from './to-api-spec';

export { toApiSpec } from './to-api-spec';
export { clarityTypeToSchema } from './type-mapping';

/**
 * Convenience: parse source + map ABI → ApiSpec in one call.
 */
export function fromSource(
  source: string,
  abi: ClarityContract,
  meta: { name: string; version?: string },
): ApiSpec {
  const docs = extractDocs(source);
  return _toApiSpec(abi, docs, meta);
}
