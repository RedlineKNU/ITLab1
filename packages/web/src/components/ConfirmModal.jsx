import React from 'react';

export function ConfirmModal({ open, title, message, confirmLabel = 'Підтвердити', cancelLabel = 'Скасувати', onConfirm, onCancel, danger = false }) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="confirm-modal"
      onClick={onCancel}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {title ? <h3>{title}</h3> : null}
        {message ? <p>{message}</p> : null}
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel} data-testid="confirm-cancel">
            {cancelLabel}
          </button>
          <button
            className={danger ? 'danger' : ''}
            onClick={onConfirm}
            data-testid="confirm-ok"
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
