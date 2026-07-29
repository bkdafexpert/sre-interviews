'use client';

import { LinkItem } from '@/lib/api';
import { destShort, frNumber, shortUrl, statusOf } from '@/lib/format';
import { CheckIcon, CopyIcon, ToggleOff, ToggleOn, TrashIcon } from './icons';

export function LinkRow({
  item,
  copied,
  onOpen,
  onCopy,
  onToggleActive,
  onDelete,
}: {
  item: LinkItem;
  copied: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const status = statusOf(item.status);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className="sg-row" onClick={onOpen}>
      <div className="sg-row-main">
        <span style={{ fontSize: 14, fontWeight: 600, color: '#141414', flex: 'none' }}>{shortUrl(item.code)}</span>
        <span style={{ fontSize: 12.5, color: '#8A8A8A', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {destShort(item.destination)}
        </span>
      </div>
      <div className="sg-row-meta">
        <span className="sg-row-clics">{frNumber(item.clicks)} clics</span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: '2px 10px',
            borderRadius: 999,
            background: status.bg,
            color: status.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {status.label}
        </span>
      </div>
      <div className="sg-row-actions">
        <button
          className="sg-icon-btn"
          title={item.active ? 'Désactiver' : 'Réactiver'}
          aria-label={item.active ? 'Désactiver le lien' : 'Réactiver le lien'}
          onClick={stop(onToggleActive)}
          style={{
            display: 'flex',
            padding: 7,
            background: 'transparent',
            border: 'none',
            borderRadius: 999,
            color: item.active ? '#1B8A3C' : '#B0B0B0',
            cursor: 'pointer',
          }}
        >
          {item.active ? <ToggleOn size={18} /> : <ToggleOff size={18} />}
        </button>
        <button
          className="sg-icon-btn"
          title="Copier"
          onClick={stop(onCopy)}
          style={{
            display: 'flex',
            padding: 7,
            background: 'transparent',
            border: 'none',
            borderRadius: 999,
            color: '#5A5A5A',
            cursor: 'pointer',
          }}
        >
          {copied ? <CheckIcon size={15} stroke="#1B8A3C" /> : <CopyIcon size={15} />}
        </button>
        <button
          className="sg-icon-btn sg-icon-btn-danger"
          title="Supprimer"
          onClick={stop(onDelete)}
          style={{
            display: 'flex',
            padding: 7,
            background: 'transparent',
            border: 'none',
            borderRadius: 999,
            color: '#5A5A5A',
            cursor: 'pointer',
          }}
        >
          <TrashIcon size={15} />
        </button>
      </div>
    </div>
  );
}
