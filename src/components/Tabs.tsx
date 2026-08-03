// Top-level view switcher (Backup Runs / Collection Health). Hidden in run detail, which has its own
// back button.

export interface TabDef {
  value: string;
  label: string;
}

export function Tabs({ tabs, active, onSelect }: { tabs: TabDef[]; active: string; onSelect: (value: string) => void }) {
  return (
    <div className="tab-row">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.value}
          className={tab.value === active ? 'tab active' : 'tab'}
          onClick={() => onSelect(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
