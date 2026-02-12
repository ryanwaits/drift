import { useCallback, useRef, useState } from 'react';

const COPY_FEEDBACK_MS = 1200;

export function useCopyToClipboard(timeout = COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), timeout);
      });
    },
    [timeout],
  );

  return [copied, copy] as const;
}
