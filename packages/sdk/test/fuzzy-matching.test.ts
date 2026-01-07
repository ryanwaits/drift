import { describe, expect, it } from 'vitest';
import { findClosestMatch, splitCamelCase } from '../src/analysis/drift/utils';

describe('splitCamelCase', () => {
  it('splits camelCase', () => {
    expect(splitCamelCase('createUser')).toEqual(['create', 'user']);
  });

  it('splits PascalCase', () => {
    expect(splitCamelCase('CreateUser')).toEqual(['create', 'user']);
  });

  it('handles consecutive caps', () => {
    expect(splitCamelCase('parseHTMLString')).toEqual(['parse', 'html', 'string']);
  });
});

describe('findClosestMatch', () => {
  it('finds word-based match: fetchUser → fetchUserData (2+ matching words)', () => {
    // fetchUser has words ['fetch', 'user'], fetchUserData has ['fetch', 'user', 'data']
    // Both 'fetch' and 'user' match, and 'user' is suffix match
    const result = findClosestMatch('fetchUser', ['fetchUserData', 'createUser', 'deleteData']);
    expect(result?.value).toBe('fetchUserData');
  });

  it('finds suffix match: getUserById → getUserByName', () => {
    // Words: ['get', 'user', 'by', 'id'] vs ['get', 'user', 'by', 'name']
    // Matches: get, user, by (3 words) - good match
    const result = findClosestMatch('getUserById', ['getUserByName', 'setUserById']);
    expect(result?.value).toBe('getUserByName');
  });

  it('returns undefined for no good match (single word overlap)', () => {
    // createUsr → ['create', 'usr'] vs createUser → ['create', 'user']
    // Only 'create' matches (usr != user), not enough overlap
    const result = findClosestMatch('createUsr', ['createUser']);
    expect(result).toBeUndefined();
  });

  it('returns undefined for completely different names', () => {
    const result = findClosestMatch('x', ['createUser', 'fetchData']);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty candidates', () => {
    const result = findClosestMatch('createUser', []);
    expect(result).toBeUndefined();
  });

  it('skips exact matches', () => {
    // createUser exact match skipped, createUsers is close enough in length
    const result = findClosestMatch('createUser', ['createUser', 'createUsers']);
    // createUsers has words ['create', 'users'] vs ['create', 'user']
    // Only 1 word matches, so no good match found
    expect(result).toBeUndefined();
  });

  it('pre-filter reduces candidates by first char', () => {
    // 'fetchData' starts with 'f', candidates starting with other letters filtered
    // Only 'fetchUserData' passes filter (starts with 'f', length within ±3)
    const candidates = ['createUser', 'deleteUser', 'fetchUserData', 'updateUser'];
    const result = findClosestMatch('fetchData', candidates);
    expect(result?.value).toBe('fetchUserData');
  });

  it('pre-filter reduces candidates by length', () => {
    // 'abc' (3 chars) - candidates must be 0-6 chars to pass filter
    // 'abcdefghij' (10 chars) filtered out by length
    const result = findClosestMatch('abc', ['abcdefghij']);
    expect(result).toBeUndefined();
  });

  it('falls back to first 50 when filter too aggressive', () => {
    // All candidates start with 'z', source starts with 'f'
    // Filter returns empty, falls back to first 50
    const candidates = Array.from({ length: 100 }, (_, i) => `zzzzItem${i}`);
    const result = findClosestMatch('fetchData', candidates);
    // No good match in fallback list either
    expect(result).toBeUndefined();
  });
});
