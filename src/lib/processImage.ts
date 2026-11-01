import type { OutputFormat, ProcessOptions, ProcessedImage } from '../types'

export type ProcessingErrorCode = 'decode' | 'canvas' | 'encode' | 'unsupported'

export class ProcessingError extends Error {
  readonly code: ProcessingErrorCode

  constructor(code: ProcessingErrorCode, message: string) {
    super(message)
    this.name = 'ProcessingError'
    this.code = code
  }
}

type SurfaceCanvas = OffscreenCanvas | HTMLCanvasElement
type SurfaceContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

interface Surface {
  canvas: SurfaceCanvas
  context: SurfaceContext
}

interface RenderedSurface {
  surface: Surface
  hadTransparency: boolean
}

interface TargetCandidate {
  blob: Blob
  quality: number
  meetsTarget: boolean
}

const TARGET_MIN_QUALITY = 0.3
const TARGET_MAX_QUALITY = 0.92
const TARGET_QUALITY_ITERATIONS = 4
const TARGET_MIN_LONGEST_SIDE = 320
const TARGET_MAX_ROUNDS = 6

export type ProgressCallback = (progress: number) => void

function supportsOffscreenCanvas(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    'convertToBlob' in OffscreenCanvas.prototype
  )
}

function createSurface(width: number, height: number): Surface {
  if (supportsOffscreenCanvas()) {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new ProcessingError(
        'canvas',
        'No se pudo preparar el lienzo de la imagen.',
      )
    }
    return { canvas, context }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new ProcessingError(
        'canvas',
        'No se pudo preparar el lienzo de la imagen.',
      )
    }
    return { canvas, context }
  }

  throw new ProcessingError(
    'unsupported',
    'Este navegador no puede procesar las imágenes.',
  )
}

function isOffscreenCanvas(canvas: SurfaceCanvas): canvas is OffscreenCanvas {
  return supportsOffscreenCanvas() && canvas instanceof OffscreenCanvas
}

function encodeCanvas(
  canvas: SurfaceCanvas,
  type: OutputFormat,
  quality: number | undefined,
): Promise<Blob> {
  if (isOffscreenCanvas(canvas)) {
    return canvas.convertToBlob({ type, quality })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else {
          reject(
            new ProcessingError(
              'encode',
              'No se pudo exportar la imagen en este navegador.',
            ),
          )
        }
      },
      type,
      quality,
    )
  })
}

async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ProcessingError(
      'unsupported',
      'Este navegador no puede leer las imágenes para procesarlas.',
    )
  }

  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    try {
      return await createImageBitmap(blob)
    } catch {
      throw new ProcessingError(
        'decode',
        'No se pudo leer la imagen. Puede estar dañada o tener un formato no válido.',
      )
    }
  }
}

function detectTransparency(
  context: SurfaceContext,
  width: number,
  height: number,
): boolean {
  try {
    const pixels = context.getImageData(0, 0, width, height).data
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) return true
    }
  } catch {
    return false
  }
  return false
}

function createReporter(onProgress?: ProgressCallback) {
  let current = 0

  return (value: number) => {
    const next = Math.max(current, Math.min(100, Math.round(value)))
    if (next === current) return
    current = next
    onProgress?.(next)
  }
}

function fitWithin(
  bitmap: ImageBitmap,
  maxSide: number,
): { width: number; height: number } {
  const longestSide = Math.max(bitmap.width, bitmap.height)
  const scale = maxSide > 0 ? Math.min(1, maxSide / longestSide) : 1
  return {
    width: Math.max(1, Math.round(bitmap.width * scale)),
    height: Math.max(1, Math.round(bitmap.height * scale)),
  }
}

function renderSurface(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  format: OutputFormat,
  mayHaveAlpha: boolean,
  detectAlpha: boolean,
  knownTransparency = false,
): RenderedSurface {
  const surface = createSurface(width, height)
  surface.context.imageSmoothingEnabled = true
  surface.context.imageSmoothingQuality = 'high'
  surface.context.clearRect(0, 0, width, height)
  surface.context.drawImage(bitmap, 0, 0, width, height)

  const hadTransparency =
    detectAlpha && mayHaveAlpha
      ? detectTransparency(surface.context, width, height)
      : knownTransparency

  if (format === 'image/jpeg' && hadTransparency) {
    surface.context.globalCompositeOperation = 'destination-over'
    surface.context.fillStyle = '#ffffff'
    surface.context.fillRect(0, 0, width, height)
    surface.context.globalCompositeOperation = 'source-over'
  }

  return { surface, hadTransparency }
}

