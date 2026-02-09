/**
 * Fetches a user by ID.
 * @param userId - The user ID
 * @returns The user object
 */
export function fetchUser(id: string): User {
  return { id, name: 'test' };
}

/**
 * Sends a message.
 * @param content - Message content
 * @param recipient {number} - The recipient
 */
export function sendMessage(content: string, recipient: string): void {}

/**
 * Calculates total with a broken link.
 * See {@link NonExistentHelper} for details.
 */
export function calculateTotal(items: number[]): number {
  return items.reduce((a, b) => a + b, 0);
}

// Undocumented exports — coverage gaps
export function undocOne(x: string): string {
  return x;
}

export function undocTwo(a: number, b: number): number {
  return a + b;
}

export const MAGIC_NUMBER = 42;

/** A user in the system. */
export interface User {
  id: string;
  name: string;
}

/** Internal helper type. */
export type Status = 'active' | 'inactive';
