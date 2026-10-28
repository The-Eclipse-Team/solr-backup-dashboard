import type { SortState } from '../sort';

// A column header that sorts its table on click. A real <button>, so it is keyboard-reachable.
export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      className={`sort-head${active ? ' active' : ''}`}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <span className="sort-arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}
