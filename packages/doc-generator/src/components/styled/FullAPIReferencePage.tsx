'use client';

import type { OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/spec';
import { APIReferencePage } from '@openpkg-ts/ui/docskit';
import { cn } from '@openpkg-ts/ui/lib/utils';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExportSection } from './sections/ExportSection';

export interface FullAPIReferencePageProps {
  /** OpenPkg spec */
  spec: OpenPkg;
  /** Filter to specific kinds (default: all) */
  kinds?: SpecExportKind[];
  /** Show kind filter buttons (default: true) */
  showFilters?: boolean;
  /** Show in-page TOC navigation (default: false) */
  showTOC?: boolean;
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

/** Get display title for an export based on kind */
function getExportTitle(exp: SpecExport): string {
  switch (exp.kind) {
    case 'function':
      return `${exp.name}()`;
    case 'class':
      return `class ${exp.name}`;
    case 'interface':
    case 'type':
      return exp.name;
    case 'enum':
      return `enum ${exp.name}`;
    default:
      return exp.name;
  }
}

/**
 * Single-page API reference that renders all exports in a scrollable view.
 * Similar to Stripe's API documentation layout.
 *
 * @example
 * ```tsx
 * // Show all exports with TOC
 * <FullAPIReferencePage spec={spec} showTOC />
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
  showTOC = false,
  title,
  description,
  className,
}: FullAPIReferencePageProps): ReactNode {
  const [activeFilter, setActiveFilter] = useState<ExportKind | 'all'>('all');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const isScrollingRef = useRef(false);

  // Get available kinds from the spec
  const availableKinds = useMemo(() => {
    const kindSet = new Set<ExportKind>();
    for (const exp of spec.exports) {
      const kind = exp.kind as ExportKind;
      if (KIND_ORDER.includes(kind)) {
        kindSet.add(kind);
      }
    }
    return KIND_ORDER.filter((k) => kindSet.has(k));
  }, [spec.exports]);

  // Filter exports
  const filteredExports = useMemo(() => {
    let exports = spec.exports;

    // Filter by allowed kinds prop
    if (kinds?.length) {
      exports = exports.filter((e) => kinds.includes(e.kind as SpecExportKind));
    }

    // Filter by active filter button
    if (activeFilter !== 'all') {
      exports = exports.filter((e) => e.kind === activeFilter);
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

  // Group exports by kind for TOC
  const groupedExports = useMemo(() => {
    const groups = new Map<ExportKind, SpecExport[]>();
    for (const exp of filteredExports) {
      const kind = exp.kind as ExportKind;
      if (!groups.has(kind)) {
        groups.set(kind, []);
      }
      groups.get(kind)!.push(exp);
    }
    return groups;
  }, [filteredExports]);

  // Scroll to section on initial load if hash present
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.slice(1);
    if (hash) {
      // Delay to ensure sections are rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          isScrollingRef.current = true;
          element.scrollIntoView({ behavior: 'smooth' });
          setActiveSection(hash);
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 1000);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // IntersectionObserver for scroll tracking
  useEffect(() => {
    if (!showTOC || typeof window === 'undefined') return;

    const sectionIds = filteredExports.map((exp) => exp.id || exp.name);
    const _observers: IntersectionObserver[] = [];

    // Create observer for each section
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrollingRef.current) return;

      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          const id = entry.target.id;
          setActiveSection(id);
          // Update URL hash without scrolling
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `#${id}`);
          }
          break;
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    });

    // Observe all sections
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [showTOC, filteredExports]);

  // Handle TOC link click
  const handleTOCClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      isScrollingRef.current = true;
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
      window.history.replaceState(null, '', `#${id}`);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 1000);
    }
  }, []);

  // Build description with version
  const defaultDescription = (
    <div>
      {spec.meta.description && <p>{spec.meta.description}</p>}
      {spec.meta.version && (
        <p className="text-sm text-muted-foreground mt-2">Version {spec.meta.version}</p>
      )}
    </div>
  );

  // Only show filters if not constrained by kinds prop
  const shouldShowFilters = showFilters && !kinds?.length && availableKinds.length > 1;

  return (
    <div
      className={cn(
        'doccov-full-reference-page not-prose',
        showTOC && 'lg:grid lg:grid-cols-[220px_1fr] lg:gap-8',
        className,
      )}
    >
      {/* TOC Sidebar */}
      {showTOC && (
        <aside className="hidden lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">On this page</h4>
            <div className="space-y-4">
              {KIND_ORDER.map((kind) => {
                const exports = groupedExports.get(kind);
                if (!exports?.length) return null;

                return (
                  <div key={kind}>
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      {KIND_LABELS[kind]}
                    </h5>
                    <ul className="space-y-1">
                      {exports.map((exp) => {
                        const id = exp.id || exp.name;
                        const isActive = activeSection === id;
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              onClick={() => handleTOCClick(id)}
                              className={cn(
                                'block w-full text-left text-sm py-1 px-2 rounded-md transition-colors cursor-pointer truncate',
                                isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                              )}
                              title={getExportTitle(exp)}
                            >
                              {getExportTitle(exp)}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </nav>
        </aside>
      )}

      {/* Main content */}
      <div>
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
    </div>
  );
}
