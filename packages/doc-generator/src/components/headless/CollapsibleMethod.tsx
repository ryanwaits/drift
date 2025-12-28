'use client';

import type { SpecMember } from '@openpkg-ts/spec';
import { useEffect, useState } from 'react';
import { formatReturnType, formatSchema } from '../../core/query';

export interface CollapsibleMethodProps {
  /** Method member to display */
  member: SpecMember;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Custom className */
  className?: string;
  /** Custom header renderer */
  renderHeader?: (member: SpecMember, expanded: boolean, toggle: () => void) => React.ReactNode;
  /** Custom content renderer */
  renderContent?: (member: SpecMember) => React.ReactNode;
}

function formatParamPreview(params: { name?: string }[] | undefined): string {
  if (!params || params.length === 0) return '';
  if (params.length === 1) return params[0].name || 'arg';
  return `${params[0].name || 'arg'}, ...`;
}

/**
 * Headless collapsible method component.
 *
 * @example
 * ```tsx
 * <CollapsibleMethod member={method} defaultExpanded />
 *
 * // Custom rendering
 * <CollapsibleMethod
 *   member={method}
 *   renderHeader={(m, expanded, toggle) => (
 *     <button onClick={toggle}>{m.name}</button>
 *   )}
 * />
 * ```
 */
export function CollapsibleMethod({
  member,
  defaultExpanded = false,
  className,
  renderHeader,
  renderContent,
}: CollapsibleMethodProps): React.ReactNode {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const sig = member.signatures?.[0];
  const hasParams = sig?.parameters && sig.parameters.length > 0;
  const visibility = member.visibility ?? 'public';
  const flags = member.flags as Record<string, boolean> | undefined;
  const isStatic = flags?.static;
  const isAsync = flags?.async;

  const returnType = formatReturnType(sig);
  const paramPreview = formatParamPreview(sig?.parameters);

  const toggle = () => setExpanded(!expanded);

  // Auto-expand if URL hash matches
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === `#${member.name}`) {
      setExpanded(true);
    }
  }, [member.name]);

  const badges: string[] = [];
  if (visibility !== 'public') badges.push(visibility);
  if (isStatic) badges.push('static');
  if (isAsync) badges.push('async');

  return (
    <div id={member.name} className={className} data-expanded={expanded}>
      {/* Header */}
      {renderHeader ? (
        renderHeader(member, expanded, toggle)
      ) : (
        <button type="button" onClick={toggle} data-header>
          <span data-name>
            {member.name}
            <span data-params>({paramPreview})</span>
          </span>
          <span data-return>{returnType}</span>
          {badges.length > 0 && (
            <span data-badges>
              {badges.map((badge) => (
                <span key={badge} data-badge={badge}>
                  {badge}
                </span>
              ))}
            </span>
          )}
        </button>
      )}

      {/* Content */}
      {expanded &&
        (renderContent ? (
          renderContent(member)
        ) : (
          <div data-content>
            {member.description && <p>{member.description}</p>}

            {hasParams && (
              <div data-params-section>
                <h4>Parameters</h4>
                <ul>
                  {sig.parameters!.map((param, index) => (
                    <li key={param.name ?? index}>
                      <code>
                        {param.name}
                        {param.required === false && '?'}: {formatSchema(param.schema)}
                      </code>
                      {param.description && <span>{param.description}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sig?.returns && returnType !== 'void' && (
              <div data-returns-section>
                <h4>Returns</h4>
                <code>{returnType}</code>
                {sig.returns.description && <p>{sig.returns.description}</p>}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
