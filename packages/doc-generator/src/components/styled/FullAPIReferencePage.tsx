'use client';

import type { OpenPkg, SpecExportKind } from '@openpkg-ts/spec';
import { APIReferencePage } from '@doccov/ui/docskit';
import { cn } from '@doccov/ui/lib/utils';
import { useState, useMemo, type ReactNode } from 'react';
import { ExportSection } from './sections/ExportSection';

export interface FullAPIReferencePageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Filter to specific kinds (default: all) */
  kinds?: SpecExportKind[];
  /** Show kind filter buttons (default: true) */
  showFilters?: boolean;
  /** Custom title (default: spec.meta.name) */
  title?: string;
  /** Custom description */
  description?: ReactNode;
  /** Custom className */
  className?: string;
}

type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable';

const KIND_ORDER: ExportKind[] = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
const KIND_LABELS: Record<ExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
};

/**
 * Single-page API reference that renders all exports in a scrollable view.
 * Similar to Stripe's API documentation layout.
 *
 * @example
 * ```tsx
 * // Show all exports
 * <FullAPIReferencePage spec={spec} />
 * ```
 *
 * @example
 * ```tsx
 * // Show only functions
 * <FullAPIReferencePage spec={spec} kinds={['function']} title="Functions" />
 * ```
 */
export function FullAPIReferencePage({
  spec,
  kinds,
  showFilters = true,
  title,
  description,
  className,
}: FullAPIReferencePageProps): ReactNode {
  const [activeFilter, setActiveFilter] = useState<ExportKind | 'all'>('all');

  // Get available kinds from the spec
  const availableKinds = useMemo(() => {
    const kindSet = new Set<ExportKind>();
    for (const exp of spec.exports) {
      const kind = exp.kind as ExportKind;
      if (KIND_ORDER.includes(kind)) {
        kindSet.add(kind);
      }
    }
    return KIND_ORDER.filter(k => kindSet.has(k));
  }, [spec.exports]);

  // Filter exports
  const filteredExports = useMemo(() => {
    let exports = spec.exports;

    // Filter by allowed kinds prop
    if (kinds?.length) {
      exports = exports.filter(e => kinds.includes(e.kind as SpecExportKind));
    }

    // Filter by active filter button
    if (activeFilter !== 'all') {
      exports = exports.filter(e => e.kind === activeFilter);
    }

    // Sort by kind order, then alphabetically
    return exports.sort((a, b) => {
      const kindOrderA = KIND_ORDER.indexOf(a.kind as ExportKind);
      const kindOrderB = KIND_ORDER.indexOf(b.kind as ExportKind);
      if (kindOrderA !== kindOrderB) {
        return kindOrderA - kindOrderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [spec.exports, kinds, activeFilter]);

  // Build description with version
  const defaultDescription = (
    <div>
      {spec.meta.description && <p>{spec.meta.description}</p>}
      {spec.meta.version && (
        <p className="text-sm text-muted-foreground mt-2">
          Version {spec.meta.version}
        </p>
      )}
    </div>
  );

  // Only show filters if not constrained by kinds prop
  const shouldShowFilters = showFilters && !kinds?.length && availableKinds.length > 1;

  return (
    <div className={cn('not-prose', className)}>
      <APIReferencePage
        title={title || spec.meta.name || 'API Reference'}
        description={description || defaultDescription}
      >
        {/* Kind filter buttons */}
        {shouldShowFilters && (
          <div className="flex flex-wrap gap-2 mb-8 -mt-4">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-all cursor-pointer',
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              All
            </button>
            {availableKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveFilter(kind)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-all cursor-pointer',
                  activeFilter === kind
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}

        {/* Export sections */}
        {filteredExports.map((exp) => (
          <ExportSection key={exp.id || exp.name} export={exp} spec={spec} />
        ))}

        {/* Empty state */}
        {filteredExports.length === 0 && (
          <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">
              {activeFilter !== 'all'
                ? `No ${KIND_LABELS[activeFilter].toLowerCase()} found.`
                : 'No exports found in this package.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="mt-3 text-sm text-primary hover:underline cursor-pointer"
              >
                Show all exports
              </button>
            )}
          </div>
        )}
      </APIReferencePage>
    </div>
  );
}