async function encodeWithFallback(
  surface: Surface,
  requestedFormat: OutputFormat,
  quality: number | undefined,
  hadTransparency: boolean,
): Promise<{ blob: Blob; format: OutputFormat; formatFallback: boolean }> {
  try {
    const blob = await encodeCanvas(surface.canvas, requestedFormat, quality)

    if (requestedFormat !== 'image/webp' || blob.type === requestedFormat) {
      if (blob.type !== requestedFormat) {
        throw new ProcessingError(
          'encode',
          'El navegador no ha podido exportar el formato elegido.',
        )
      }
      return { blob, format: requestedFormat, formatFallback: false }
    }

    return await encodeFallbackForWebp(surface, quality, hadTransparency)
  } catch (error) {
    if (requestedFormat === 'image/webp') {
      return encodeFallbackForWebp(surface, quality, hadTransparency)
    }
    if (error instanceof ProcessingError) throw error
    throw new ProcessingError(
      'encode',
      'No se pudo exportar la imagen en este navegador.',
    )
  }
}

async function encodeFallbackForWebp(
  surface: Surface,
  quality: number | undefined,
  hadTransparency: boolean,
): Promise<{ blob: Blob; format: OutputFormat; formatFallback: boolean }> {
  const fallbackFormat: OutputFormat = hadTransparency ? 'image/png' : 'image/jpeg'

  try {
    const blob = await encodeCanvas(
      surface.canvas,
      fallbackFormat,
      fallbackFormat === 'image/jpeg' ? quality : undefined,
    )
    return { blob, format: fallbackFormat, formatFallback: true }
  } catch {
    throw new ProcessingError(
      'encode',
      'No se pudo exportar la imagen en este navegador.',
    )
  }
}

async function encodeForTarget(
  canvas: SurfaceCanvas,
  format: OutputFormat,
  quality: number,
  reportAttempt: () => void,
): Promise<Blob> {
  reportAttempt()

  let blob: Blob
  try {
    blob = await encodeCanvas(canvas, format, quality)
  } catch {
    throw new ProcessingError(
      'encode',
      format === 'image/webp'
        ? 'Tu navegador no puede exportar WebP con peso ajustable. Prueba con JPEG.'
        : 'No se pudo exportar la imagen en el formato elegido.',
    )
  }

  if (blob.type !== format) {
    throw new ProcessingError(
      'encode',
      format === 'image/webp'
        ? 'Tu navegador no puede exportar WebP con peso ajustable. Prueba con JPEG.'
        : 'No se pudo exportar la imagen en el formato elegido.',
    )
  }

  return blob
}

async function findTargetQuality(
  surface: Surface,
  format: OutputFormat,
  targetBytes: number,
  reportAttempt: () => void,
): Promise<TargetCandidate> {
  const maxBlob = await encodeForTarget(
    surface.canvas,
    format,
    TARGET_MAX_QUALITY,
    reportAttempt,
  )
  if (maxBlob.size <= targetBytes) {
    return {
      blob: maxBlob,
      quality: TARGET_MAX_QUALITY,
      meetsTarget: true,
    }
  }

  const minBlob = await encodeForTarget(
    surface.canvas,
    format,
    TARGET_MIN_QUALITY,
    reportAttempt,
  )
  if (minBlob.size > targetBytes) {
    return {
      blob: minBlob,
      quality: TARGET_MIN_QUALITY,
      meetsTarget: false,
    }
  }

  let low = TARGET_MIN_QUALITY
  let high = TARGET_MAX_QUALITY
  let best = minBlob
  let bestQuality = TARGET_MIN_QUALITY

  for (let index = 0; index < TARGET_QUALITY_ITERATIONS; index += 1) {
    const quality = (low + high) / 2
    const blob = await encodeForTarget(
      surface.canvas,
      format,
      quality,
      reportAttempt,
    )

    if (blob.size <= targetBytes) {
      best = blob
      bestQuality = quality
      low = quality
      if (targetBytes - blob.size <= Math.max(1024, targetBytes * 0.02)) break
    } else {
      high = quality
    }
  }

  return { blob: best, quality: bestQuality, meetsTarget: true }
}

