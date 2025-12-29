'use client';

import type { SpecMember } from '@openpkg-ts/spec';
import { getMemberBadges } from '../../core/format';
import { formatSchema } from '../../core/query';

export interface MembersTableProps {
  /** Members to display */
  members: SpecMember[];
  /** Custom className */
  className?: string;
  /** Group by kind (constructor, property, method) */
  groupByKind?: boolean;
  /** Custom member renderer */
  renderMember?: (member: SpecMember, index: number) => React.ReactNode;
}

export interface MemberGroups {
  constructors: SpecMember[];
  properties: SpecMember[];
  methods: SpecMember[];
  accessors: SpecMember[];
  other: SpecMember[];
}

/**
 * Group members by their kind.
 */
export function groupMembersByKind(members: SpecMember[]): MemberGroups {
  const groups: MemberGroups = {
    constructors: [],
    properties: [],
    methods: [],
    accessors: [],
    other: [],
  };

  for (const member of members) {
    const kind = member.kind?.toLowerCase() ?? 'other';
    if (kind === 'constructor') {
      groups.constructors.push(member);
    } else if (kind === 'property' || kind === 'field') {
      groups.properties.push(member);
    } else if (kind === 'method' || kind === 'function') {
      groups.methods.push(member);
    } else if (kind === 'getter' || kind === 'setter' || kind === 'accessor') {
      groups.accessors.push(member);
    } else {
      groups.other.push(member);
    }
  }

  return groups;
}

export interface MemberRowProps {
  member: SpecMember;
}

/**
 * Individual member row.
 */
export function MemberRow({ member }: MemberRowProps): React.ReactNode {
  const type = formatSchema(member.schema);

  // For methods, build signature
  const sig = member.signatures?.[0];
  let signature = '';
  if (sig) {
    const params =
      sig.parameters?.map((p) => {
        const optional = p.required === false ? '?' : '';
        return `${p.name}${optional}: ${formatSchema(p.schema)}`;
      }) ?? [];
    const returnType = formatSchema(sig.returns?.schema) ?? 'void';
    signature = `(${params.join(', ')}): ${returnType}`;
  }

  const badges = getMemberBadges(member);

  return (
    <div data-member={member.name}>
      <div>
        <code>
          {member.name}
          {signature}
        </code>
        {badges.length > 0 && (
          <span>
            {badges.map((badge) => (
              <span key={badge} data-badge={badge}>
                {badge}
              </span>
            ))}
          </span>
        )}
      </div>
      {!signature && type !== 'unknown' && <code>{type}</code>}
      {member.description && <p>{member.description}</p>}
    </div>
  );
}

/**
 * Headless members table for classes/interfaces.
 *
 * @example
 * ```tsx
 * <MembersTable members={exp.members} groupByKind />
 * ```
 */
export function MembersTable({
  members,
  className,
  groupByKind = false,
  renderMember,
}: MembersTableProps): React.ReactNode {
  if (!members?.length) return null;

  if (!groupByKind) {
    return (
      <div className={className}>
        {members.map((member, index) =>
          renderMember ? (
            renderMember(member, index)
          ) : (
            <MemberRow key={member.name ?? index} member={member} />
          ),
        )}
      </div>
    );
  }

  const groups = groupMembersByKind(members);

  return (
    <div className={className}>
      {groups.constructors.length > 0 && (
        <section data-group="constructors">
          <h4>Constructor</h4>
          {groups.constructors.map((member, index) =>
            renderMember ? (
              renderMember(member, index)
            ) : (
              <MemberRow key={member.name ?? index} member={member} />
            ),
          )}
        </section>
      )}

      {groups.properties.length > 0 && (
        <section data-group="properties">
          <h4>Properties</h4>
          {groups.properties.map((member, index) =>
            renderMember ? (
              renderMember(member, index)
            ) : (
              <MemberRow key={member.name ?? index} member={member} />
            ),
          )}
        </section>
      )}

      {groups.methods.length > 0 && (
        <section data-group="methods">
          <h4>Methods</h4>
          {groups.methods.map((member, index) =>
            renderMember ? (
              renderMember(member, index)
            ) : (
              <MemberRow key={member.name ?? index} member={member} />
            ),
          )}
        </section>
      )}

      {groups.accessors.length > 0 && (
        <section data-group="accessors">
          <h4>Accessors</h4>
          {groups.accessors.map((member, index) =>
            renderMember ? (
              renderMember(member, index)
            ) : (
              <MemberRow key={member.name ?? index} member={member} />
            ),
          )}
        </section>
      )}
    </div>
  );
}
