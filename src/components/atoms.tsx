import type { CSSProperties } from 'react';

export function Dot({ color, pulse, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  const style: CSSProperties = { background: color, width: size, height: size };
  return <span className={pulse ? 'dot pulse' : 'dot'} style={style} />;
}

export function StatusPill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="pill" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}
