import { useRef, useState } from 'react'
import { UploadIcon } from './Icons'
import { MAX_FILES, MAX_FILE_BYTES } from '../lib/files'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  disabled: boolean
  limitReached: boolean
  isPreparing: boolean
  itemCount: number
}

export function FileDropzone({
  onFiles,
  disabled,
  limitReached,
  isPreparing,
  itemCount,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const inactive = disabled || limitReached

  function openPicker() {
    if (inactive) return
    inputRef.current?.click()
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length > 0) onFiles(files)
    event.target.value = ''
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (inactive) return
    dragDepth.current += 1
    setIsDragging(true)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!inactive) event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (inactive) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  const classes = [
    'dropzone',
    isDragging ? 'dropzone--dragging' : '',
    inactive ? 'dropzone--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-busy={isPreparing}
    >
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      <span className="dropzone-icon" aria-hidden="true">
        <UploadIcon />
      </span>

      <div className="dropzone-copy">
        <p className="dropzone-title">
          {isDragging
            ? 'Suelta las fotos aquí'
            : limitReached
              ? 'Ya tienes el máximo de fotos'
              : 'Arrastra tus fotos aquí'}
        </p>
        <p className="dropzone-subtitle">
          o{' '}
          <button
            type="button"
            className="text-button"
            onClick={openPicker}
            disabled={inactive}
          >
            elige los archivos
          </button>{' '}
          desde tu dispositivo
        </p>
      </div>

      <button
        type="button"
        className="button button--primary dropzone-button"
        onClick={openPicker}
        disabled={inactive}
      >
        {isPreparing ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Preparando…
          </>
        ) : limitReached ? (
          `${itemCount} de ${MAX_FILES} fotos`
        ) : (
          'Añadir fotos'
        )}
      </button>

      <div className="dropzone-meta" aria-hidden="true">
        <span>{MAX_FILES} fotos como máximo</span>
        <span>JPEG, PNG o WebP</span>
        <span>{MAX_FILE_BYTES / 1024 / 1024} MB por foto</span>
      </div>

      <p className="dropzone-heic">
        HEIC todavía no está disponible. Si tu iPhone guarda así las fotos,
        expórtalas como JPEG antes de añadirlas.
      </p>
    </div>
  )
}
