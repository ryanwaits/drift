import type { RawCode } from 'codehike/code';
import { Code } from './code.tabs';
import { WithClientNotes } from './notes.client';

type NoteType = 'prose' | 'code' | 'image';

interface Note {
  name: string;
  type: NoteType;
  children: React.ReactNode;
}

export function WithNotes({ children, ...rest }: { children: React.ReactNode }) {
  // get all the blocks inside <WithNotes />
  // and put them into Context
  const notes: Note[] = Object.entries(rest)
    .filter(([name]) => name !== 'title' && name !== '_data')
    .map(([name, value]) => {
      const block = value as Record<string, unknown>;
      if (Object.hasOwn(block, 'children')) {
        return {
          name,
          type: (block.type as NoteType) || 'prose',
          children: block.children as React.ReactNode,
        };
      } else if (Object.hasOwn(block, 'value') && Object.hasOwn(block, 'lang')) {
        return {
          name,
          type: 'code' as const,
          children: <Code codeblocks={[block as RawCode]} />,
        };
      } else if (Object.hasOwn(block, 'url') && Object.hasOwn(block, 'alt')) {
        return {
          name,
          type: 'image' as const,
          children: <img src={block.url as string} alt={block.alt as string} />,
        };
      } else {
        throw new Error('Invalid block inside <WithNotes />');
      }
    });
  return <WithClientNotes notes={notes}>{children}</WithClientNotes>;
}
