import { formatBytes } from './format'
import type { OutputFormat } from '../types'

export const MAX_FILES = 30
export const MAX_FILE_BYTES = 25 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i
const HEIC_EXTENSIONS = /\.(heic|heif)$/i

export const HEIC_MESSAGE =
  'Los archivos HEIC/HEIF todavía no se admiten. Si haces las fotos con un iPhone, expórtalas como JPEG antes de añadirlas.'

export function validateImageFile(file: File): string | null {
  const mime = file.type.toLowerCase()

  if (mime.includes('heic') || mime.includes('heif') || HEIC_EXTENSIONS.test(file.name)) {
    return HEIC_MESSAGE
  }

  if (mime !== '' && mime !== 'application/octet-stream') {
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return 'Formato no admitido. Usa una foto JPEG, PNG o WebP.'
    }
  } else if (!ALLOWED_EXTENSIONS.test(file.name)) {
    return 'Formato no admitido. Usa una foto JPEG, PNG o WebP.'
  }

  if (file.size === 0) {
    return 'El archivo está vacío o no se puede leer.'
  }

  if (file.size > MAX_FILE_BYTES) {
    return `Pesa ${formatBytes(file.size)}. El límite es de 25 MB por imagen.`
  }

  return null
}

export function sourceMayHaveAlpha(file: File): boolean {
  const mime = file.type.toLowerCase()
  if (mime === 'image/png' || mime === 'image/webp') return true
  return /\.(png|webp)$/i.test(file.name)
}

export function sourceFormat(file: File): OutputFormat | null {
  const mime = file.type.toLowerCase()
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg'
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/webp') return 'image/webp'
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (/\.png$/i.test(file.name)) return 'image/png'
  if (/\.webp$/i.test(file.name)) return 'image/webp'
  return null
}

interface Dimensions {
  width: number
  height: number
}

function readWithImageElement(file: File): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        reject(new Error('La imagen no tiene dimensiones válidas.'))
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    image.src = url
  })
}

export async function readImageDimensions(file: File): Promise<Dimensions> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      if (dimensions.width === 0 || dimensions.height === 0) {
        throw new Error('La imagen no tiene dimensiones válidas.')
      }
      return dimensions
    } catch {
      // Algunos navegadores antiguos no admiten las opciones de createImageBitmap.
    }
  }

  return readWithImageElement(file)
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
