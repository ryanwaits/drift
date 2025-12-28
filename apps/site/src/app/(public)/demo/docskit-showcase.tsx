'use client';

import {
  ClientCode,
  ClientDocsKitCode,
  ClientInlineCode,
  ClientTerminal,
  HoverLink,
  PackageInstall,
  WithHover,
} from '@doccov/ui/docskit';

const exampleCode = `import { useState, useEffect } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);

  return {
    count,
    increment: () => setCount(c => c + 1),
    decrement: () => setCount(c => c - 1),
  };
}`;

const shortCode = `const greeting = "Hello, World!";`;

const markExample = `function fetchUser(id: string) {
  // !mark
  const response = await fetch(\`/api/users/\${id}\`);
  const user = await response.json(); // !mark
  return user;
}`;

const diffExample = `function greet(name: string) {
  // !diff -
  return "Hello, " + name;
  // !diff +
  return \`Hello, \${name}!\`;
}`;

const linkExample = `// !link[/useState/] https://react.dev/reference/react/useState
import { useState } from 'react';

function Counter() {
  // !link[/useState/] https://react.dev/reference/react/useState
  const [count, setCount] = useState(0);
  return <button>{count}</button>;
}`;

const calloutExample = `function fetchData(url: string) {
  // !callout[/fetch/] Makes an HTTP request
  return fetch(url)
    .then(res => res.json());
}`;

const collapseExample = `function createUser(data: UserData) {
  // !collapse(1:4)
  const validated = validateInput(data);
  const normalized = normalizeData(validated);
  const encrypted = encryptSensitive(normalized);
  const user = await db.users.create(encrypted);
  return user;
}`;

const collapseCollapsedExample = `class ApiClient {
  // !collapse(1:5) collapsed
  private baseUrl: string;
  private headers: Headers;
  private timeout: number;
  private retryCount: number;
  private cache: Map<string, any>;

  async fetch(endpoint: string) {
    return fetch(this.baseUrl + endpoint);
  }
}`;

const expandableExample = `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
  return data;
}
// !expandable
async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  return data;
}

async function createUser(userData: UserData) {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select();
  return data;
}

async function updateUser(id: string, updates: Partial<UserData>) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select();
  return data;
}`;

const hoverExample = `# !hover[/pink/gm] item
L = ['red', 'pink', 'blue']
if 'pink' in L:
    print('yes')
else:
    print('no')`;

const tooltipExample = `function calculate(a: number, b: number) {
  // !tooltip[/sum/] The sum of two numbers
  const sum = a + b;
  // !tooltip[/product/] The product of two numbers
  const product = a * b;
  return { sum, product };
}`;

const wordWrapExample = `// This is a very long comment that demonstrates word wrapping in code blocks. When the -w flag is enabled, long lines will wrap instead of requiring horizontal scrolling.
const config = { apiUrl: "https://api.example.com/v1/users/profile/settings/preferences", timeout: 5000 };`;

