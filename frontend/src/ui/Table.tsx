import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Plain string or a richer node (e.g. `<EmptyState />`) shown when `rows` is empty. */
  emptyMessage?: ReactNode;
}

export function Table<T>({ columns, rows, rowKey, emptyMessage = 'Belum ada data.' }: TableProps<T>) {
  if (rows.length === 0) {
    return typeof emptyMessage === 'string' ? (
      <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
    ) : (
      <>{emptyMessage}</>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-slate-200">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-slate-900">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
