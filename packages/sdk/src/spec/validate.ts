import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import schemaV100 from '../../schemas/v1.0.0/drift.schema.json';
import type { DriftSpec } from './types';

export type DriftSchemaVersion = '1.0.0' | 'latest';

export const LATEST_VERSION: DriftSchemaVersion = '1.0.0';

export type DriftSpecError = {
  instancePath: string;
  message: string;
  keyword: string;
};

const schemas: Record<string, unknown> = {
  '1.0.0': schemaV100,
};

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const validatorCache = new Map<string, ValidateFunction<DriftSpec>>();

function getValidator(version: DriftSchemaVersion = 'latest'): ValidateFunction<DriftSpec> {
  const resolvedVersion = version === 'latest' ? LATEST_VERSION : version;

  let validator = validatorCache.get(resolvedVersion);
  if (validator) {
    return validator;
  }

  const schema = schemas[resolvedVersion];
  if (!schema) {
    throw new Error(
      `Unknown schema version: ${resolvedVersion}. Available: ${Object.keys(schemas).join(', ')}`,
    );
  }

  // biome-ignore lint/suspicious/noExplicitAny: Ajv schema type is dynamically loaded
  validator = ajv.compile<DriftSpec>(schema as any);
  validatorCache.set(resolvedVersion, validator);
  return validator;
}

export function validateDriftSpec(
  spec: unknown,
  version: DriftSchemaVersion = 'latest',
): { ok: true } | { ok: false; errors: DriftSpecError[] } {
  const validate = getValidator(version);
  const ok = validate(spec);

  if (ok) {
    return { ok: true };
  }

  const errors = (validate.errors ?? []).map<DriftSpecError>((error) => ({
    instancePath: error.instancePath ?? '',
    message: error.message ?? 'invalid',
    keyword: error.keyword ?? 'unknown',
  }));

  return {
    ok: false,
    errors,
  };
}

export function assertDriftSpec(
  spec: unknown,
  version: DriftSchemaVersion = 'latest',
): asserts spec is DriftSpec {
  const result = validateDriftSpec(spec, version);
  if (!result.ok) {
    const details = result.errors
      .map((error) => `- ${error.instancePath || '/'} ${error.message}`)
      .join('\n');
    throw new Error(`Invalid DriftSpec:\n${details}`);
  }
}

export function getDriftValidationErrors(
  spec: unknown,
  version: DriftSchemaVersion = 'latest',
): DriftSpecError[] {
  const result = validateDriftSpec(spec, version);
  return result.ok ? [] : result.errors;
}

export function getAvailableDriftVersions(): string[] {
  return Object.keys(schemas);
}
