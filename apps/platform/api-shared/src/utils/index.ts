export { generateApiKey, hashApiKey, isValidKeyFormat } from './api-keys';
// NOTE: spec-diff and spec-cache are NOT exported here to avoid SDK dependency
// Routes that need them should import SDK directly with runtime = 'nodejs'
