'use client';

import { KindBadge, StatusBadge } from '@doccov/ui/badge';
import { Breadcrumb, type BreadcrumbItem } from '@doccov/ui/breadcrumb';
import { Button } from '@doccov/ui/button';
import { FileChangeList, FileChangeRow } from '@doccov/ui/file-change-row';
import { FileChip } from '@doccov/ui/file-chip';
import { Input, InputWithButton, SearchInput } from '@doccov/ui/input';
import { SegmentedTabs, type TabCell } from '@doccov/ui/tabs';
import { Check, Download, Moon, Plus, Settings, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function DesignSystemClient() {
  const [isDark, setIsDark] = useState(false);
  const [activeCellTab, setActiveCellTab] = useState('chat');
  const [cellTabs, setCellTabs] = useState<TabCell[]>([
    { id: 'chat', type: 'text', label: 'Chat' },
    { id: 'coverage', type: 'progress', label: 'Coverage', percent: 32 },
    { id: 'index', type: 'file', label: 'index.tsx', fileType: 'tsx', closeable: true },
  ]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const handleCellTabClose = (id: string) => {
    setCellTabs(cellTabs.filter((t) => t.id !== id));
    if (activeCellTab === id) {
      setActiveCellTab(cellTabs[0]?.id || '');
    }
  };

  const handleAddCellTab = () => {
    const newId = `tab-${Date.now()}`;
    setCellTabs([
      ...cellTabs,
      { id: newId, type: 'file', label: 'new-file.ts', fileType: 'ts', closeable: true },
    ]);
    setActiveCellTab(newId);
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <Button variant="secondary" size="sm" onClick={() => setIsDark(!isDark)}>
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span className="ml-2">{isDark ? 'Light' : 'Dark'}</span>
        </Button>
      </div>

      {/* 1. Button Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">1. Button</h2>
        <ShowcasePanel>
          <ButtonShowcase />
        </ShowcasePanel>
      </section>

      {/* 2. Badge/Pill Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">2. Badge/Pill</h2>
        <ShowcasePanel>
          <BadgeShowcase />
        </ShowcasePanel>
      </section>

      {/* 3. Input Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">3. Input</h2>
        <ShowcasePanel>
          <InputShowcase />
        </ShowcasePanel>
      </section>

      {/* 4. Breadcrumb Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">4. Breadcrumb</h2>
        <ShowcasePanel>
          <BreadcrumbShowcase />
        </ShowcasePanel>
      </section>

      {/* 5. Segmented Tabs Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">5. Segmented Tabs</h2>
        <ShowcasePanel>
          <SegmentedTabsShowcase
            tabs={cellTabs}
            activeTab={activeCellTab}
            onTabChange={setActiveCellTab}
            onTabClose={handleCellTabClose}
            onAddTab={handleAddCellTab}
          />
        </ShowcasePanel>
      </section>

      {/* 6. File Chip Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">6. File Chip</h2>
        <ShowcasePanel>
          <FileChipShowcase />
        </ShowcasePanel>
      </section>

      {/* 7. File Change Row Component */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">7. File Change Row</h2>
        <ShowcasePanel>
          <FileChangeRowShowcase />
        </ShowcasePanel>
      </section>
    </>
  );
}

function ShowcasePanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl p-6 border border-border bg-card shadow-sm">{children}</div>;
}

function ButtonShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Primary (Solid Dark)</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <Button variant="primary" withArrow>
            Read docs
          </Button>
          <Button variant="primary" leftIcon={<Plus className="size-4" />}>
            New session
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" isLoading>
            Loading
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Secondary (Outline)</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm">
            Small
          </Button>
          <Button variant="secondary" size="md">
            Medium
          </Button>
          <Button variant="secondary" size="lg">
            Large
          </Button>
          <Button variant="secondary" withArrow>
            View more
          </Button>
          <Button variant="secondary" leftIcon={<Settings className="size-4" />}>
            Settings
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Ghost (Text Only)</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm">
            Small
          </Button>
          <Button variant="ghost" size="md">
            Medium
          </Button>
          <Button variant="ghost" size="lg">
            Large
          </Button>
          <Button variant="ghost" withArrow>
            Learn about Zen
          </Button>
          <Button variant="ghost" leftIcon={<Download className="size-4" />}>
            Download
          </Button>
          <Button variant="ghost" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Nav Links (Footer Style)</p>
        <div className="flex flex-wrap items-center gap-6">
          <Button variant="nav">Documentation</Button>
          <Button variant="nav">Pricing</Button>
          <Button variant="nav" count="34K">
            GitHub
          </Button>
          <Button variant="nav" count="12K">
            Discord
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Danger</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" size="sm">
            Delete
          </Button>
          <Button variant="danger" size="md">
            Remove
          </Button>
          <Button variant="danger" disabled>
            Disabled
          </Button>
        </div>
      </div>
    </div>
  );
}

function BadgeShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Kind Badges (TypeScript Syntax)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <KindBadge kind="function" />
          <KindBadge kind="class" />
          <KindBadge kind="interface" />
          <KindBadge kind="type" />
          <KindBadge kind="enum" />
          <KindBadge kind="variable" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Status Badges (Coverage States)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status="success" label="Passing" />
          <StatusBadge status="warning" label="Partial" />
          <StatusBadge status="error" label="Failing" />
          <StatusBadge status="neutral" label="Unknown" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Status Badges with Icons</p>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status="success" label="Passed" icon={<Check className="size-3" />} />
          <StatusBadge status="error" label="Failed" icon={<X className="size-3" />} />
        </div>
      </div>
    </div>
  );
}

function InputShowcase() {
  return (
    <div className="space-y-8">
      {/* Input with Button */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Input with Button (Email Subscribe)
        </p>
        <InputWithButton
          placeholder="Email address"
          buttonText="Subscribe"
          onSubmit={(val) => console.log('Subscribe:', val)}
        />
      </div>

      {/* Sizes */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Sizes</p>
        <div className="space-y-4">
          <Input inputSize="sm" placeholder="Small input" />
          <Input inputSize="md" placeholder="Medium input" />
          <Input inputSize="lg" placeholder="Large input (default)" />
        </div>
      </div>

      {/* Search Input */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Search Input</p>
        <SearchInput placeholder="Search exports..." />
      </div>

      {/* With Label and Helper */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">With Label and Helper Text</p>
        <Input
          label="Package name"
          placeholder="@scope/package-name"
          helperText="Enter your npm package name"
        />
      </div>

      {/* Error State */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Error State</p>
        <Input
          label="Repository URL"
          placeholder="https://github.com/..."
          error="Please enter a valid GitHub repository URL"
          defaultValue="not-a-url"
        />
      </div>
    </div>
  );
}

function BreadcrumbShowcase() {
  const breadcrumbItems: BreadcrumbItem[] = [
    { id: 'project', label: 'footnote', hasDropdown: true },
    {
      id: 'session',
      label: "I'd like to add a new page that captures contact details...",
      truncate: true,
      maxWidth: 280,
      hasDropdown: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* OpenCode Style */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">OpenCode Style Nav</p>
        <div className="flex items-center gap-3">
          <Breadcrumb items={breadcrumbItems} />
          <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" />}>
            New session
          </Button>
        </div>
      </div>

      {/* Dropdown Triggers */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Dropdown Triggers</p>
        <div className="flex items-center gap-4">
          <Breadcrumb items={[breadcrumbItems[0]]} />
          <Breadcrumb items={[breadcrumbItems[1]]} />
        </div>
      </div>
    </div>
  );
}

function SegmentedTabsShowcase({
  tabs,
  activeTab,
  onTabChange,
  onTabClose,
  onAddTab,
}: {
  tabs: TabCell[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onAddTab: () => void;
}) {
  // Add the action tab to the list
  const tabsWithAction: TabCell[] = [
    ...tabs,
    { id: '__add__', type: 'action', icon: <Plus className="size-4" /> },
  ];

  return (
    <div className="space-y-8">
      {/* OpenCode Style */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          OpenCode Style (with progress + file + action)
        </p>
        <SegmentedTabs
          tabs={tabsWithAction}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onTabClose={onTabClose}
          onAction={(id) => {
            if (id === '__add__') onAddTab();
          }}
        />
      </div>

      {/* Text Tabs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Text Tabs</p>
        <SegmentedTabs
          tabs={[
            { id: 'session', type: 'text', label: 'Session' },
            { id: 'files', type: 'text', label: '5 Files changed' },
          ]}
          activeTab="session"
          onTabChange={() => {}}
        />
      </div>

      {/* Count Tabs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Tabs with Counts</p>
        <SegmentedTabs
          tabs={[
            { id: 'exports', type: 'count', label: 'Exports', count: 142 },
            { id: 'drifts', type: 'count', label: 'Drifts', count: 8 },
            { id: 'examples', type: 'count', label: 'Examples', count: 24 },
          ]}
          activeTab="exports"
          onTabChange={() => {}}
        />
      </div>

      {/* File Tabs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">File Tabs</p>
        <SegmentedTabs
          tabs={[
            { id: 'app', type: 'file', label: 'app.tsx', fileType: 'tsx', closeable: true },
            { id: 'utils', type: 'file', label: 'utils.ts', fileType: 'ts', closeable: true },
            { id: 'styles', type: 'file', label: 'styles.css', fileType: 'css', closeable: true },
            { id: 'index', type: 'file', label: 'index.html', fileType: 'html', closeable: true },
          ]}
          activeTab="app"
          onTabChange={() => {}}
          onTabClose={() => {}}
        />
      </div>

      {/* Progress Tabs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Progress Tabs</p>
        <SegmentedTabs
          tabs={[
            { id: 'overview', type: 'text', label: 'Overview' },
            { id: 'coverage', type: 'progress', label: 'Coverage', percent: 78 },
            { id: 'tests', type: 'progress', label: 'Tests', percent: 100 },
          ]}
          activeTab="overview"
          onTabChange={() => {}}
        />
      </div>

      {/* Mixed Example */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Mixed Content</p>
        <SegmentedTabs
          tabs={[
            { id: 'chat', type: 'text', label: 'Chat' },
            { id: 'progress', type: 'progress', label: 'Progress', percent: 45 },
            { id: 'main', type: 'file', label: 'main.ts', fileType: 'ts', closeable: true },
            { id: 'config', type: 'file', label: 'config.json', fileType: 'json', closeable: true },
            { id: 'add', type: 'action', icon: <Plus className="size-4" /> },
          ]}
          activeTab="chat"
          onTabChange={() => {}}
          onTabClose={() => {}}
          onAction={() => {}}
        />
      </div>
    </div>
  );
}

function FileChipShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">File References (Inline)</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground">In</span>
          <FileChip filename="contacts.tsx" />
          <span className="text-foreground">and</span>
          <FileChip filename="footer.tsx" />
          <span className="text-foreground">add a variation of</span>
          <FileChip filename="form.tsx" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Various File Types</p>
        <div className="flex flex-wrap items-center gap-2">
          <FileChip filename="index.ts" />
          <FileChip filename="styles.css" />
          <FileChip filename="config.json" />
          <FileChip filename="README.md" />
          <FileChip filename="data.csv" />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Clickable</p>
        <div className="flex flex-wrap items-center gap-2">
          <FileChip filename="button.tsx" onClick={() => alert('Clicked button.tsx!')} />
          <FileChip filename="input.tsx" onClick={() => alert('Clicked input.tsx!')} />
        </div>
      </div>
    </div>
  );
}

function FileChangeRowShowcase() {
  return (
    <div className="space-y-8">
      {/* Collapsible File List */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Collapsible File List</p>
        <FileChangeList title="Files changed" count={4} defaultOpen>
          <FileChangeRow
            path="resources/js/components/"
            filename="contacts.tsx"
            additions={43}
            deletions={2}
          />
          <FileChangeRow
            path="resources/js/components/"
            filename="footer.tsx"
            additions={43}
            deletions={2}
          />
          <FileChangeRow
            path="resources/js/packages/"
            filename="button.tsx"
            additions={43}
            deletions={2}
          />
          <FileChangeRow
            path="resources/components/"
            filename="form.html"
            additions={43}
            deletions={2}
          />
        </FileChangeList>
      </div>

      {/* Individual Rows */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Individual File Rows</p>
        <div className="border border-border rounded-lg overflow-hidden">
          <FileChangeRow
            path="src/components/"
            filename="dialog.tsx"
            additions={156}
            deletions={23}
          />
          <FileChangeRow path="src/utils/" filename="helpers.ts" additions={12} deletions={45} />
          <FileChangeRow path="public/" filename="index.html" additions={5} deletions={0} />
        </div>
      </div>
    </div>
  );
}
