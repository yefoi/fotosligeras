import { strToU8, zip } from 'fflate'
import type { AppSettings, DownloadItem, ImageItem, ProfileId } from '../types'
import { formatBytes, formatDate, formatDimensions, formatSavings, savingsPercent } from './format'
import { describeSettings, formatExtension, formatName } from './profiles'

function sanitizeBaseName(value: string): string {
  let sanitized = ''

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    const invalid =
      code < 32 ||
      character === '<' ||
      character === '>' ||
      character === ':' ||
      character === '"' ||
      character === '/' ||
      character === '\\' ||
      character === '|' ||
      character === '?' ||
      character === '*'
    sanitized += invalid ? '-' : character
  }

  return sanitized
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
}

function splitFileName(name: string): { base: string; extension: string } {
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { base: name, extension: '' }
  }
  return {
    base: name.slice(0, lastDot),
    extension: name.slice(lastDot + 1).toLowerCase(),
  }
}

function originalExtension(item: ImageItem): string {
  const { extension } = splitFileName(item.name)
  if (extension === 'jpeg') return 'jpg'
  if (extension === 'jpg' || extension === 'png' || extension === 'webp') {
    return extension
  }
  if (item.file.type === 'image/png') return 'png'
  if (item.file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function uniqueName(
  base: string,
  suffix: string,
  extension: string,
  usedNames: Set<string>,
): string {
  const cleanBase = sanitizeBaseName(base) || 'foto'
  let counter = 1

  while (counter < 1000) {
    const candidate =
      counter === 1
        ? `${cleanBase}${suffix}.${extension}`
        : `${cleanBase}${suffix}-${counter}.${extension}`

    if (!usedNames.has(candidate.toLowerCase())) {
      usedNames.add(candidate.toLowerCase())
      return candidate
    }
    counter += 1
  }

  const fallback = `foto${suffix}-${Date.now()}.${extension}`
  usedNames.add(fallback.toLowerCase())
  return fallback
}

export function buildDownloadItems(items: ImageItem[]): DownloadItem[] {
  const usedNames = new Set(items.map((item) => item.name.toLowerCase()))
  const downloads: DownloadItem[] = []

  for (const item of items) {
    if (!item.result) continue

    const { base } = splitFileName(item.name)
    const keepsOriginal = item.result.useOriginal
    const extension = keepsOriginal
      ? originalExtension(item)
      : formatExtension(item.result.format)
    const suffix = keepsOriginal ? '-original' : '-ligero'
    const fileName = uniqueName(base, suffix, extension, usedNames)

    downloads.push({
      itemId: item.id,
      originalName: item.name,
      fileName,
      blob: keepsOriginal ? item.file : item.result.blob,
      width: keepsOriginal ? item.width : item.result.width,
      height: keepsOriginal ? item.height : item.result.height,
      size: keepsOriginal ? item.size : item.result.size,
      originalSize: item.size,
      keepsOriginal,
      result: item.result,
    })
  }

  return downloads
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function zipFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `fotos-ligeras-${year}-${month}-${day}.zip`
}

export interface SummaryOptions {
  settings: AppSettings
  profileId: ProfileId
  totalSelected: number
  totalResults: number
  includedCount: number
}

export function buildSummaryText(
  downloads: DownloadItem[],
  options: SummaryOptions,
): string {
  const totalBefore = downloads.reduce((sum, item) => sum + item.originalSize, 0)
  const totalAfter = downloads.reduce((sum, item) => sum + item.size, 0)
  const savings = savingsPercent(totalBefore, totalAfter)
  const lines: string[] = []

  lines.push('Fotos Ligeras — resumen del lote')
  lines.push(`Generado: ${formatDate(new Date())}`)
  lines.push('')
  lines.push(`Ajuste seleccionado: ${describeSettings(options.settings, options.profileId)}`)
  lines.push(`Fotos seleccionadas: ${options.totalSelected}`)
  lines.push(`Fotos con resultado: ${options.totalResults}`)
  lines.push(`Archivos incluidos en este ZIP: ${options.includedCount}`)
  lines.push('')
  lines.push('Archivos')

  downloads.forEach((download, index) => {
    const percent = savingsPercent(download.originalSize, download.size)
    lines.push(
      `${index + 1}. ${download.originalName} → ${download.fileName}`,
    )
    lines.push(`   Dimensiones: ${formatDimensions(download.width, download.height)}`)
    lines.push(
      `   Tamaño: ${formatBytes(download.originalSize)} → ${formatBytes(download.size)} (${formatSavings(percent)})`,
    )
    lines.push(
      `   Ajuste aplicado: ${download.result.settingsLabel}`,
    )
    if (download.result.targetBytes) {
      const withinTarget = download.size <= download.result.targetBytes
      lines.push(
        `   Objetivo de peso: ${formatBytes(download.result.targetBytes)} · ${
          withinTarget ? 'cumplido' : 'no alcanzado'
        }${download.keepsOriginal ? ' (se descarga el original)' : ` · calidad usada ${Math.round(download.result.quality * 100)} %`}`,
      )
    }
    if (download.keepsOriginal) {
      lines.push(
        '   Se conserva el archivo original porque la versión optimizada pesaba más.',
      )
    }
    if (download.result.hadTransparency && download.result.format === 'image/jpeg') {
      lines.push('   La foto tenía transparencia: se usó fondo blanco al guardar JPEG.')
    }
    if (download.result.formatFallback) {
      lines.push(
        `   El navegador no pudo exportar WebP; se guardó como ${formatName(download.result.format)}.`,
      )
    }
    lines.push('')
  })

  lines.push('Totales de los archivos incluidos')
  lines.push(
    `Antes: ${formatBytes(totalBefore)} · Después: ${formatBytes(totalAfter)} · ${formatSavings(savings)}`,
  )
  lines.push('')
  lines.push('Notas')
  lines.push(
    '- Todo el procesamiento se ha realizado dentro de este navegador; no se han subido fotos a ningún servidor.',
  )
  lines.push(
    '- No se copian metadatos EXIF al archivo generado. Esto no garantiza el anonimato: el contenido de la foto puede seguir siendo identificable.',
  )
  lines.push(
    '- La compresión puede producir pérdida visual. Los perfiles son ajustes de Fotos Ligeras, no límites oficiales de WhatsApp, el correo o una web.',
  )
  lines.push(
    '- Los archivos originales no se han modificado.',
  )

  return lines.join('\n')
}

export async function createZip(
  downloads: DownloadItem[],
  summaryOptions: SummaryOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {}
  const total = downloads.length

  for (let index = 0; index < downloads.length; index += 1) {
    const download = downloads[index]
    const buffer = await download.blob.arrayBuffer()
    entries[download.fileName] = new Uint8Array(buffer)
    onProgress?.(index + 1, total)
  }

  const summary = buildSummaryText(downloads, summaryOptions)
  entries['resumen.txt'] = strToU8(`\uFEFF${summary}`)

  return new Promise((resolve, reject) => {
    zip(entries, { level: 0 }, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      const bytes = new Uint8Array(data)
      resolve(new Blob([bytes], { type: 'application/zip' }))
    })
  })
}
