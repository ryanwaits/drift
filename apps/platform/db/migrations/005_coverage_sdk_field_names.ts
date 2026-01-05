import type { Kysely } from 'kysely';

/**
 * Create coverage_snapshots table with SDK-aligned field names.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('coverage_snapshots')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('version', 'text')
    .addColumn('branch', 'text')
    .addColumn('commit_sha', 'text')
    // SDK-aligned field names
    .addColumn('coverage_score', 'integer', (col) => col.notNull())
    .addColumn('documented_exports', 'integer', (col) => col.notNull())
    .addColumn('total_exports', 'integer', (col) => col.notNull())
    .addColumn('drift_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('source', 'text', (col) => col.notNull().defaultTo('manual'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute();

  // Index for efficient project history queries
  await db.schema
    .createIndex('idx_coverage_snapshots_project_id')
    .on('coverage_snapshots')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_coverage_snapshots_created_at')
    .on('coverage_snapshots')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('coverage_snapshots').execute();
}
