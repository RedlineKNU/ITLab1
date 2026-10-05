import React from 'react';

export const ALL_COLUMNS = [
  { key: 'name', label: 'Назва', locked: true },
  { key: 'createdAt', label: 'Створено' },
  { key: 'modifiedAt', label: 'Змінено' },
  { key: 'uploadedBy', label: 'Завантажив' },
  { key: 'modifiedBy', label: 'Редагував' },
];

export function ColumnToggles({ visible, onChange }) {
  const toggle = (key) => {
    if (visible.includes(key)) {
      onChange(visible.filter((k) => k !== key));
    } else {
      onChange([...visible, key]);
    }
  };
  return (
    <div className="col-toggles" role="group" aria-label="Відображення стовпців">
      {ALL_COLUMNS.map((col) => (
        <label key={col.key} className={col.locked ? 'locked' : ''}>
          <input
            type="checkbox"
            checked={visible.includes(col.key)}
            disabled={col.locked}
            onChange={() => toggle(col.key)}
            data-testid={`col-toggle-${col.key}`}
          />
          {col.label}
        </label>
      ))}
    </div>
  );
}
