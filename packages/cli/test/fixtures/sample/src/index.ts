/**
 * Fetches a user by ID from the database.
 * @param id - The user's unique identifier
 * @returns The user object
 * @example
 * ```ts
 * const user = await fetchUser('abc-123');
 * ```
 */
export async function fetchUser(id: string): Promise<User> {
  return { id, name: 'test', email: 'test@example.com' };
}

/** Adds two numbers together. */
export function add(a: number, b: number): number {
  return a + b;
}

// No JSDoc — intentionally undocumented
export function undocumented(x: string): string {
  return x;
}

/**
 * Represents a user in the system.
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** Configuration options for the client. */
export interface ClientConfig {
  /** API base URL */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Status of a background job.
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * @deprecated Use `fetchUser` instead
 */
export function getUser(id: string): User {
  return { id, name: 'test', email: 'test@example.com' };
}

/** Maximum number of retries for API calls. */
export const MAX_RETRIES = 3;

/**
 * API client for making requests.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
  }

  /** Send a GET request. */
  async get(_path: string): Promise<unknown> {
    return {};
  }
}
