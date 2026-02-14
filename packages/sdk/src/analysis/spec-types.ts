/**
 * Adapter: OpenPkg → ApiSpec.
 *
 * Converts @openpkg-ts/spec shapes into drift-owned ApiSpec types.
 * All internal analysis consumers use ApiSpec directly.
 */
import type { OpenPkg } from '@openpkg-ts/spec';
import type { ApiSpec } from './api-spec';

/** @deprecated Use `OpenPkg` from `@openpkg-ts/spec` directly. Will be removed in Phase 2. */
export type OpenPkgSpec = OpenPkg;

export function toApiSpec(openpkg: OpenPkg): ApiSpec {
  return {
    meta: { name: openpkg.meta.name, version: openpkg.meta.version },
    exports: openpkg.exports ?? [],
    types: openpkg.types,
  };
}
