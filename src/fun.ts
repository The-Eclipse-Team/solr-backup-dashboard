import { useEffect } from 'react';

// Small surprises. None of this touches data or polling — it only toggles classes on the page shell.

/** Briefly adds `className` to the page shell, restarting it if it is already playing. */
export function flashShell(className: string, ms: number) {
  const shell = document.querySelector('.shell');
  if (!shell) return;
  shell.classList.remove(className);
  void (shell as HTMLElement).offsetWidth; // reflow, so a repeat trigger restarts the animation
  shell.classList.add(className);
  setTimeout(() => shell.classList.remove(className), ms);
}

export const spin = () => flashShell('spin', 1200);
export const disco = () => flashShell('disco', 6000);

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Calls `onMatch` when the sequence is typed anywhere outside a text field. */
export function useSequence(onMatch: () => void) {
  useEffect(() => {
    // The last N keys, compared whole — a stray extra key before the sequence can't throw it off.
    let recent: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      recent = [...recent, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-SEQUENCE.length);
      if (recent.join() === SEQUENCE.join()) {
        recent = [];
        onMatch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMatch]);
}
