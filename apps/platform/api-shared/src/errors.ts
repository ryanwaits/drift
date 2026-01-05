export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

export function badRequest(message: string, code?: string): ApiError {
  return new ApiError(message, 400, code);
}

export function unauthorized(message = 'Unauthorized', code?: string): ApiError {
  return new ApiError(message, 401, code);
}

export function forbidden(message = 'Forbidden', code?: string): ApiError {
  return new ApiError(message, 403, code);
}

export function notFound(message = 'Not found', code?: string): ApiError {
  return new ApiError(message, 404, code);
}

export function tooManyRequests(message = 'Too many requests', code?: string): ApiError {
  return new ApiError(message, 429, code);
}

export function internalError(message = 'Internal server error', code?: string): ApiError {
  return new ApiError(message, 500, code);
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(error.toJSON(), { status: error.status });
  }

  console.error('Unhandled error:', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
