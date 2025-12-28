'use client';

import { CodeBlockSkeleton, TerminalSkeleton } from '@doccov/ui/docskit';
import dynamic from 'next/dynamic';

const DocsKitShowcase = dynamic(
  () => import('./docskit-showcase').then((mod) => ({ default: mod.DocsKitShowcase })),
  {
    ssr: false,
    loading: () => <DocsKitShowcaseSkeleton />,
  },
);

export function DocsKitShowcaseWrapper() {
  return <DocsKitShowcase />;
}

function DocsKitShowcaseSkeleton() {
  return (
    <div className="space-y-8">
      {/* Terminal skeletons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Terminal (macOS style)</p>
        <TerminalSkeleton lines={1} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Terminal with multiple commands
        </p>
        <TerminalSkeleton lines={4} />
      </div>

      {/* Package Install skeletons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Package Install (with package manager tabs)
        </p>
        <TerminalSkeleton lines={1} />
      </div>

      {/* Code block skeletons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Title & Copy Button
        </p>
        <CodeBlockSkeleton hasTitle lines={12} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Code Block (No Title)</p>
        <CodeBlockSkeleton hasTitle={false} lines={1} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Line Numbers (-n flag)
        </p>
        <CodeBlockSkeleton hasTitle lines={12} />
      </div>
    </div>
  );
}
