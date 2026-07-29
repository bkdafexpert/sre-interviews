'use client';

import * as React from 'react';
import { useEffect } from 'react';

// Styled confirmation modal used in place of window.confirm — backdrop click and Escape cancel.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,20,20,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(20,20,20,0.24)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h3>
        <div style={{ fontSize: 14.5, color: '#5A5A5A', lineHeight: 1.5, wordBreak: 'break-word' }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            onClick={onCancel}
            className="sg-menu-item"
            style={{
              padding: '10px 18px',
              background: '#F0F0F0',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#141414',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="sg-btn-primary"
            autoFocus
            style={{
              padding: '10px 18px',
              background: danger ? '#E9041E' : '#141414',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
