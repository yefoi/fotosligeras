import { formatBytes, formatDimensions, formatPercent, formatSavings, savingsPercent } from '../lib/format'
import { formatName } from '../lib/profiles'
import type { DownloadItem, ImageItem } from '../types'
import {
  AlertIcon,
  ArrowRightIcon,
  CompareIcon,
  DownloadIcon,
  RefreshIcon,
} from './Icons'

interface ResultsPanelProps {
  items: ImageItem[]
  downloadsById: Map<string, DownloadItem>
  settingsKey: string
  isProcessing: boolean
  zipBusy: boolean
  zipProgress: number
  zipError: string | null
  onCompare: (item: ImageItem) => void
  onToggleOriginal: (item: ImageItem) => void
  onDownload: (item: ImageItem) => void
  onDownloadZip: () => void
  onDismissZipError: () => void
}

function originalFormatLabel(item: ImageItem): string {
  const type = item.file.type
  if (type === 'image/png') return 'PNG original'
  if (type === 'image/webp') return 'WebP original'
  if (type === 'image/jpeg' || type === 'image/jpg') return 'JPEG original'
  return 'Original'
}

export function ResultsPanel({
  items,
  downloadsById,
  settingsKey,
  isProcessing,
  zipBusy,
  zipProgress,
  zipError,
  onCompare,
  onToggleOriginal,
  onDownload,
  onDownloadZip,
  onDismissZipError,
}: ResultsPanelProps) {
  const resultItems = items.filter((item) => item.result)
  if (resultItems.length === 0) return null

  const hasStale = resultItems.some(
    (item) => item.result?.settingsKey !== settingsKey,
  )
  const pendingCount = items.length - resultItems.length
  const downloadableCount = resultItems.filter(
    (item) => item.result?.settingsKey === settingsKey,
  ).length

  let totalBefore = 0
  let totalAfter = 0
  let oversizedCount = 0
  let keepsOriginalCount = 0
  let targetCount = 0
  let targetWithinCount = 0
  let targetBytesLabel: number | null = null

  for (const item of resultItems) {
    const result = item.result
    if (!result) continue
    totalBefore += item.size
    totalAfter += result.useOriginal ? item.size : result.size
    if (result.useOriginal) keepsOriginalCount += 1
    else if (result.size >= item.size) oversizedCount += 1

    if (result.targetBytes) {
      targetCount += 1
      targetBytesLabel ??= result.targetBytes
      const effectiveSize = result.useOriginal ? item.size : result.size
      if (effectiveSize <= result.targetBytes) targetWithinCount += 1
    }
  }

  const totalSavings = savingsPercent(totalBefore, totalAfter)
  const downloadsDisabled = isProcessing || hasStale || zipBusy
  const savingsTone = totalSavings < 0 ? 'negative' : 'positive'
  const zipButtonLabel = zipBusy
    ? `Preparando ZIP… ${Math.round(zipProgress)} %`
    : hasStale
      ? 'Actualiza para descargar'
      : `Descargar ${downloadableCount} ${downloadableCount === 1 ? 'foto' : 'fotos'} en ZIP`

  return (
    <div className="results">
      <div className="summary">
        <div className="summary-top">
          <div>
            <p className="summary-kicker">Resumen del lote</p>
            <h2>Listo para compartir</h2>
            <p className="summary-copy">
              Compara, elige y descarga tus fotos. No hemos modificado los
              archivos originales.
            </p>
          </div>

          <button
            type="button"
            className="button button--primary button--large summary-download"
            onClick={onDownloadZip}
            disabled={downloadsDisabled || downloadableCount === 0}
            title={
              hasStale
                ? 'Actualiza los resultados con los ajustes actuales.'
                : 'Descarga todas las fotos con resultado en un único ZIP.'
            }
          >
            {zipBusy ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <DownloadIcon />
            )}
            {zipButtonLabel}
          </button>
        </div>

        <div className="summary-stats">
          <div className="summary-stat">
            <span className="summary-stat-label">Antes</span>
            <strong>{formatBytes(totalBefore)}</strong>
            <span className="summary-stat-foot">
              {resultItems.length}{' '}
              {resultItems.length === 1 ? 'foto procesada' : 'fotos procesadas'}
            </span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-label">Después</span>
            <strong>{formatBytes(totalAfter)}</strong>
            <span className="summary-stat-foot">
              {keepsOriginalCount > 0
                ? `${keepsOriginalCount} conserva${keepsOriginalCount === 1 ? '' : 'n'} el original`
                : 'peso de la descarga'}
            </span>
          </div>
          <div className={`summary-stat summary-stat--${savingsTone}`}>
            <span className="summary-stat-label">
              {totalSavings < 0 ? 'Aumento' : 'Ahorro'}
            </span>
            <strong>{formatPercent(Math.abs(totalSavings))}</strong>
            <span className="summary-stat-foot">
              {totalSavings < 0 ? 'el lote pesa más' : 'del peso total'}
            </span>
          </div>
        </div>

        {zipBusy && (
          <div
            className="progress-track progress-track--large"
            role="progressbar"
            aria-label="Progreso de creación del ZIP"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(zipProgress)}
          >
            <span
              className="progress-fill"
              style={{ width: `${zipProgress}%` }}
            />
          </div>
        )}

        {zipError && (
          <div className="inline-alert" role="alert">
            <AlertIcon />
            <p>{zipError}</p>
            <button
              type="button"
              className="text-button"
              onClick={onDismissZipError}
            >
              Cerrar
            </button>
          </div>
        )}

        {hasStale && (
          <div className="notice notice--warning">
            <RefreshIcon />
            <p>
              Has cambiado los ajustes. Los resultados anteriores están
              pendientes de actualizar y las descargas están desactivadas hasta
              que vuelvas a optimizar.
            </p>
          </div>
        )}

        {pendingCount > 0 && (
          <p className="summary-note">
            {pendingCount === 1
              ? 'Queda 1 foto sin resultado; no se incluirá en el ZIP.'
              : `Quedan ${pendingCount} fotos sin resultado; no se incluirán en el ZIP.`}
          </p>
        )}

        {targetCount > 0 && targetBytesLabel !== null && (
          <p
            className={`summary-note${targetWithinCount < targetCount ? ' summary-note--warning' : ''}`}
          >
            Objetivo de {formatBytes(targetBytesLabel)}:{' '}
            {targetWithinCount === targetCount
              ? `${targetCount === 1 ? 'la foto entra' : 'todas las fotos entran'} en el límite.`
              : `${targetWithinCount} de ${targetCount} fotos entran en el límite. Las demás necesitaron más peso.`}
          </p>
        )}

        {oversizedCount > 0 && (
          <p className="summary-note summary-note--warning">
            {oversizedCount === 1
              ? 'Una foto no pesa menos tras optimizarla. Puedes conservar su original desde la tarjeta.'
              : `${oversizedCount} fotos no pesan menos tras optimizarlas. Puedes conservar sus originales desde las tarjetas.`}
          </p>
        )}
      </div>

      <ul className="result-grid" aria-label="Resultados por foto">
        {resultItems.map((item) => {
          const result = item.result
          if (!result) return null
          const download = downloadsById.get(item.id)
          const finalSize = result.useOriginal ? item.size : result.size
          const finalWidth = result.useOriginal ? item.width : result.width
          const finalHeight = result.useOriginal ? item.height : result.height
          const savings = savingsPercent(item.size, finalSize)
          const stale = result.settingsKey !== settingsKey
          const isOversized = result.size >= item.size
          const canOfferOriginal = isOversized || result.useOriginal
          const downloadDisabled = downloadsDisabled || stale
          const compareDisabled = result.useOriginal

          return (
            <li className="result-card" key={item.id}>
              <div className="result-thumb">
                <img
                  src={result.useOriginal ? item.previewUrl : result.url}
                  alt=""
                  loading="lazy"
                />
              </div>

              <div className="result-content">
                <div className="result-heading">
                  <div className="result-title-block">
                    <p className="result-kicker">Foto optimizada</p>
                    <h3 className="result-name" title={item.name}>
                      {item.name}
                    </h3>
                  </div>
                  <span
                    className={`badge ${
                      stale
                        ? 'badge--warning'
                        : result.useOriginal
                          ? 'badge--sage'
                          : savings < 0
                            ? 'badge--warning'
                            : 'badge--sage'
                    }`}
                  >
                    {stale
                      ? 'Pendiente de actualizar'
                      : result.useOriginal
                        ? 'Original conservado'
                        : formatSavings(savings)}
                  </span>
                </div>

                <div className="result-sizes">
                  <span>
                    <small>Original</small>
                    <strong>{formatBytes(item.size)}</strong>
                  </span>
                  <ArrowRightIcon />
                  <span>
                    <small>Final</small>
                    <strong>{formatBytes(finalSize)}</strong>
                  </span>
                </div>

                <p className="result-meta">
                  {formatDimensions(finalWidth, finalHeight)} ·{' '}
                  {result.useOriginal
                    ? originalFormatLabel(item)
                    : formatName(result.format)}
                  {!result.useOriginal &&
                  !result.targetBytes &&
                  result.format !== 'image/png'
                    ? ` · calidad ${Math.round(result.quality * 100)} %`
                    : ''}
                </p>

                <p className="result-filename">
                  Se descargará como{' '}
                  <code title={download?.fileName}>{download?.fileName ?? '—'}</code>
                </p>

                {!result.useOriginal && (
                  <div className="result-details">
                    {result.targetBytes && (
                      <p
                        className={`detail-note${result.targetMet ? ' detail-note--success' : ' detail-note--warning'}`}
                      >
                        {result.targetMet
                          ? `Objetivo de ${formatBytes(result.targetBytes)} cumplido · calidad usada ${Math.round(result.quality * 100)} %.`
                          : `No se alcanzó el objetivo de ${formatBytes(result.targetBytes)}. El resultado más ligero pesa ${formatBytes(result.size)}.`}
                      </p>
                    )}
                    {result.hadTransparency && result.format === 'image/jpeg' && (
                      <p className="detail-note">
                        La foto tenía transparencia: se rellenó con fondo blanco
                        al exportar JPEG.
                      </p>
                    )}
                    {result.hadTransparency &&
                      (result.format === 'image/png' ||
                        result.format === 'image/webp') && (
                        <p className="detail-note">
                          Se conserva la transparencia de la foto.
                        </p>
                      )}
                    {result.formatFallback && (
                      <p className="detail-note detail-note--warning">
                        Tu navegador no pudo exportar WebP; se guardó como{' '}
                        {formatName(result.format)}.
                      </p>
                    )}
                    {isOversized && (
                      <p className="detail-note detail-note--warning">
                        El resultado no pesa menos que el original. Puedes
                        conservar el original en su lugar.
                      </p>
                    )}
                    {stale && (
                      <p className="detail-note detail-note--warning">
                        Generado con ajustes anteriores. Actualiza para poder
                        descargarlo.
                      </p>
                    )}
                  </div>
                )}

                {result.useOriginal && (
                  <>
                    <p className="detail-note">
                      Se descargará una copia del original, sin modificarlo.
                    </p>
                    {result.targetBytes && (
                      <p
                        className={`detail-note${item.size <= result.targetBytes ? ' detail-note--success' : ' detail-note--warning'}`}
                      >
                        {item.size <= result.targetBytes
                          ? `El original conservado está dentro del objetivo de ${formatBytes(result.targetBytes)}.`
                          : `El original conservado supera el objetivo de ${formatBytes(result.targetBytes)}.`}
                      </p>
                    )}
                  </>
                )}

                <div className="result-actions">
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => onCompare(item)}
                    disabled={compareDisabled || isProcessing}
                    title={
                      compareDisabled
                        ? 'Has elegido conservar el original.'
                        : 'Comparar el original con el resultado.'
                    }
                  >
                    <CompareIcon />
                    Comparar
                  </button>

                  <button
                    type="button"
                    className="button button--primary button--small"
                    onClick={() => onDownload(item)}
                    disabled={downloadDisabled || !download}
                    title={
                      stale
                        ? 'Actualiza los resultados para descargar.'
                        : 'Descargar esta foto.'
                    }
                  >
                    <DownloadIcon />
                    Descargar
                  </button>

                  {canOfferOriginal && (
                    <button
                      type="button"
                      className="button button--ghost button--small result-original-button"
                      onClick={() => onToggleOriginal(item)}
                      disabled={isProcessing || stale}
                    >
                      {result.useOriginal
                        ? 'Usar versión optimizada'
                        : 'Conservar original'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