export function DocsKitShowcase() {
  return (
    <div className="space-y-8">
      {/* Terminal */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Terminal (macOS style)</p>
        <ClientTerminal
          codeblock={{
            value: 'npm install @doccov/ui',
            lang: 'bash',
            meta: '-c',
          }}
        />
      </div>

      {/* Terminal with multiple commands */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Terminal with multiple commands
        </p>
        <ClientTerminal
          codeblock={{
            value: `git clone https://github.com/example/repo.git
cd repo
npm install
npm run dev`,
            lang: 'bash',
            meta: '-c',
          }}
        />
      </div>

      {/* Package Install */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Package Install (with package manager tabs)
        </p>
        <PackageInstall package="@doccov/ui" />
      </div>

      {/* Package Install - Dev Dependency */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Package Install - Dev Dependency
        </p>
        <PackageInstall package="typescript" dev />
      </div>

      {/* Package Install - Global */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Package Install - Global</p>
        <PackageInstall package="opencode-ai" global />
      </div>

      {/* Code Block */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Title & Copy Button
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: exampleCode,
            lang: 'typescript',
            meta: 'useCounter.ts -c',
          }}
        />
      </div>

      {/* Code Block without Title */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Code Block (No Title)</p>
        <ClientDocsKitCode
          codeblock={{
            value: shortCode,
            lang: 'typescript',
            meta: '-c',
          }}
        />
      </div>

      {/* Code Block with Line Numbers */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Line Numbers (-n flag)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: exampleCode,
            lang: 'typescript',
            meta: 'useCounter.ts -cn',
          }}
        />
      </div>

      {/* Code Block with Mark Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Mark Annotation (<code>{'// !mark'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: markExample,
            lang: 'typescript',
            meta: 'fetchUser.ts -c',
          }}
        />
      </div>

      {/* Code Block with Diff Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Diff Annotation (<code>{'// !diff +/-'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: diffExample,
            lang: 'typescript',
            meta: 'greet.ts -c',
          }}
        />
      </div>

      {/* Code Block with Link Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Link Annotation (<code>{'// !link'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: linkExample,
            lang: 'tsx',
            meta: 'Counter.tsx -c',
          }}
        />
      </div>

      {/* Code Block with Callout Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Callout Annotation (<code>{'// !callout'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: calloutExample,
            lang: 'typescript',
            meta: 'fetchData.ts -c',
          }}
        />
      </div>

      {/* Code Block with Collapse Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Collapse Annotation (<code>{'// !collapse'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: collapseExample,
            lang: 'typescript',
            meta: 'createUser.ts -c',
          }}
        />
      </div>

      {/* Code Block with Collapse (Initially Collapsed) */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Collapse - Initially Collapsed (<code>{'// !collapse collapsed'}</code>)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: collapseCollapsedExample,
            lang: 'typescript',
            meta: 'ApiClient.ts -c',
          }}
        />
      </div>

      {/* Code Block with Expandable Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Expandable Annotation {'(// !expandable)'}
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: expandableExample,
            lang: 'typescript',
            meta: 'supabase-client.ts -c',
          }}
        />
      </div>

      {/* Code Block with Hover Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Hover Annotation {'(// !hover)'}
        </p>
        <WithHover>
          <p className="text-sm text-foreground mb-3">
            Is <HoverLink href="hover:item">pink</HoverLink> in the list?
          </p>
          <ClientDocsKitCode
            codeblock={{
              value: hoverExample,
              lang: 'python',
              meta: 'check_list.py -c',
            }}
          />
        </WithHover>
      </div>

      {/* Code Block with Tooltip Annotation */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Tooltip Annotation {'(// !tooltip)'}
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: tooltipExample,
            lang: 'typescript',
            meta: 'calculate.ts -c',
          }}
        />
      </div>

      {/* Code Block with Word Wrap */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Code Block with Word Wrap (-w flag)
        </p>
        <ClientDocsKitCode
          codeblock={{
            value: wordWrapExample,
            lang: 'typescript',
            meta: 'config.ts -cw',
          }}
        />
      </div>

      {/* Inline Code */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Inline Code</p>
        <p className="text-foreground">
          Use the{' '}
          <ClientInlineCode codeblock={{ value: 'useState', lang: 'typescript', meta: '' }} /> hook
          to manage state, or{' '}
          <ClientInlineCode codeblock={{ value: 'useEffect', lang: 'typescript', meta: '' }} /> for
          side effects.
        </p>
      </div>

      {/* Multiple Languages */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Multiple Languages</p>
        <div className="grid grid-cols-2 gap-4">
          <ClientDocsKitCode
            codeblock={{
              value: `function greet(name: string) {\n  return \`Hello, \${name}!\`;\n}`,
              lang: 'typescript',
              meta: 'greet.ts -c',
            }}
          />
          <ClientDocsKitCode
            codeblock={{
              value: `def greet(name):\n    return f"Hello, {name}!"`,
              lang: 'python',
              meta: 'greet.py -c',
            }}
          />
        </div>
      </div>

      {/* Code Tabs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">Code Tabs (Multiple Files)</p>
        <ClientCode
          codeblocks={[
            {
              value: `import { useState } from 'react';\n\nexport function Counter() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;\n}`,
              lang: 'tsx',
              meta: 'Counter.tsx -c',
            },
            {
              value: `.counter {\n  padding: 0.5rem 1rem;\n  border-radius: 0.5rem;\n  background: var(--primary);\n  color: white;\n}`,
              lang: 'css',
              meta: 'counter.css -c',
            },
            {
              value: `{\n  "name": "counter-component",\n  "version": "1.0.0"\n}`,
              lang: 'json',
              meta: 'package.json -c',
            },
          ]}
          flags="-c"
        />
      </div>
    </div>
  );
}
