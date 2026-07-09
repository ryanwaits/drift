/**
 * Core mapping: OpenAPI 3.x document → ApiSpec.
 *
 * One ApiExport per operation (path + method). Named schemas under
 * components/schemas become ApiSpec.types so docs claims can reference them.
 */
import type {
  ApiExport,
  ApiSchema,
  ApiSignatureParameter,
  ApiSpec,
  ApiTag,
  ApiType,
} from '@driftdev/sdk/types';
import { deepResolve } from './resolve-ref';
import type {
  MediaTypeObject,
  OpenApiDocument,
  OperationObject,
  ParameterObject,
  PathItem,
  RefObject,
  ResponseObject,
  SchemaObject,
} from './types';
import { HTTP_METHODS } from './types';

export function toApiSpec(
  doc: OpenApiDocument,
  meta?: { name?: string; version?: string },
): ApiSpec {
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    throw new Error(`Unsupported OpenAPI version: ${doc.openapi ?? '(missing)'} (expected 3.x)`);
  }

  const exports: ApiExport[] = [];
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation || typeof operation !== 'object') continue;
      exports.push(mapOperation(doc, path, method, pathItem, operation));
    }
  }

  return {
    meta: {
      name: meta?.name ?? doc.info?.title ?? 'openapi',
      version: meta?.version ?? doc.info?.version,
    },
    exports,
    types: mapSchemas(doc),
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

function mapOperation(
  doc: OpenApiDocument,
  path: string,
  method: string,
  pathItem: PathItem,
  operation: OperationObject,
): ApiExport {
  const name = operation.operationId ?? `${method.toUpperCase()} ${path}`;
  const description = operation.description ?? operation.summary;

  const parameters = mapParameters(doc, pathItem, operation);
  const returns = mapSuccessResponse(doc, operation);

  // No synthetic @param/@returns tags: docs and signature come from the same
  // source here, so JSDoc-consistency detectors would only produce false
  // positives. Descriptions live on the signature parameters/returns instead.
  const tags: ApiTag[] = [];
  if (operation.summary && operation.description) {
    tags.push({ name: 'summary', text: operation.summary });
  }

  return {
    id: name,
    name,
    kind: 'function',
    description,
    deprecated: operation.deprecated ? true : undefined,
    flags: {
      method: method.toUpperCase(),
      path,
      ...(operation.tags && operation.tags.length > 0 ? { tags: operation.tags } : {}),
    },
    tags: tags.length > 0 ? tags : undefined,
    signatures: [
      {
        parameters,
        returns: returns ? { schema: returns.schema, description: returns.description } : undefined,
      },
    ],
  };
}

// ─── Parameters ──────────────────────────────────────────────────────────────

function mapParameters(
  doc: OpenApiDocument,
  pathItem: PathItem,
  operation: OperationObject,
): ApiSignatureParameter[] {
  const out: ApiSignatureParameter[] = [];

  // Path-level parameters, overridden by operation-level ones with same name+in
  const raw = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  const byKey = new Map<string, ParameterObject>();
  for (const entry of raw) {
    const param = deepResolve(doc, entry) as ParameterObject;
    if (!param?.name) continue;
    byKey.set(`${param.in ?? ''}:${param.name}`, param);
  }
  for (const param of byKey.values()) {
    out.push({
      name: param.name,
      required: param.required === true,
      description: param.description,
      schema: (param.schema as ApiSchema) ?? 'unknown',
    });
  }

  // Request body: flatten a JSON object schema into named parameters,
  // otherwise expose it as a single `body` parameter.
  const body = operation.requestBody
    ? (deepResolve(doc, operation.requestBody) as Exclude<
        OperationObject['requestBody'],
        RefObject
      >)
    : undefined;
  const bodySchema = jsonSchemaOf(body?.content);
  if (bodySchema) {
    const properties = bodySchema.properties as Record<string, SchemaObject> | undefined;
    if (properties && (bodySchema.type === 'object' || bodySchema.type === undefined)) {
      const required = new Set(Array.isArray(bodySchema.required) ? bodySchema.required : []);
      for (const [propName, propSchema] of Object.entries(properties)) {
        out.push({
          name: propName,
          required: required.has(propName),
          description:
            typeof propSchema.description === 'string' ? propSchema.description : undefined,
          schema: propSchema as ApiSchema,
        });
      }
    } else {
      out.push({
        name: 'body',
        required: body?.required === true,
        description: body?.description,
        schema: bodySchema as ApiSchema,
      });
    }
  }

  return out;
}

// ─── Responses ───────────────────────────────────────────────────────────────

function mapSuccessResponse(
  doc: OpenApiDocument,
  operation: OperationObject,
): { schema: ApiSchema; description?: string } | undefined {
  const responses = operation.responses;
  if (!responses) return undefined;

  const codes = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(code))
    .sort();
  const key = codes[0] ?? ('default' in responses ? 'default' : undefined);
  if (!key) return undefined;

  const response = deepResolve(doc, responses[key]) as ResponseObject;
  const schema = jsonSchemaOf(response?.content);
  return {
    schema: (schema as ApiSchema) ?? 'void',
    description: response?.description,
  };
}

/** Pick the JSON media type schema out of a content map, deep-resolved. */
function jsonSchemaOf(
  content: Record<string, MediaTypeObject> | undefined,
): SchemaObject | undefined {
  if (!content) return undefined;
  const mediaType =
    content['application/json'] ??
    content[Object.keys(content).find((k) => k.includes('json')) ?? ''] ??
    Object.values(content)[0];
  return mediaType?.schema;
}

// ─── Named schemas ───────────────────────────────────────────────────────────

function mapSchemas(doc: OpenApiDocument): ApiType[] | undefined {
  const schemas = doc.components?.schemas;
  if (!schemas) return undefined;
  const types: ApiType[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    types.push({
      id: name,
      name,
      kind: 'type',
      description: typeof schema.description === 'string' ? schema.description : undefined,
      schema: deepResolve(doc, schema, new Set([`#/components/schemas/${name}`])) as ApiSchema,
    });
  }
  return types.length > 0 ? types : undefined;
}
