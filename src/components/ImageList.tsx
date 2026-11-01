import type { ImageItem } from '../types'
import { formatBytes, formatDimensions } from '../lib/format'
import { TrashIcon } from './Icons'

interface ImageListProps {
  items: ImageItem[]
  onRemove: (id: string) => void
  disabled: boolean
}

function statusLabel(item: ImageItem): string {
  switch (item.status) {
    case 'ready':
      return 'Lista para optimizar'
    case 'queued':
      return 'En espera'
    case 'processing':
      return `Procesando · ${Math.round(item.progress)} %`
    case 'done':
      return item.result?.useOriginal
        ? 'Resultado listo · original conservado'
        : 'Resultado listo'
    case 'error':
      return 'No procesada'
  }
}

export function ImageList({ items, onRemove, disabled }: ImageListProps) {
  return (
    <ul className="file-list" aria-label="Fotos seleccionadas">
      {items.map((item) => {
        const isWorking =
          item.status === 'queued' || item.status === 'processing'
        return (
          <li className="file-row" key={item.id}>
            <div className="file-thumb">
              <img src={item.previewUrl} alt="" loading="lazy" />
            </div>

            <div className="file-info">
              <p className="file-name" title={item.name}>
                {item.name}
              </p>
              <p className="file-meta">
                {formatDimensions(item.width, item.height)}
                <span aria-hidden="true"> · </span>
                {formatBytes(item.size)}
              </p>
              <div className={`file-status file-status--${item.status}`}>
                {isWorking && <span className="spinner spinner--small" aria-hidden="true" />}
                <span>{statusLabel(item)}</span>
              </div>
              {item.status === 'processing' && (
                <div
                  className="progress-track progress-track--small"
                  role="progressbar"
                  aria-label={`Progreso de ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress)}
                >
                  <span
                    className="progress-fill"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.status === 'error' && item.error && (
                <p className="file-error" role="status">
                  {item.error}
                </p>
              )}
            </div>

            <button
              type="button"
              className="icon-button file-remove"
              onClick={() => onRemove(item.id)}
              disabled={disabled || isWorking}
              aria-label={`Quitar ${item.name}`}
              title={`Quitar ${item.name}`}
            >
              <TrashIcon />
              <span className="button-label">Quitar</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
