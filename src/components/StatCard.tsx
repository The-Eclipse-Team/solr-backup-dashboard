export interface StatDef {
  key: string;
  label: string;
  value: string | number;
  dot: string;
}

export function StatGrid({ stats, columns }: { stats: StatDef[]; columns: number }) {
  return (
    <div className="stat-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {stats.map((s) => (
        <div className="stat-cell" key={s.key}>
          <div className="stat-label-row">
            <span className="dot" style={{ background: s.dot }} />
            <span className="stat-label">{s.label}</span>
          </div>
          <span className="stat-value">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
