import React from 'react';
import { ALL_COLUMNS } from './ColumnToggles.jsx';
import { formatDateTime } from '../format.js';

export function FileTable({
  files,
  visibleColumns,
  sortDirection,
  onToggleSort,
  onRowClick,
  selectedId,
  onDragStart,
  onContextDelete,
}) {
  const columns = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));
  return (
    <table className="file-table" data-testid="file-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>
              {col.key === 'name' ? (
                <button
                  type="button"
                  className="sort-btn"
                  onClick={onToggleSort}
                  data-testid="sort-name"
                >
                  {col.label} {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr
            key={file.id}
            className={selectedId === file.id ? 'selected' : ''}
            data-testid={`file-row-${file.name}`}
            onClick={() => onRowClick?.(file)}
            onMouseDown={() => onDragStart?.(file, 'select')}
            draggable
            onDragStart={(e) => onDragStart?.(file, 'drag', e)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextDelete?.(file);
            }}
          >
            {columns.map((col) => (
              <td key={col.key}>
                {col.key === 'createdAt' || col.key === 'modifiedAt'
                  ? formatDateTime(file[col.key])
                  : file[col.key]}
              </td>
            ))}
          </tr>
        ))}
        {files.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="empty">
              Файлів не знайдено
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
