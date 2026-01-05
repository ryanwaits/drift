import type { Database } from '@doccov/db';
import { betterAuth } from 'better-auth';
import type { Kysely } from 'kysely';
import { createPersonalOrg } from './hooks';

export interface AuthConfig {
  db: Kysely<Database>;
  siteUrl: string;
  github: {
    clientId: string;
    clientSecret: string;
  };
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    basePath: '/auth',

    database: {
      db: config.db,
      type: 'postgres',
    },

    emailAndPassword: {
      enabled: false,
    },

    socialProviders: {
      github: {
        clientId: config.github.clientId,
        clientSecret: config.github.clientSecret,
        scope: ['user:email', 'read:org'],
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 24 hours
    },

    user: {
      additionalFields: {
        githubId: { type: 'string', required: false },
        githubUsername: { type: 'string', required: false },
        plan: { type: 'string', defaultValue: 'free' },
        stripeCustomerId: { type: 'string', required: false },
      },
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await createPersonalOrg(config.db, user.id, user.name, user.email);
          },
        },
      },
    },

    trustedOrigins: [config.siteUrl],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export { createPersonalOrg } from './hooks';
