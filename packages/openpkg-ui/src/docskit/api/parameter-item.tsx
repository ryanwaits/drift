'use client';

import { ChevronRight, Copy, Check } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface APIParameterSchema {
  /** Type name */
  type?: string;
  /** Formatted type string */
  typeString?: string;
  /** Description */
  description?: string;
  /** Nested properties for object types */
  properties?: Record<string, APIParameterSchema>;
  /** Required property names */
  required?: string[];
}

export interface APIParameterItemProps {
  /** Parameter name */
  name: string;
  /** Type string (e.g., "string", "object") */
  type: string;
  /** Is required */
  required?: boolean;
  /** Description */
  description?: string;
  /** Nested children (for expandable objects) */
  children?: APIParameterSchema;
  /** Nesting depth */
  depth?: number;
  /** Custom className */
  className?: string;
}

function NestedProperty({
  name,
  schema,
  required = false,
  depth = 0,
}: {
  name: string;
  schema: APIParameterSchema;
  required?: boolean;
  depth?: number;
}): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const type = schema.typeString ?? schema.type ?? 'unknown';
  const hasNested = schema.properties && Object.keys(schema.properties).length > 0;
  const nestedCount = hasNested ? Object.keys(schema.properties!).length : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={cn('border-t border-border first:border-t-0', depth > 0 && 'ml-4')}>
      <div className="group py-4">
        <div className="flex items-start gap-2">
          {/* Expand button */}
          {hasNested ? (
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
          ) : (
            <div className="w-5" />
          )}

          <div className="flex-1 min-w-0">
            {/* Name + type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-foreground">
                {name}
                {!required && <span className="text-muted-foreground">?</span>}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{type}</span>
              {hasNested && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Show child parameters
                </button>
              )}
              {/* Copy button on hover */}
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Copy name"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            {/* Description */}
            {schema.description && (
              <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nested properties */}
      {hasNested && expanded && schema.properties && (
        <div className="border-l border-border ml-2 mb-3">
          {Object.entries(schema.properties).map(([propName, propSchema]) => (
            <NestedProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={schema.required?.includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single parameter row with name, type, required badge, description, and expandable children.
 * Stripe-style API reference parameter display.
 */
export function APIParameterItem({
  name,
  type,
  required = false,
  description,
  children,
  depth = 0,
  className,
}: APIParameterItemProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasNested = children?.properties && Object.keys(children.properties).length > 0;
  const nestedCount = hasNested ? Object.keys(children!.properties!).length : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={cn('border-b border-border last:border-b-0', className)}>
      <div className="group py-4">
        <div className="flex items-start gap-2">
          {/* Expand button */}
          {hasNested ? (
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
          ) : (
            <div className="w-5" />
          )}

          <div className="flex-1 min-w-0">
            {/* Name + badges + type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-foreground">{name}</span>
              {required && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground uppercase tracking-wide">
                  Required
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{type}</span>
              {hasNested && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Show child parameters
                </button>
              )}
              {/* Copy button on hover */}
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Copy name"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            {/* Description */}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        </div>
      </div>

      {/* Nested properties */}
      {hasNested && expanded && children?.properties && (
        <div className="border-l border-border ml-2 mb-3">
          {Object.entries(children.properties).map(([propName, propSchema]) => (
            <NestedProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={children.required?.includes(propName)}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
