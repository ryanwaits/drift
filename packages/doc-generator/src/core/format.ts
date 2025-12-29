import type { SpecMember } from '@openpkg-ts/spec';

/**
 * Extract badge strings from a member's visibility and flags.
 * Handles: visibility (if not public), static, readonly, async, abstract
 */
export function getMemberBadges(member: SpecMember): string[] {
  const badges: string[] = [];

  const visibility = member.visibility ?? 'public';
  if (visibility !== 'public') {
    badges.push(visibility);
  }

  const flags = member.flags as Record<string, boolean> | undefined;
  if (flags?.static) badges.push('static');
  if (flags?.readonly) badges.push('readonly');
  if (flags?.async) badges.push('async');
  if (flags?.abstract) badges.push('abstract');

  return badges;
}

/**
 * Format badges array into a display string (space-separated).
 */
export function formatBadges(badges: string[]): string {
  return badges.join(' ');
}
