import type { ReactNode } from 'react';

export function Header({ badge, onBack, children }: { badge?: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <div className="header">
      <div className="header-left">
        {onBack && (
          <button type="button" className="back-btn" onClick={onBack}>
            &larr; Runs
          </button>
        )}
        <span className="header-title">Solr Backup Monitor</span>
        {badge && <span className="badge">{badge}</span>}
      </div>
      {children}
    </div>
  );
}
