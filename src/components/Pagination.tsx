// Shared pagination control + helpers. Used for the runs list and for each collection's shard list.
// Page size is selectable (5 / 10 / 20 / 100 / All); 20 is the default.

export type PageSize = number | 'all';

export const PAGE_SIZE_OPTIONS: PageSize[] = [5, 10, 20, 100, 'all'];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export function pageCountFor(total: number, pageSize: PageSize): number {
  if (pageSize === 'all') return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginate<T>(items: T[], page: number, pageSize: PageSize): T[] {
  if (pageSize === 'all') return items;
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = 'items',
}: {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  label?: string;
}) {
  const pageCount = pageCountFor(total, pageSize);
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : pageSize === 'all' ? 1 : (current - 1) * pageSize + 1;
  const to = pageSize === 'all' ? total : Math.min(total, current * pageSize);

  return (
    <div className="pagination">
      <span className="pagination-summary">
        {total === 0 ? `No ${label}` : `${from}–${to} of ${total} ${label}`}
      </span>
      <div className="pagination-controls">
        <label className="pagination-perpage">
          <span>Rows</span>
          <select
            className="page-size-select"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={String(opt)} value={String(opt)}>
                {opt === 'all' ? 'All' : opt}
              </option>
            ))}
          </select>
        </label>
        {pageSize !== 'all' && pageCount > 1 && (
          <div className="pagination-nav">
            <button
              type="button"
              className="page-btn"
              disabled={current <= 1}
              onClick={() => onPageChange(current - 1)}
              aria-label="Previous page"
            >
              &lsaquo;
            </button>
            <span className="pagination-pageinfo">
              {current} / {pageCount}
            </span>
            <button
              type="button"
              className="page-btn"
              disabled={current >= pageCount}
              onClick={() => onPageChange(current + 1)}
              aria-label="Next page"
            >
              &rsaquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
