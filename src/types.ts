export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export type ProfileId = 'whatsapp' | 'email' | 'web' | 'target' | 'custom'

export interface AppSettings {
  format: OutputFormat
  quality: number
  maxSide: number
  targetBytes?: number
}

export interface ImageResult {
  blob: Blob
  url: string
  width: number
  height: number
  size: number
  format: OutputFormat
  formatFallback: boolean
  hadTransparency: boolean
  settingsKey: string
  settingsLabel: string
  quality: number
  maxSide: number
  useOriginal: boolean
  targetBytes?: number
  targetMet?: boolean
}

export type ImageStatus = 'ready' | 'queued' | 'processing' | 'done' | 'error'

export interface ImageItem {
  id: string
  file: File
  previewUrl: string
  name: string
  width: number
  height: number
  size: number
  status: ImageStatus
  progress: number
  result?: ImageResult
  error?: string
}

export interface FileIssue {
  id: string
  fileName: string
  message: string
}

export interface ProcessOptions extends AppSettings {
  mayHaveAlpha: boolean
}

export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
  format: OutputFormat
  formatFallback: boolean
  hadTransparency: boolean
  quality: number
  targetBytes?: number
  targetMet?: boolean
}

export interface WorkerRequest {
  id: number
  file: File
  options: ProcessOptions
}

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: number }
  | { type: 'done'; id: number; result: ProcessedImage }
  | { type: 'error'; id: number; message: string }

export interface DownloadItem {
  itemId: string
  originalName: string
  fileName: string
  blob: Blob
  width: number
  height: number
  size: number
  originalSize: number
  keepsOriginal: boolean
  result: ImageResult
}

export interface BatchProgress {
  total: number
  completed: number
  currentName: string
  currentProgress: number
}
