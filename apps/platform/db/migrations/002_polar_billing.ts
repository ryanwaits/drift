import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organizations')
    .addColumn('polar_customer_id', 'text')
    .addColumn('polar_subscription_id', 'text')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('organizations')
    .dropColumn('polar_customer_id')
    .dropColumn('polar_subscription_id')
    .execute();
}
