import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Users (Better Auth)
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('email_verified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('name', 'text')
    .addColumn('image', 'text')
    .addColumn('github_id', 'text', (col) => col.unique())
    .addColumn('github_username', 'text')
    .addColumn('plan', 'text', (col) => col.defaultTo('free'))
    .addColumn('stripe_customer_id', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Sessions (Better Auth)
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Accounts (Better Auth OAuth)
  await db.schema
    .createTable('accounts')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('account_id', 'text', (col) => col.notNull())
    .addColumn('provider_id', 'text', (col) => col.notNull())
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('access_token_expires_at', 'timestamptz')
    .addColumn('refresh_token_expires_at', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('id_token', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Organizations
  await db.schema
    .createTable('organizations')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('is_personal', 'boolean', (col) => col.defaultTo(false))
    .addColumn('github_org', 'text')
    .addColumn('github_installation_id', 'text')
    .addColumn('plan', 'text', (col) => col.defaultTo('free'))
    .addColumn('stripe_subscription_id', 'text')
    .addColumn('ai_calls_used', 'integer', (col) => col.defaultTo(0))
    .addColumn('ai_calls_reset_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Org Members
  await db.schema
    .createTable('org_members')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('org_id', 'text', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // API Keys
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('org_id', 'text', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('key_hash', 'text', (col) => col.notNull())
    .addColumn('key_prefix', 'text', (col) => col.notNull())
    .addColumn('scopes', 'text')
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Projects
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('org_id', 'text', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('full_name', 'text', (col) => col.notNull())
    .addColumn('is_private', 'boolean', (col) => col.defaultTo(false))
    .addColumn('default_branch', 'text', (col) => col.defaultTo('main'))
    .addColumn('coverage_score', 'integer')
    .addColumn('drift_count', 'integer')
    .addColumn('last_analyzed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Usage Records
  await db.schema
    .createTable('usage_records')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('org_id', 'text', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('feature', 'text', (col) => col.notNull())
    .addColumn('count', 'integer', (col) => col.defaultTo(1))
    .addColumn('metadata', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Indexes
  await db.schema.createIndex('idx_sessions_user_id').on('sessions').column('user_id').execute();
  await db.schema.createIndex('idx_sessions_token').on('sessions').column('token').execute();
  await db.schema.createIndex('idx_accounts_user_id').on('accounts').column('user_id').execute();
  await db.schema
    .createIndex('idx_org_members_org_id')
    .on('org_members')
    .column('org_id')
    .execute();
  await db.schema
    .createIndex('idx_org_members_user_id')
    .on('org_members')
    .column('user_id')
    .execute();
  await db.schema.createIndex('idx_projects_org_id').on('projects').column('org_id').execute();
  await db.schema.createIndex('idx_api_keys_org_id').on('api_keys').column('org_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('usage_records').execute();
  await db.schema.dropTable('projects').execute();
  await db.schema.dropTable('api_keys').execute();
  await db.schema.dropTable('org_members').execute();
  await db.schema.dropTable('organizations').execute();
  await db.schema.dropTable('accounts').execute();
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('users').execute();
}