async function processImageToTarget(
  file: File,
  options: ProcessOptions,
  report: (progress: number) => void,
): Promise<ProcessedImage> {
  const targetBytes = options.targetBytes ?? 0

  if (options.format === 'image/png') {
    throw new ProcessingError(
      'encode',
      'El peso objetivo no admite PNG. Elige JPEG o WebP.',
    )
  }

  report(5)
  const bitmap = await decodeImage(file)
  report(16)

  try {
    const initial = fitWithin(bitmap, options.maxSide)
    let width = initial.width
    let height = initial.height
    let hadTransparency = false
    let bestCandidate: (TargetCandidate & { width: number; height: number }) | null =
      null
    let attemptCount = 0

    const reportAttempt = () => {
      attemptCount += 1
      report(30 + Math.min(58, attemptCount * 7))
    }

    for (let round = 0; round < TARGET_MAX_ROUNDS; round += 1) {
      const rendered = renderSurface(
        bitmap,
        width,
        height,
        options.format,
        options.mayHaveAlpha,
        round === 0,
        hadTransparency,
      )
      if (round === 0) hadTransparency = rendered.hadTransparency
      report(30 + Math.min(58, (round + 1) * 2))

      const candidate = await findTargetQuality(
        rendered.surface,
        options.format,
        targetBytes,
        reportAttempt,
      )
      const positioned = {
        ...candidate,
        width,
        height,
      }

      if (!bestCandidate || candidate.blob.size < bestCandidate.blob.size) {
        bestCandidate = positioned
      }

      if (candidate.meetsTarget) {
        report(100)
        return {
          blob: candidate.blob,
          width,
          height,
          format: options.format,
          formatFallback: false,
          hadTransparency,
          quality: candidate.quality,
          targetBytes,
          targetMet: true,
        }
      }

      const longest = Math.max(width, height)
      if (longest <= TARGET_MIN_LONGEST_SIDE) break

      const ratio = targetBytes / Math.max(1, candidate.blob.size)
      const factor = Math.min(
        0.9,
        Math.max(0.5, Math.sqrt(ratio) * 0.95),
      )
      const nextLongest = Math.max(
        TARGET_MIN_LONGEST_SIDE,
        Math.round(longest * factor),
      )

      if (nextLongest >= longest) break

      const scale = nextLongest / longest
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
    }

    if (!bestCandidate) {
      throw new ProcessingError(
        'encode',
        'No se pudo generar un resultado para el peso solicitado.',
      )
    }

    report(100)
    return {
      blob: bestCandidate.blob,
      width: bestCandidate.width,
      height: bestCandidate.height,
      format: options.format,
      formatFallback: false,
      hadTransparency,
      quality: bestCandidate.quality,
      targetBytes,
      targetMet: false,
    }
  } finally {
    bitmap.close()
  }
}

async function processImageToQuality(
  file: File,
  options: ProcessOptions,
  report: (progress: number) => void,
): Promise<ProcessedImage> {
  report(8)
  const bitmap = await decodeImage(file)
  report(38)

  try {
    const { width, height } = fitWithin(bitmap, options.maxSide)
    const rendered = renderSurface(
      bitmap,
      width,
      height,
      options.format,
      options.mayHaveAlpha,
      true,
    )
    report(62)

    if (rendered.hadTransparency) report(76)

    const quality = options.format === 'image/png' ? undefined : options.quality
    const encoded = await encodeWithFallback(
      rendered.surface,
      options.format,
      quality,
      rendered.hadTransparency,
    )
    report(100)

    return {
      blob: encoded.blob,
      width,
      height,
      format: encoded.format,
      formatFallback: encoded.formatFallback,
      hadTransparency: rendered.hadTransparency,
      quality: options.quality,
    }
  } finally {
    bitmap.close()
  }
}

export async function processImage(
  file: File,
  options: ProcessOptions,
  onProgress?: ProgressCallback,
): Promise<ProcessedImage> {
  const report = createReporter(onProgress)

  if (options.targetBytes && options.targetBytes > 0) {
    return processImageToTarget(file, options, report)
  }

  return processImageToQuality(file, options, report)
}
