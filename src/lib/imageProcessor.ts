import { processImage } from './processImage'
import type { ProcessOptions, ProcessedImage, WorkerRequest, WorkerResponse } from '../types'

export class ProcessingCancelledError extends Error {
  constructor() {
    super('Procesamiento cancelado.')
    this.name = 'ProcessingCancelledError'
  }
}

interface PendingTask {
  id: number
  resolve: (result: ProcessedImage) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
}

export class ImageProcessor {
  private worker: Worker | null = null
  private pending: PendingTask | null = null
  private nextId = 1
  private cancelled = false
  private workerUnavailable = false

  constructor() {
    this.startWorker()
  }

  private startWorker() {
    const supportsWorkerCanvas =
      typeof OffscreenCanvas !== 'undefined' &&
      'convertToBlob' in OffscreenCanvas.prototype

    if (
      this.workerUnavailable ||
      typeof Worker === 'undefined' ||
      !supportsWorkerCanvas
    ) {
      this.workerUnavailable = true
      return
    }

    try {
      const worker = new Worker(
        new URL('../workers/image.worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleMessage(event.data)
      }
      worker.onerror = () => {
        this.failPending(new Error('El procesador en segundo plano se ha detenido.'))
        this.worker?.terminate()
        this.worker = null
      }
      this.worker = worker
    } catch {
      this.workerUnavailable = true
    }
  }

  private handleMessage(message: WorkerResponse) {
    const task = this.pending
    if (!task || task.id !== message.id) return

    if (message.type === 'progress') {
      task.onProgress?.(message.progress)
      return
    }

    this.pending = null

    if (message.type === 'done') {
      task.resolve(message.result)
    } else {
      task.reject(new Error(message.message))
    }
  }

  private failPending(error: Error) {
    const task = this.pending
    this.pending = null
    task?.reject(error)
  }

  async process(
    file: File,
    options: ProcessOptions,
    onProgress?: (progress: number) => void,
  ): Promise<ProcessedImage> {
    if (this.cancelled) {
      throw new ProcessingCancelledError()
    }

    if (!this.worker) {
      return processImage(file, options, onProgress)
    }

    const id = this.nextId
    this.nextId += 1

    return new Promise<ProcessedImage>((resolve, reject) => {
      this.pending = { id, resolve, reject, onProgress }
      const request: WorkerRequest = { id, file, options }
      try {
        this.worker?.postMessage(request)
      } catch (error) {
        this.pending = null
        reject(
          error instanceof Error
            ? error
            : new Error('No se pudo enviar la imagen al procesador.'),
        )
      }
    })
  }

  cancel() {
    this.cancelled = true
    this.worker?.terminate()
    this.worker = null
    this.failPending(new ProcessingCancelledError())
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.pending = null
  }
}
