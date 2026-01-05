import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Better-auth expects singular table names
  await db.schema.alterTable('users').renameTo('user').execute();
  await db.schema.alterTable('sessions').renameTo('session').execute();
  await db.schema.alterTable('accounts').renameTo('account').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('user').renameTo('users').execute();
  await db.schema.alterTable('session').renameTo('sessions').execute();
  await db.schema.alterTable('account').renameTo('accounts').execute();
}
