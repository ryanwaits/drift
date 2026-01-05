import React from 'react';

export function useStateOrLocalStorage(
  key: string | undefined,
  initialState: string,
): [string, (_: string) => void] {
  const [state, setState] = React.useState(initialState);

  React.useLayoutEffect(() => {
    if (!key) return;

    const storedValue = window.localStorage.getItem(key);
    if (storedValue != null) {
      setState(storedValue);
    }

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        const storedValue = window.localStorage.getItem(key);
        setState(storedValue || initialState);
      }
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [key, initialState]);

  const setStorage = !key
    ? setState
    : (value: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
          window.dispatchEvent(new StorageEvent('storage', { key }));
        }
      };

  return [state, setStorage];
}
