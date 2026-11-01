import { processImage, ProcessingError } from '../lib/processImage'
import type { WorkerRequest, WorkerResponse } from '../types'

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, file, options } = event.data

  void processImage(file, options, (progress) => {
    workerScope.postMessage({ type: 'progress', id, progress })
  })
    .then((result) => {
      workerScope.postMessage({ type: 'done', id, result })
    })
    .catch((error: unknown) => {
      const message =
        error instanceof ProcessingError
          ? error.message
          : 'No se pudo procesar la imagen en este navegador.'
      workerScope.postMessage({ type: 'error', id, message })
    })
}
