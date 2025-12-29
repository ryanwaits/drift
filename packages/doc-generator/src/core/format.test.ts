import { describe, expect, test } from 'bun:test';
import type { SpecMember } from '@openpkg-ts/spec';
import { formatBadges, getMemberBadges } from './format';

describe('getMemberBadges', () => {
  test('returns empty array for public member with no flags', () => {
    const member: SpecMember = { name: 'foo' };
    expect(getMemberBadges(member)).toEqual([]);
  });

  test('returns empty array for explicit public visibility', () => {
    const member: SpecMember = { name: 'foo', visibility: 'public' };
    expect(getMemberBadges(member)).toEqual([]);
  });

  test('includes non-public visibility', () => {
    const privateMember: SpecMember = { name: 'foo', visibility: 'private' };
    expect(getMemberBadges(privateMember)).toEqual(['private']);

    const protectedMember: SpecMember = { name: 'bar', visibility: 'protected' };
    expect(getMemberBadges(protectedMember)).toEqual(['protected']);
  });

  test('includes static flag', () => {
    const member: SpecMember = { name: 'foo', flags: { static: true } };
    expect(getMemberBadges(member)).toEqual(['static']);
  });

  test('includes readonly flag', () => {
    const member: SpecMember = { name: 'foo', flags: { readonly: true } };
    expect(getMemberBadges(member)).toEqual(['readonly']);
  });

  test('includes async flag', () => {
    const member: SpecMember = { name: 'foo', flags: { async: true } };
    expect(getMemberBadges(member)).toEqual(['async']);
  });

  test('includes abstract flag', () => {
    const member: SpecMember = { name: 'foo', flags: { abstract: true } };
    expect(getMemberBadges(member)).toEqual(['abstract']);
  });

  test('combines visibility and multiple flags', () => {
    const member: SpecMember = {
      name: 'foo',
      visibility: 'protected',
      flags: { static: true, readonly: true, async: true },
    };
    expect(getMemberBadges(member)).toEqual(['protected', 'static', 'readonly', 'async']);
  });

  test('ignores false flags', () => {
    const member: SpecMember = {
      name: 'foo',
      flags: { static: false, readonly: true },
    };
    expect(getMemberBadges(member)).toEqual(['readonly']);
  });
});

describe('formatBadges', () => {
  test('returns empty string for empty array', () => {
    expect(formatBadges([])).toBe('');
  });

  test('returns single badge', () => {
    expect(formatBadges(['static'])).toBe('static');
  });

  test('joins multiple badges with space', () => {
    expect(formatBadges(['private', 'static', 'readonly'])).toBe('private static readonly');
  });
});
