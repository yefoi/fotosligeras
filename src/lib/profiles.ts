import type { AppSettings, OutputFormat, ProfileId } from '../types'
import { formatBytes } from './format'

export interface ProfileOption {
  id: ProfileId
  name: string
  description: string
  detail: string
}

export const PROFILE_SETTINGS: Record<
  Exclude<ProfileId, 'custom' | 'target'>,
  AppSettings
> = {
  whatsapp: {
    format: 'image/jpeg',
    quality: 0.8,
    maxSide: 1600,
  },
  email: {
    format: 'image/jpeg',
    quality: 0.82,
    maxSide: 1920,
  },
  web: {
    format: 'image/webp',
    quality: 0.8,
    maxSide: 1600,
  },
}

export const DEFAULT_CUSTOM_SETTINGS: AppSettings = {
  format: 'image/jpeg',
  quality: 0.8,
  maxSide: 1600,
}

export const DEFAULT_TARGET_BYTES = 500 * 1024
export const MIN_TARGET_KB = 20
export const MAX_TARGET_KB = 25000
export const TARGET_MAX_SIDE = 4000

export const DEFAULT_TARGET_SETTINGS: AppSettings = {
  format: 'image/jpeg',
  quality: 0.92,
  maxSide: TARGET_MAX_SIDE,
  targetBytes: DEFAULT_TARGET_BYTES,
}

export const PROFILE_LABELS: Record<ProfileId, string> = {
  whatsapp: 'Enviar por WhatsApp',
  email: 'Enviar por correo',
  web: 'Publicar en una web',
  target: 'Peso máximo',
  custom: 'Personalizado',
}

export const PROFILE_OPTIONS: ProfileOption[] = [
  {
    id: 'whatsapp',
    name: PROFILE_LABELS.whatsapp,
    description: 'Para chats y estados. Buena calidad con un peso contenido.',
    detail: 'JPEG · 1600 px · 80 %',
  },
  {
    id: 'email',
    name: PROFILE_LABELS.email,
    description: 'Un poco más de detalle para adjuntos de correo.',
    detail: 'JPEG · 1920 px · 82 %',
  },
  {
    id: 'web',
    name: PROFILE_LABELS.web,
    description: 'Archivos ligeros para páginas y tiendas online.',
    detail: 'WebP · 1600 px · 80 %',
  },
  {
    id: 'custom',
    name: PROFILE_LABELS.custom,
    description: 'Ajusta el formato, el tamaño y la calidad a tu gusto.',
    detail: 'Tú eliges los ajustes',
  },
  {
    id: 'target',
    name: PROFILE_LABELS.target,
    description:
      'Para formularios o envíos con un límite de peso. Ajustamos la calidad por ti.',
    detail: 'JPEG o WebP · objetivo en KB',
  },
]

export const MIN_MAX_SIDE = 400
export const MAX_MAX_SIDE = 4000
export const MIN_QUALITY = 30
export const MAX_QUALITY = 100

export function resolveSettings(
  profileId: ProfileId,
  customSettings: AppSettings,
  targetSettings: AppSettings,
): AppSettings {
  if (profileId === 'custom') return customSettings
  if (profileId === 'target') return targetSettings
  return PROFILE_SETTINGS[profileId]
}

export function qualityApplies(format: OutputFormat): boolean {
  return format !== 'image/png'
}

export function settingsKey(settings: AppSettings): string {
  if (settings.targetBytes) {
    return `target|${settings.format}|${settings.maxSide}|${settings.targetBytes}`
  }
  const quality = qualityApplies(settings.format)
    ? Math.round(settings.quality * 100)
    : 0
  return `${settings.format}|${settings.maxSide}|${quality}`
}

export function formatName(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg':
      return 'JPEG'
    case 'image/png':
      return 'PNG'
    case 'image/webp':
      return 'WebP'
  }
}

export function formatExtension(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
  }
}

export function describeSettings(
  settings: AppSettings,
  profileId: ProfileId,
): string {
  const profileName = PROFILE_LABELS[profileId]

  if (settings.targetBytes) {
    return `${profileName} · ${formatName(settings.format)} · objetivo ${formatBytes(settings.targetBytes)} · hasta ${settings.maxSide} px`
  }

  const quality = qualityApplies(settings.format)
    ? ` · ${Math.round(settings.quality * 100)} %`
    : ''
  return `${profileName} · ${formatName(settings.format)} · ${settings.maxSide} px${quality}`
}

export function clampMaxSide(value: number): number {
  return Math.min(MAX_MAX_SIDE, Math.max(MIN_MAX_SIDE, Math.round(value / 50) * 50))
}
