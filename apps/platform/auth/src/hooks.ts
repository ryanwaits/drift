import type { Database } from '@doccov/db';
import type { Kysely } from 'kysely';
import { nanoid } from 'nanoid';

export async function createPersonalOrg(
  db: Kysely<Database>,
  userId: string,
  userName: string | null,
  email: string,
) {
  const orgId = nanoid(21);
  const baseName = userName || email.split('@')[0];
  const slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

  // Ensure unique slug
  const existing = await db
    .selectFrom('organizations')
    .where('slug', '=', slug)
    .select('id')
    .executeTakeFirst();

  const finalSlug = existing ? `${slug}-${nanoid(6)}` : slug;

  await db
    .insertInto('organizations')
    .values({
      id: orgId,
      name: baseName,
      slug: finalSlug,
      isPersonal: true,
      plan: 'free',
      aiCallsUsed: 0,
    })
    .execute();

  await db
    .insertInto('org_members')
    .values({
      id: nanoid(21),
      orgId: orgId,
      userId: userId,
      role: 'owner',
    })
    .execute();

  return orgId;
}
