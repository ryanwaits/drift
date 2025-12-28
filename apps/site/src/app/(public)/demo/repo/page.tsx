import { Button } from '@doccov/ui/button';
import { DocsKitCode } from '@doccov/ui/docskit';
import { FileChip } from '@doccov/ui/file-chip';
import { Check, ChevronDown, FolderOpen, Plus, X } from 'lucide-react';

// File icon component
function FileIcon({ type = 'ts' }: { type?: 'ts' | 'html' }) {
  if (type === 'html') {
    return (
      <div className="flex items-center justify-center w-5 h-5 rounded text-xs font-mono bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
        {'<>'}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
      TS
    </div>
  );
}

// Chevron icon for expand/collapse
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <title>Chevron icon</title>
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// File change row component
function FileChangeRow({
  path,
  filename,
  additions,
  deletions,
  type = 'ts',
}: {
  path: string;
  filename: string;
  additions: number;
  deletions: number;
  type?: 'ts' | 'html';
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--code-border)] hover:bg-[var(--code-bg)]/50 transition-colors">
      <div className="flex items-center gap-3">
        <FileIcon type={type} />
        <span className="font-mono text-sm text-muted-foreground">
          {path}
          <span className="text-foreground font-medium">{filename}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-green-600 dark:text-green-400">+{additions}</span>
        <span className="font-mono text-sm text-red-500 dark:text-red-400">-{deletions}</span>
        <ChevronIcon className="text-muted-foreground" />
      </div>
    </div>
  );
}

// Project dropdown item
function ProjectItem({ name, isSelected = false }: { name: string; isSelected?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer rounded">
      <FolderOpen className="w-4 h-4 text-muted-foreground" />
      <span className="font-mono text-sm flex-1">{name}</span>
      {isSelected && <Check className="w-4 h-4 text-foreground" />}
    </div>
  );
}

export default function RepoDemo() {
  // Diff example - shows added and removed lines
  const diffCode = `import { useState } from "react"
// !diff -
import { useEffect } from "react"
// !diff +
import { useEffect, useCallback } from "react"

export function ContactForm() {
// !diff -
  const [name, setName] = useState("")
// !diff +
  const [formData, setFormData] = useState({
// !diff +
    name: "",
// !diff +
    email: "",
// !diff +
  })

  return <form>{/* ... */}</form>
}`;

  // Mark + Callout example - highlights important code with explanations
  const calloutCode = `import { Button } from "@/components/button"
import { Input } from "@/components/input"

export function ContactForm({ onSubmit }) {
  const [email, setEmail] = useState("") // !callout[/email/] stores user email

  const handleSubmit = async (e) => {
    e.preventDefault()
    // !mark
    await validateEmail(email)  // !callout[/validate/] validates format
    // !mark
    onSubmit({ email })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input value={email} onChange={setEmail} />
      <Button type="submit">Send</Button>
    </form>
  )
}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Logo */}
          <div className="flex items-center justify-center w-8 h-8 border border-border rounded">
            <div className="w-4 h-4 border-2 border-foreground rounded-sm" />
          </div>

          {/* Project dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 font-mono text-sm hover:bg-muted rounded transition-colors"
            >
              footnote
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Dropdown menu */}
            <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <ProjectItem name="bespokely" />
              <ProjectItem name="cartwheel" />
              <ProjectItem name="footnote" isSelected />
              <ProjectItem name="playground" />
              <div className="border-t border-border my-2" />
              <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer rounded mx-1">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm">Open project</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <span className="text-muted-foreground">/</span>

          {/* Session title/input */}
          <div className="flex items-center gap-2 flex-1">
            <span className="font-mono text-sm text-muted-foreground truncate max-w-md">
              I'd like to add a new page that cap...
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* New session button */}
          <Button variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            New session
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-t border-b-2 border-foreground font-mono text-sm">
            x.tsx
            <button type="button" className="hover:bg-muted rounded p-0.5">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 hover:bg-muted rounded text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content - two column layout */}
      <div className="flex">
        {/* Left panel - Chat/Summary */}
        <div className="flex-1 border-r border-border p-6 space-y-6">
          {/* Prompt with inline code */}
          <div className="space-y-4">
            <p className="font-mono text-sm leading-relaxed">...includes contact details</p>
            <p className="font-mono text-sm leading-relaxed">
              <FileChip filename="footer.tsx" /> add a variation of <FileChip filename="form.tsx" />{' '}
              that includes the <FileChip filename="ut.tsx" /> <FileChip filename="select.tsx" />{' '}
              and <FileChip filename="button.tsx" />, and use submitted to
            </p>
          </div>

          {/* Summary section */}
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-medium text-muted-foreground">Summary</h3>
            <p className="font-mono text-sm leading-relaxed">
              Added a fictional contact form using mock components and imaginary file imports.
              Referenced the files you mentioned and made the following.
            </p>
          </div>

          {/* File changes list */}
          <div className="border border-border rounded-lg overflow-hidden">
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
              type="html"
            />
          </div>

          {/* Show details link */}
          <button
            type="button"
            className="flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Show details
            <ChevronIcon />
          </button>
        </div>

        {/* Right panel - Code preview */}
        <div className="flex-1 p-6 space-y-6 bg-muted/20">
          {/* Header */}
          <h2 className="font-mono text-base font-medium">5 Files changed</h2>

          {/* Code blocks */}
          <div className="space-y-4">
            <DocsKitCode
              codeblock={{
                value: diffCode,
                lang: 'tsx',
                meta: 'contacts.tsx -c',
              }}
            />

            <DocsKitCode
              codeblock={{
                value: calloutCode,
                lang: 'tsx',
                meta: 'form.tsx -c',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
