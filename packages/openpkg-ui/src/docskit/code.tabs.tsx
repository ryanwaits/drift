import { Block, CodeBlock } from 'codehike/blocks';
import type { RawCode } from 'codehike/code';
import { z } from 'zod';
import { SingleCode, toCodeGroup } from './code';
import { MultiCode } from './code.client';

export async function CodeGroup(props: unknown) {
  // Type assertion needed due to zod version mismatch between codehike and project
  // biome-ignore lint/suspicious/noExplicitAny: codehike/zod version mismatch requires any cast
  const result = (Block.extend as any)({
    // biome-ignore lint/suspicious/noExplicitAny: codehike/zod version mismatch requires any cast
    code: z.array(CodeBlock as any),
    flags: z.string().optional(),
    storage: z.string().optional(),
    handlers: z.array(z.any()).optional(),
  }).safeParse(props);

  if (!result.success) {
    throw betterError(result.error, 'CodeGroup');
  }

  const { code, ...rest } = result.data;

  return <Code codeblocks={code} {...rest} />;
}

export async function Code(props: { codeblocks: RawCode[]; flags?: string; storage?: string }) {
  const group = await toCodeGroup(props);
  return group.tabs.length === 1 ? (
    <SingleCode group={group} />
  ) : (
    <MultiCode group={group} key={group.storage} />
  );
}

function betterError(error: z.ZodError, componentName: string) {
  const { issues } = error;
  if (issues.length === 1 && issues[0].path[0] === 'code') {
    return new Error(`<${componentName}> should contain at least one codeblock marked with \`!!\``);
  } else {
    return error;
  }
}
