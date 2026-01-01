'use client';

import type { SpecSchema, SpecSignatureParameter } from '@openpkg-ts/spec';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatSchema } from '../../core/query';

export interface ParameterItemProps {
  /** Parameter to display */
  param: SpecSignatureParameter;
  /** Nesting depth for indentation */
  depth?: number;
  /** Custom className */
  className?: string;
}

export interface NestedPropertyItemProps {
  /** Property name */
  name: string;
  /** Property schema */
  schema: SpecSchema;
  /** Is this property required */
  required?: boolean;
  /** Nesting depth */
  depth?: number;
}

function getNestedProperties(schema: SpecSchema): Record<string, SpecSchema> | null {
  if (!schema || typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  if (s.type === 'object' && s.properties && typeof s.properties === 'object') {
    return s.properties as Record<string, SpecSchema>;
  }
  return null;
}

function getRequiredFields(schema: SpecSchema): string[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  if (Array.isArray(s.required)) {
    return s.required as string[];
  }
  return [];
}

function countProperties(schema: SpecSchema): number {
  const props = getNestedProperties(schema);
  return props ? Object.keys(props).length : 0;
}

/**
 * Renders a nested property with expand capability.
 */
function NestedPropertyItem({
  name,
  schema,
  required = false,
  depth = 0,
}: NestedPropertyItemProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatSchema(schema);
  const nestedProps = getNestedProperties(schema);
  const nestedCount = countProperties(schema);
  const hasNested = nestedCount > 0;

  const schemaObj = schema as Record<string, unknown> | null;
  const description = schemaObj?.description as string | undefined;

  return (
    <div
      className={cn('border-t border-border first:border-t-0', depth > 0 && 'ml-4')}
    >
      <div className="py-3">
        <div className="flex items-start gap-2">
          {/* Expand button */}
          {hasNested && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  expanded && 'rotate-90',
                )}
              />
            </button>
          )}
          {!hasNested && <div className="w-5" />}

          <div className="flex-1 min-w-0">
            {/* Name + type */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm text-foreground">
                {name}
                {!required && (
                  <span className="text-muted-foreground">?</span>
                )}
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                {hasNested ? 'object' : type}
              </span>
              {hasNested && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {nestedCount} {nestedCount === 1 ? 'property' : 'properties'}
                </button>
              )}
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nested properties */}
      {hasNested && expanded && nestedProps && (
        <div className="border-l border-border ml-2">
          {Object.entries(nestedProps).map(([propName, propSchema]) => (
            <NestedPropertyItem
              key={propName}
              name={propName}
              schema={propSchema}
              required={getRequiredFields(schema).includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single parameter with expand capability for nested objects.
 * Features expandable nested params, type annotations, and required/optional badges.
 *
 * @deprecated Use APIParameterItem from @openpkg-ts/ui with specParamToAPIParam adapter.
 * Will be removed in next major version.
 */
export function ParameterItem({
  param,
  depth = 0,
  className,
}: ParameterItemProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = formatSchema(param.schema);
  const isRequired = param.required !== false;
  const nestedProps = getNestedProperties(param.schema);
  const nestedCount = countProperties(param.schema);
  const hasNested = nestedCount > 0;

  return (
    <div className={cn('border-b border-border last:border-b-0', className)}>
      <div className="py-3">
        <div className="flex items-start gap-2">
          {/* Expand button */}
          {hasNested && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  expanded && 'rotate-90',
                )}
              />
            </button>
          )}
          {!hasNested && <div className="w-5" />}

          <div className="flex-1 min-w-0">
            {/* Name + badges + type */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-foreground">
                {param.name}
              </span>
              {isRequired && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground uppercase tracking-wide">
                  Required
                </span>
              )}
              <span className="font-mono text-sm text-muted-foreground">
                {hasNested ? 'object' : type}
              </span>
              {hasNested && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {nestedCount} {nestedCount === 1 ? 'property' : 'properties'}
                </button>
              )}
            </div>

            {/* Description */}
            {param.description && (
              <p className="text-sm text-muted-foreground mt-1">{param.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nested properties */}
      {hasNested && expanded && nestedProps && (
        <div className="border-l border-border ml-2 mb-3">
          {Object.entries(nestedProps).map(([propName, propSchema]) => (
            <NestedPropertyItem
              key={propName}
              name={propName}
              schema={propSchema}
              required={getRequiredFields(param.schema).includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
