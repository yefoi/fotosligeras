import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { formatBytes, formatDimensions } from '../lib/format'
import { formatName } from '../lib/profiles'
import type { ImageItem } from '../types'
import { CloseIcon, CompareIcon } from './Icons'

interface CompareDialogProps {
  item: ImageItem
  stale: boolean
  onClose: () => void
}

export function CompareDialog({ item, stale, onClose }: CompareDialogProps) {
  const result = item.result
  const [position, setPosition] = useState(50)
  const [actualSize, setActualSize] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const sliderId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const container = dialogRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  if (!result) return null

  const clipPath = `inset(0 ${100 - position}% 0 0)`
  const frameStyle: CSSProperties = actualSize
    ? { width: result.width, height: result.height }
    : ({
        aspectRatio: `${result.width} / ${result.height}`,
        '--compare-ratio': result.width / result.height,
      } as CSSProperties)

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="compare-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="compare-header">
          <div>
            <p className="compare-kicker">
              <CompareIcon /> Antes y después
            </p>
            <h2 id={titleId} className="compare-title" title={item.name}>
              {item.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button compare-close"
            onClick={onClose}
            aria-label="Cerrar comparación"
          >
            <CloseIcon />
          </button>
        </header>

        <p className="compare-description" id={descriptionId}>
          Arrastra el deslizador para comparar el original con el resultado. La
          imagen de la izquierda es el original.
        </p>

        {stale && (
          <p className="notice notice--warning compare-stale">
            Este resultado se generó con ajustes anteriores. Actualízalo para
            descargar la versión actual.
          </p>
        )}

        <div
          className={`compare-stage${actualSize ? ' compare-stage--actual' : ' compare-stage--fit'}`}
        >
          <div
            className={`compare-frame${actualSize ? ' compare-frame--actual' : ''}`}
            style={frameStyle}
          >
            <div className="compare-layer">
              <img
                src={result.url}
                alt="Versión optimizada"
                className="compare-image"
                draggable={false}
              />
              <span className="compare-tag compare-tag--result">
                Resultado
              </span>
            </div>

            <div
              className="compare-layer compare-layer--original"
              style={{ clipPath }}
            >
              <img
                src={item.previewUrl}
                alt="Foto original"
                className="compare-image"
                draggable={false}
              />
              <span className="compare-tag compare-tag--original">Original</span>
            </div>

            <span
              className="compare-divider"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            >
              <span className="compare-handle" />
            </span>
          </div>
        </div>

        <div className="compare-controls">
          <div className="compare-slider-row">
            <span aria-hidden="true">Original</span>
            <label className="visually-hidden" htmlFor={sliderId}>
              Comparar original y resultado
            </label>
            <input
              id={sliderId}
              className="compare-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              aria-valuetext={`${Math.round(position)} % del original visible`}
            />
            <span aria-hidden="true">Resultado</span>
          </div>

          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => setActualSize((current) => !current)}
            aria-pressed={actualSize}
          >
            {actualSize ? 'Ajustar a la pantalla' : 'Ver al 100 %'}
          </button>
        </div>

        <div className="compare-footer" aria-label="Detalles de la comparación">
          <p>
            <span>Original</span>
            {formatDimensions(item.width, item.height)} ·{' '}
            {formatBytes(item.size)}
          </p>
          <p>
            <span>Resultado</span>
            {formatDimensions(result.width, result.height)} ·{' '}
            {formatBytes(result.size)} · {formatName(result.format)}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
