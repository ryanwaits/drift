'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ParameterSchema {
  /** Type name (e.g., "string", "number", "object") */
  type?: string;
  /** Formatted type string for display */
  typeString?: string;
  /** Description of the parameter/property */
  description?: string;
  /** Nested properties for object types */
  properties?: Record<string, ParameterSchema>;
  /** Required property names */
  required?: string[];
}

export interface ParameterItemProps {
  /** Parameter name */
  name: string;
  /** Parameter schema */
  schema: ParameterSchema;
  /** Whether this parameter is required */
  required?: boolean;
  /** Description (overrides schema.description) */
  description?: string;
  /** Nesting depth for indentation */
  depth?: number;
  /** Custom className */
  className?: string;
}

export interface NestedPropertyItemProps {
  /** Property name */
  name: string;
  /** Property schema */
  schema: ParameterSchema;
  /** Is this property required */
  required?: boolean;
  /** Nesting depth */
  depth?: number;
}

function getNestedProperties(schema: ParameterSchema): Record<string, ParameterSchema> | null {
  if (!schema || typeof schema !== 'object') return null;
  if (schema.type === 'object' && schema.properties) {
    return schema.properties;
  }
  return null;
}

function getRequiredFields(schema: ParameterSchema): string[] {
  return schema.required ?? [];
}

function countProperties(schema: ParameterSchema): number {
  const props = getNestedProperties(schema);
  return props ? Object.keys(props).length : 0;
}

function getTypeDisplay(schema: ParameterSchema): string {
  if (schema.typeString) return schema.typeString;
  return schema.type ?? 'unknown';
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
  const type = getTypeDisplay(schema);
  const nestedProps = getNestedProperties(schema);
  const nestedCount = countProperties(schema);
  const hasNested = nestedCount > 0;

  return (
    <div className={cn('border-t border-border first:border-t-0', depth > 0 && 'ml-4')}>
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
                className={cn('transition-transform duration-200', expanded && 'rotate-90')}
              />
            </button>
          )}
          {!hasNested && <div className="w-5" />}

          <div className="flex-1 min-w-0">
            {/* Name + type */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm text-foreground">
                {name}
                {!required && <span className="text-muted-foreground">?</span>}
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
            {schema.description && (
              <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
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
 */
export function ParameterItem({
  name,
  schema,
  required: isRequired = true,
  description,
  depth = 0,
  className,
}: ParameterItemProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const type = getTypeDisplay(schema);
  const nestedProps = getNestedProperties(schema);
  const nestedCount = countProperties(schema);
  const hasNested = nestedCount > 0;
  const displayDescription = description ?? schema.description;

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
                className={cn('transition-transform duration-200', expanded && 'rotate-90')}
              />
            </button>
          )}
          {!hasNested && <div className="w-5" />}

          <div className="flex-1 min-w-0">
            {/* Name + badges + type */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-foreground">{name}</span>
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
            {displayDescription && (
              <p className="text-sm text-muted-foreground mt-1">{displayDescription}</p>
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
              required={getRequiredFields(schema).includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
