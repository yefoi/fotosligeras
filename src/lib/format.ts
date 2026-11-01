const decimalFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${integerFormatter.format(bytes)} B`

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const formatted =
    value < 10 ? decimalFormatter.format(value) : integerFormatter.format(value)

  return `${formatted} ${units[unitIndex]}`
}

export function formatDimension(value: number): string {
  return integerFormatter.format(value)
}

export function formatDimensions(width: number, height: number): string {
  return `${formatDimension(width)} × ${formatDimension(height)} px`
}

export function savingsPercent(
  originalSize: number,
  finalSize: number,
): number {
  if (originalSize <= 0) return 0
  return ((originalSize - finalSize) / originalSize) * 100
}

export function formatSavings(percent: number): string {
  const rounded = Math.round(Math.abs(percent) * 10) / 10
  if (rounded < 0.1) return 'Sin ahorro'
  return percent > 0 ? `${decimalFormatter.format(rounded)} % menos` : `${decimalFormatter.format(rounded)} % más`
}

export function formatPercent(percent: number): string {
  return `${decimalFormatter.format(percent)} %`
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}
