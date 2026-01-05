'use client';

import { useNotesContext } from './notes.client';

export function CalloutClient({ name }: { name: string }) {
  const note = useNotesContext(name);

  if (note?.type === 'code') {
    return (
      <div className="prose-no-margin [&>div]:!border-none [&>div]:!my-0 [&>div>pre]:!bg-transparent">
        {note.children}
      </div>
    );
  }
  return <div className="px-2 prose dark:prose-invert">{note ? note.children : name}</div>;
}
