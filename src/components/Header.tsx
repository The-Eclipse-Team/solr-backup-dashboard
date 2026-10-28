import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { spin } from '../fun';

// Five quick clicks on the title, within this window.
const TITLE_CLICKS = 5;
const TITLE_WINDOW_MS = 1500;

function Title() {
  const clicks = useRef<number[]>([]);
  const [sunny, setSunny] = useState(false);

  const onClick = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < TITLE_WINDOW_MS), now];
    if (clicks.current.length >= TITLE_CLICKS) {
      clicks.current = [];
      setSunny(true);
      setTimeout(() => setSunny(false), 4000);
    }
  };

  return (
    <span className={`header-title${sunny ? ' sunny' : ''}`} onClick={onClick}>
      {sunny ? 'Solar Backup Monitor ☀️' : 'Solr Backup Monitor'}
    </span>
  );
}

/** The header's live clock. Double-click it. */
export function Clock({ children }: { children: ReactNode }) {
  return (
    <span className="mono clock" onDoubleClick={spin}>
      {children}
    </span>
  );
}

export function Header({ badge, onBack, children }: { badge?: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <div className="header">
      <div className="header-left">
        {onBack && (
          <button type="button" className="back-btn" onClick={onBack}>
            &larr; Runs
          </button>
        )}
        <Title />
        {badge && <span className="badge">{badge}</span>}
      </div>
      {children}
    </div>
  );
}
