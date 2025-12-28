'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import { Search } from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { ExportCard } from './ExportCard';

export interface ExportIndexPageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Base href for links (e.g., '/docs/api') */
  baseHref: string;
  /** Optional intro description */
  description?: string;
  /** Custom className */
  className?: string;
  /** Show search input (default: true) */
  showSearch?: boolean;
  /** Show category filter buttons (default: true) */
  showFilters?: boolean;
}

type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable';

interface CategoryGroup {
  kind: ExportKind;
  label: string;
  exports: SpecExport[];
}

const KIND_ORDER: ExportKind[] = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
const KIND_LABELS: Record<ExportKind, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  type: 'Types',
  enum: 'Enums',
  variable: 'Variables',
};
const KIND_SLUGS: Record<ExportKind, string> = {
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  type: 'types',
  enum: 'enums',
  variable: 'variables',
};

function groupByKind(exports: SpecExport[]): CategoryGroup[] {
  const groups: Map<ExportKind, SpecExport[]> = new Map();

  for (const exp of exports) {
    const kind = (exp.kind as ExportKind) || 'variable';
    const normalizedKind = KIND_ORDER.includes(kind) ? kind : 'variable';
    const list = groups.get(normalizedKind) || [];
    list.push(exp);
    groups.set(normalizedKind, list);
  }

  return KIND_ORDER
    .filter((kind) => groups.has(kind))
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      exports: groups.get(kind)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Index page showing all exports in a grid, grouped by category.
 * AI SDK-style clean layout with responsive 2-column grid.
 */
export function ExportIndexPage({
  spec,
  baseHref,
  description,
  className,
  showSearch = true,
  showFilters = true,
}: ExportIndexPageProps): ReactNode {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExportKind | 'all'>('all');

  if (process.env.NODE_ENV !== 'production' && !baseHref) {
    console.warn('[ExportIndexPage] baseHref is undefined - links will be broken');
  }

  const allGroups = useMemo(() => groupByKind(spec.exports), [spec.exports]);

  // Filter by search and category
  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allGroups
      .filter((group) => activeFilter === 'all' || group.kind === activeFilter)
      .map((group) => ({
        ...group,
        exports: group.exports.filter((exp) => {
          if (!query) return true;
          return (
            exp.name.toLowerCase().includes(query) ||
            exp.description?.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((group) => group.exports.length > 0);
  }, [allGroups, searchQuery, activeFilter]);

  // Get available categories for filter buttons
  const availableKinds = useMemo(
    () => allGroups.map((g) => g.kind),
    [allGroups],
  );

  const totalExports = filteredGroups.reduce((sum, g) => sum + g.exports.length, 0);

  return (
    <div className={cn('space-y-8 not-prose', className)}>
      {/* Package header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {spec.meta.name || 'API Reference'}
        </h1>
        {(description || spec.meta.description) && (
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
            {description || spec.meta.description}
          </p>
        )}
      </div>

      {/* Search and filter controls */}
      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {/* Search input */}
          {showSearch && (
            <div className="relative max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search exports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2 rounded-lg',
                  'border border-border bg-background',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                  'transition-shadow',
                )}
              />
            </div>
          )}

          {/* Category filter buttons */}
          {showFilters && availableKinds.length > 1 && (
            <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {/* Results count when filtering */}
      {(searchQuery || activeFilter !== 'all') && (
        <p className="text-sm text-muted-foreground">
          {totalExports} {totalExports === 1 ? 'result' : 'results'}
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      )}

      {/* Category groups */}
      {filteredGroups.map((group) => (
        <section key={group.kind}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.exports.map((exp) => (
              <ExportCard
                key={exp.id}
                name={exp.name}
                description={exp.description}
                href={`${baseHref}/${KIND_SLUGS[group.kind]}/${exp.id}`}
                kind={exp.kind as ExportKind}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Empty state */}
      {filteredGroups.length === 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery || activeFilter !== 'all'
              ? 'No exports match your search.'
              : 'No exports found in this package.'}
          </p>
          {(searchQuery || activeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="mt-3 text-sm text-primary hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
