/**
 * Minimal structural types for OpenAPI 3.0/3.1 documents.
 *
 * Only the subset the adapter reads — not a full OpenAPI type model.
 * Unknown keys are carried through untyped.
 */

export type OpenApiDocument = {
  openapi: string;
  info: { title?: string; version?: string; [key: string]: unknown };
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject>; [key: string]: unknown };
  [key: string]: unknown;
};

export type PathItem = {
  parameters?: (ParameterObject | RefObject)[];
  description?: string;
  summary?: string;
  [key: string]: unknown;
};

export type OperationObject = {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters?: (ParameterObject | RefObject)[];
  requestBody?: RequestBodyObject | RefObject;
  responses?: Record<string, ResponseObject | RefObject>;
  [key: string]: unknown;
};

export type ParameterObject = {
  name: string;
  in?: string;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  [key: string]: unknown;
};

export type RequestBodyObject = {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
};

export type ResponseObject = {
  description?: string;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
};

export type MediaTypeObject = {
  schema?: SchemaObject;
  [key: string]: unknown;
};

export type SchemaObject = Record<string, unknown>;

export type RefObject = { $ref: string; [key: string]: unknown };

export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
