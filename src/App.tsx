import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { CompareDialog } from './components/CompareDialog'
import { FileDropzone } from './components/FileDropzone'
import {
  AlertIcon,
  CheckIcon,
  ImageIcon,
  InfoIcon,
  LockIcon,
  LogoMark,
  RefreshIcon,
  ShieldIcon,
  SparkIcon,
} from './components/Icons'
import { ImageList } from './components/ImageList'
import { ProfilePicker } from './components/ProfilePicker'
import { ResultsPanel } from './components/ResultsPanel'
import { Stepper, type StepState } from './components/Stepper'
import {
  buildDownloadItems,
  createZip,
  triggerDownload,
  zipFileName,
} from './lib/downloads'
import {
  MAX_FILES,
  createId,
  readImageDimensions,
  sourceFormat,
  sourceMayHaveAlpha,
  validateImageFile,
} from './lib/files'
import {
  ImageProcessor,
  ProcessingCancelledError,
} from './lib/imageProcessor'
import {
  DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_TARGET_SETTINGS,
  describeSettings,
  resolveSettings,
  settingsKey,
} from './lib/profiles'
import type {
  AppSettings,
  BatchProgress,
  FileIssue,
  ImageItem,
  ImageResult,
  ProfileId,
} from './types'

interface PrepareProgress {
  done: number
  total: number
}

interface Notice {
  tone: 'success' | 'info' | 'warning'
  text: string
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function revokeItemUrls(item: ImageItem) {
  URL.revokeObjectURL(item.previewUrl)
  if (item.result) URL.revokeObjectURL(item.result.url)
}

function toneIcon(tone: Notice['tone']) {
  if (tone === 'success') return <CheckIcon />
  if (tone === 'warning') return <AlertIcon />
  return <InfoIcon />
}

function App() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [issues, setIssues] = useState<FileIssue[]>([])
  const [profileId, setProfileId] = useState<ProfileId>('whatsapp')
  const [customSettings, setCustomSettings] = useState<AppSettings>(
    DEFAULT_CUSTOM_SETTINGS,
  )
  const [targetSettings, setTargetSettings] = useState<AppSettings>(
    DEFAULT_TARGET_SETTINGS,
  )
  const [isPreparing, setIsPreparing] = useState(false)
  const [prepareProgress, setPrepareProgress] = useState<PrepareProgress | null>(
    null,
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [compareId, setCompareId] = useState<string | null>(null)
  const [zipBusy, setZipBusy] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)
  const [zipError, setZipError] = useState<string | null>(null)

  const itemsRef = useRef<ImageItem[]>([])
  const addingRef = useRef(false)
  const processorRef = useRef<ImageProcessor | null>(null)
  const batchTokenRef = useRef(0)
  const runCountersRef = useRef({ completed: 0, failed: 0 })

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    return () => {
      batchTokenRef.current += 1
      processorRef.current?.cancel()
      processorRef.current = null
      for (const item of itemsRef.current) revokeItemUrls(item)
    }
  }, [])

  const settings = resolveSettings(profileId, customSettings, targetSettings)
  const currentSettingsKey = settingsKey(settings)
  const isBusy = isPreparing || isProcessing
  const limitReached = items.length >= MAX_FILES
  const remainingSlots = Math.max(0, MAX_FILES - items.length)

  const resultItems = items.filter((item) => item.result)
  const pendingCount = items.filter(
    (item) => !item.result || item.result.settingsKey !== currentSettingsKey,
  ).length
  const hasStaleResults = items.some(
    (item) => item.result && item.result.settingsKey !== currentSettingsKey,
  )
  const hasResults = resultItems.length > 0
  const allCurrent = items.length > 0 && pendingCount === 0

  const downloadItems = useMemo(() => buildDownloadItems(items), [items])
  const downloadsById = useMemo(
    () => new Map(downloadItems.map((download) => [download.itemId, download])),
    [downloadItems],
  )

  const stepStates: StepState[] = [
    items.length > 0 ? 'done' : 'active',
    items.length === 0 ? 'upcoming' : allCurrent ? 'done' : 'active',
    hasResults && allCurrent ? 'active' : 'upcoming',
  ]

  const steps = [
    { id: 'add', label: 'Añade tus fotos', state: stepStates[0] },
    { id: 'choose', label: 'Elige el tamaño', state: stepStates[1] },
    { id: 'download', label: 'Descarga', state: stepStates[2] },
  ]

  const compareItem = compareId
    ? items.find((item) => item.id === compareId)
    : undefined
  const compareStale = compareItem?.result
    ? compareItem.result.settingsKey !== currentSettingsKey
    : false

  function makeIssue(fileName: string, message: string): FileIssue {
    return { id: createId(), fileName, message }
  }

  async function handleFiles(files: File[]) {
    if (
      files.length === 0 ||
      addingRef.current ||
      isProcessing ||
      isPreparing
    ) {
      return
    }

    if (limitReached) {
      const message = `Ya tienes ${MAX_FILES} fotos. Quita alguna antes de añadir más.`
      setIssues((current) => [...current, makeIssue('Límite del lote', message)])
      setAnnouncement(message)
      return
    }

    addingRef.current = true
    setNotice(null)

    const localIssues: FileIssue[] = []
    const validFiles: File[] = []
    let omittedByLimit = 0

    for (const file of files) {
      const error = validateImageFile(file)
      if (error) {
        localIssues.push(makeIssue(file.name || 'Archivo sin nombre', error))
      } else if (validFiles.length >= remainingSlots) {
        omittedByLimit += 1
      } else {
        validFiles.push(file)
      }
    }

    if (omittedByLimit > 0) {
      localIssues.push(
        makeIssue(
          'Límite del lote',
          `Solo se admiten ${MAX_FILES} fotos por lote. Se omitieron ${omittedByLimit} ${
            omittedByLimit === 1 ? 'archivo' : 'archivos'
          }.`,
        ),
      )
    }

    if (validFiles.length === 0) {
      setIssues((current) => [...current, ...localIssues])
      setAnnouncement(
        files.length === 1
          ? 'No se pudo añadir la foto. Revisa el aviso.'
          : 'No se pudo añadir ninguna foto. Revisa los avisos.',
      )
      addingRef.current = false
      return
    }

    setIsPreparing(true)
    setPrepareProgress({ done: 0, total: validFiles.length })

    let added = 0
    for (let index = 0; index < validFiles.length; index += 1) {
      const file = validFiles[index]
      try {
        const dimensions = await readImageDimensions(file)
        const previewUrl = URL.createObjectURL(file)
        const item: ImageItem = {
          id: createId(),
          file,
          previewUrl,
          name: file.name || 'foto',
          width: dimensions.width,
          height: dimensions.height,
          size: file.size,
          status: 'ready',
          progress: 0,
        }
        setItems((current) => [...current, item])
        added += 1
      } catch {
        localIssues.push(
          makeIssue(
            file.name,
            'No se pudo leer la imagen. Puede estar dañada o no ser una foto válida.',
          ),
        )
      }
      setPrepareProgress({ done: index + 1, total: validFiles.length })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    setIssues((current) => [...current, ...localIssues])
    setIsPreparing(false)
    setPrepareProgress(null)
    addingRef.current = false

    const failureNote =
      localIssues.length > 0
        ? ` ${plural(localIssues.length, 'archivo no se pudo añadir', 'archivos no se pudieron añadir')}.`
        : ''
    setAnnouncement(
      added > 0
        ? `Se ${added === 1 ? 'ha añadido' : 'han añadido'} ${plural(added, 'foto', 'fotos')}.${failureNote}`
        : 'No se pudo añadir ninguna foto. Revisa los avisos.',
    )
  }

  function removeItem(id: string) {
    if (isBusy || zipBusy) return
    const target = items.find((item) => item.id === id)
    if (!target) return
    revokeItemUrls(target)
    setItems((current) => current.filter((item) => item.id !== id))
    if (compareId === id) setCompareId(null)
    setAnnouncement(`Se ha quitado ${target.name}.`)
  }

  function clearAll() {
    if (isBusy || zipBusy) return
    for (const item of items) revokeItemUrls(item)
    setItems([])
    setIssues([])
    setCompareId(null)
    setNotice(null)
    setBatchProgress(null)
    setZipError(null)
    setZipProgress(0)
    setAnnouncement('Se ha vaciado la selección. Tus archivos originales siguen intactos.')
  }

  function dismissIssue(id: string) {
    setIssues((current) => current.filter((issue) => issue.id !== id))
  }

  function dismissAllIssues() {
    setIssues([])
  }

  function handleProfileChange(nextProfile: ProfileId) {
    if (isBusy || zipBusy) return
    setNotice(null)
    setProfileId(nextProfile)
  }

  function handleCustomSettingsChange(nextSettings: AppSettings) {
    if (isBusy || zipBusy) return
    setNotice(null)
    setCustomSettings(nextSettings)
  }

  function handleTargetSettingsChange(nextSettings: AppSettings) {
    if (isBusy || zipBusy) return
    setNotice(null)
    setTargetSettings(nextSettings)
  }

  function updateItemProgress(token: number, itemId: string, progress: number) {
    if (batchTokenRef.current !== token) return
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, progress } : item,
      ),
    )
    setBatchProgress((current) =>
      current ? { ...current, currentProgress: progress } : current,
    )
  }

  async function handleProcess() {
    if (isBusy || zipBusy || items.length === 0) return

    const settingsAtStart = settings
    const settingsKeyAtStart = settingsKey(settingsAtStart)
    const settingsLabelAtStart = describeSettings(settingsAtStart, profileId)
    const targets = items.filter(
      (item) =>
        !item.result || item.result.settingsKey !== settingsKeyAtStart,
    )

    if (targets.length === 0) {
      setAnnouncement('Los resultados ya están actualizados.')
      return
    }

    const token = batchTokenRef.current + 1
    batchTokenRef.current = token
    const processor = new ImageProcessor()
    processorRef.current = processor

    setIsProcessing(true)
    setNotice(null)
    setZipError(null)
    setBatchProgress({
      total: targets.length,
      completed: 0,
      currentName: '',
      currentProgress: 0,
    })
    setAnnouncement(
      `Procesando ${plural(targets.length, 'foto', 'fotos')} en tu dispositivo.`,
    )
    setItems((current) =>
      current.map((item) =>
        targets.some((target) => target.id === item.id)
          ? {
              ...item,
              status: 'queued',
              progress: 0,
              error: undefined,
            }
          : item,
      ),
    )

    runCountersRef.current = { completed: 0, failed: 0 }

    try {
      for (const item of targets) {
        if (batchTokenRef.current !== token) return

        setBatchProgress((current) =>
          current
            ? {
                ...current,
                currentName: item.name,
                currentProgress: 0,
              }
            : current,
        )
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: 'processing', progress: 0 }
              : candidate,
          ),
        )

        try {
          const processed = await processor.process(
            item.file,
            {
              ...settingsAtStart,
              mayHaveAlpha: sourceMayHaveAlpha(item.file),
            },
            (progress) => updateItemProgress(token, item.id, progress),
          )

          if (batchTokenRef.current !== token) return

          const resultUrl = URL.createObjectURL(processed.blob)
          if (item.result) URL.revokeObjectURL(item.result.url)

          const targetBytes = settingsAtStart.targetBytes
          const originalAlreadyFits =
            targetBytes !== undefined &&
            item.size <= targetBytes &&
            Math.max(item.width, item.height) <= settingsAtStart.maxSide &&
            sourceFormat(item.file) === settingsAtStart.format
          const keepOriginal =
            originalAlreadyFits && processed.blob.size >= item.size

          const result: ImageResult = {
            blob: processed.blob,
            url: resultUrl,
            width: processed.width,
            height: processed.height,
            size: processed.blob.size,
            format: processed.format,
            formatFallback: processed.formatFallback,
            hadTransparency: processed.hadTransparency,
            settingsKey: settingsKeyAtStart,
            settingsLabel: settingsLabelAtStart,
            quality: processed.quality,
            maxSide: settingsAtStart.maxSide,
            useOriginal: keepOriginal,
            targetBytes: processed.targetBytes,
            targetMet: processed.targetMet,
          }

          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    status: 'done',
                    progress: 100,
                    result,
                    error: undefined,
                  }
                : candidate,
            ),
          )
        } catch (error) {
          if (batchTokenRef.current !== token) return
          if (error instanceof ProcessingCancelledError) return

          runCountersRef.current.failed += 1
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'No se pudo procesar esta imagen. Vuelve a intentarlo.'
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    status: 'error',
                    progress: 0,
                    error: message,
                  }
                : candidate,
            ),
          )
        }

        runCountersRef.current.completed += 1
        setBatchProgress((current) =>
          current
            ? {
                ...current,
                completed: runCountersRef.current.completed,
                currentProgress: 100,
              }
            : current,
        )
      }

      if (batchTokenRef.current !== token) return

      setIsProcessing(false)
      setBatchProgress(null)
      processorRef.current = null
      processor.dispose()

      const { completed, failed } = runCountersRef.current

      if (failed > 0) {
        setNotice({
          tone: 'warning',
          text: `${plural(completed - failed, 'foto optimizada', 'fotos optimizadas')}. ${plural(failed, 'foto no se pudo procesar', 'fotos no se pudieron procesar')}. Puedes reintentarlas con el botón de optimizar.`,
        })
        setAnnouncement(
          `Lote terminado. ${plural(completed - failed, 'foto optimizada', 'fotos optimizadas')} y ${plural(failed, 'error', 'errores')}.`,
        )
      } else {
        setNotice({
          tone: 'success',
          text: `${plural(completed, 'foto lista', 'fotos listas')} para comparar y descargar.`,
        })
        setAnnouncement(
          `Lote completado. ${plural(completed, 'foto optimizada', 'fotos optimizadas')}.`,
        )
      }
    } catch (error) {
      if (batchTokenRef.current !== token) return
      setIsProcessing(false)
      setBatchProgress(null)
      processorRef.current = null
      processor.dispose()
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo completar el procesamiento.'
      setNotice({ tone: 'warning', text: message })
      setAnnouncement(message)
    }
  }

  function handleCancel() {
    if (!isProcessing) return

    batchTokenRef.current += 1
    processorRef.current?.cancel()
    processorRef.current = null
    setIsProcessing(false)
    setBatchProgress(null)
    setItems((current) =>
      current.map((item) =>
        item.status === 'processing' || item.status === 'queued'
          ? { ...item, status: 'ready', progress: 0, error: undefined }
          : item,
      ),
    )
    const text =
      'Procesamiento cancelado. Los resultados que ya estaban listos se mantienen.'
    setNotice({ tone: 'info', text })
    setAnnouncement(text)
  }

  function handleDownload(item: ImageItem) {
    if (isBusy || zipBusy) return
    const download = downloadsById.get(item.id)
    if (!download) return
    if (download.result.settingsKey !== currentSettingsKey) {
      setNotice({
        tone: 'warning',
        text: 'Actualiza los resultados antes de descargar esta foto.',
      })
      return
    }
    triggerDownload(download.blob, download.fileName)
    setAnnouncement(`Descarga iniciada: ${download.fileName}.`)
  }

  function handleToggleOriginal(item: ImageItem) {
    if (isBusy || zipBusy) return
    setItems((current) =>
      current.map((candidate) => {
        if (candidate.id !== item.id || !candidate.result) return candidate
        return {
          ...candidate,
          result: {
            ...candidate.result,
            useOriginal: !candidate.result.useOriginal,
          },
        }
      }),
    )
    setAnnouncement(
      item.result?.useOriginal
        ? 'Se usará la versión optimizada.'
        : 'Se conservará el archivo original.',
    )
  }

  async function handleDownloadZip() {
    if (isBusy || zipBusy || hasStaleResults) return

    const downloads = buildDownloadItems(itemsRef.current).filter(
      (download) => download.result.settingsKey === currentSettingsKey,
    )
    if (downloads.length === 0) return

    setZipBusy(true)
    setZipProgress(0)
    setZipError(null)
    setAnnouncement('Preparando el ZIP. Puede tardar unos segundos.')

    try {
      const blob = await createZip(
        downloads,
        {
          settings,
          profileId,
          totalSelected: itemsRef.current.length,
          totalResults: itemsRef.current.filter((item) => item.result).length,
          includedCount: downloads.length,
        },
        (completed, total) => {
          const progress = total > 0 ? Math.min(85, (completed / total) * 85) : 0
          setZipProgress(progress)
        },
      )
      setZipProgress(100)
      triggerDownload(blob, zipFileName())
      setAnnouncement(
        `ZIP preparado con ${plural(downloads.length, 'foto', 'fotos')} y un resumen en texto.`,
      )
    } catch {
      setZipError(
        'No se pudo crear el ZIP. Prueba a descargar las fotos una a una.',
      )
      setAnnouncement('No se pudo crear el ZIP.')
    } finally {
      setZipBusy(false)
    }
  }

  const handleCompare = (item: ImageItem) => {
    if (!item.result || item.result.useOriginal) return
    setCompareId(item.id)
  }

  const handleCloseCompare = () => {
    setCompareId(null)
  }

  let processButtonLabel = 'Añade tus fotos para empezar'
  if (isPreparing) processButtonLabel = 'Preparando fotos…'
  else if (isProcessing) processButtonLabel = 'Optimizando…'
  else if (items.length > 0 && pendingCount === 0) {
    processButtonLabel = 'Resultados al día'
  } else if (hasStaleResults) {
    processButtonLabel = `Actualizar ${plural(pendingCount, 'resultado', 'resultados')}`
  } else if (pendingCount > 0) {
    processButtonLabel = `Optimizar ${plural(pendingCount, 'foto', 'fotos')}`
  }

  const processDisabled =
    items.length === 0 ||
    pendingCount === 0 ||
    isBusy ||
    zipBusy

  const overallProgress = batchProgress
    ? Math.min(
        100,
        Math.round(
          ((batchProgress.completed + batchProgress.currentProgress / 100) /
            batchProgress.total) *
            100,
        ),
      )
    : 0

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className="site-header">
        <div className="brand" aria-label="Fotos Ligeras">
          <LogoMark />
          <span className="brand-name">
            Fotos <em>ligeras</em>
          </span>
        </div>
        <span className="header-privacy">
          <LockIcon />
          Tus fotos se quedan en tu dispositivo
        </span>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <SparkIcon />
              Compresión de fotos, sin subirlas
            </p>
            <h1 id="hero-title">
              Fotos más <em>ligeras</em>, listas para compartir.
            </h1>
            <p className="hero-lede">
              Reduce el peso de tus JPEG, PNG y WebP para enviarlas por
              WhatsApp, por correo o publicarlas en una web. Elige un perfil,
              fija un peso máximo o ajusta todo a tu medida; tus originales no
              se tocan.
            </p>
            <div className="privacy-banner">
              <span className="privacy-banner-icon" aria-hidden="true">
                <LockIcon />
              </span>
              <div>
                <strong>Tus fotos se quedan en tu dispositivo</strong>
                <p>
                  El procesamiento ocurre en tu navegador. No se envían fotos a
                  ningún servidor.
                </p>
              </div>
            </div>
          </div>

          <aside className="privacy-card" aria-label="Privacidad y control">
            <span className="privacy-card-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            <h2>Sin cuentas. Sin subidas.</h2>
            <ul className="check-list">
              <li>
                <CheckIcon />
                Procesamiento local, imagen a imagen.
              </li>
              <li>
                <CheckIcon />
                Tus archivos originales no se modifican.
              </li>
              <li>
                <CheckIcon />
                Descargas cuando tú decidas.
              </li>
            </ul>
            <p className="privacy-card-note">
              Sin analítica, sin fuentes remotas y sin guardar tus fotos en el
              navegador.
            </p>
          </aside>
        </section>

        <Stepper steps={steps} />

        <section className="step-card" aria-labelledby="add-title">
          <header className="section-heading">
            <div className="section-heading-main">
              <span className="section-number" aria-hidden="true">
                1
              </span>
              <div>
                <h2 id="add-title">Añade tus fotos</h2>
                <p>
                  Selecciona o arrastra tus imágenes. Puedes añadir hasta{' '}
                  {MAX_FILES} fotos de 25 MB como máximo.
                </p>
              </div>
            </div>
            <span className="section-aside">
              {items.length} de {MAX_FILES} fotos
            </span>
          </header>

          <FileDropzone
            onFiles={(files) => {
              void handleFiles(files)
            }}
            disabled={isBusy || zipBusy}
            limitReached={limitReached}
            isPreparing={isPreparing}
            itemCount={items.length}
          />

          <p className="formats-line">
            <ImageIcon />
            Admitimos JPEG, PNG y WebP. El límite de {MAX_FILES} fotos y 25 MB
            por archivo se aplica a este lote.
          </p>

          {prepareProgress && (
            <div className="working-banner" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>
                Leyendo {prepareProgress.done} de {prepareProgress.total} fotos…
              </span>
            </div>
          )}

          {issues.length > 0 && (
            <section className="issues" aria-labelledby="issues-title">
              <div className="issues-heading">
                <div>
                  <h3 id="issues-title">
                    <AlertIcon />
                    Algunos archivos no se añadieron
                  </h3>
                  <p>Revisa los detalles y vuelve a intentarlo si lo necesitas.</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={dismissAllIssues}
                >
                  Cerrar avisos
                </button>
              </div>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.id}>
                    <div>
                      <strong>{issue.fileName}</strong>
                      <p>{issue.message}</p>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => dismissIssue(issue.id)}
                      aria-label={`Descartar aviso de ${issue.fileName}`}
                    >
                      Descartar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {items.length > 0 && (
            <div className="selection">
              <div className="selection-heading">
                <p>
                  <strong>{items.length}</strong>{' '}
                  {items.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
                  <span className="selection-note">
                    {remainingSlots > 0
                      ? `Puedes añadir ${remainingSlots} más.`
                      : 'Has alcanzado el límite del lote.'}
                  </span>
                </p>
                <button
                  type="button"
                  className="text-button text-button--danger"
                  onClick={clearAll}
                  disabled={isBusy || zipBusy}
                >
                  Vaciar selección
                </button>
              </div>
              <ImageList
                items={items}
                onRemove={removeItem}
                disabled={isBusy || zipBusy}
              />
            </div>
          )}
        </section>

        <section className="step-card" aria-labelledby="settings-title">
          <header className="section-heading">
            <div className="section-heading-main">
              <span className="section-number" aria-hidden="true">
                2
              </span>
              <div>
                <h2 id="settings-title">Elige el tamaño</h2>
                <p>
                  Escoge un perfil, fija un peso máximo o crea el tuyo.
                  Mantendremos la proporción y no ampliaremos fotos pequeñas.
                </p>
              </div>
            </div>
            <span className="section-aside">Ajustes locales</span>
          </header>

          <ProfilePicker
            profileId={profileId}
            customSettings={customSettings}
            targetSettings={targetSettings}
            onProfileChange={handleProfileChange}
            onCustomSettingsChange={handleCustomSettingsChange}
            onTargetSettingsChange={handleTargetSettingsChange}
            disabled={isBusy || zipBusy}
          />

          {hasStaleResults && (
            <div className="notice notice--warning" role="status">
              <RefreshIcon />
              <p>
                Los resultados anteriores están pendientes de actualizar porque
                has cambiado los ajustes.
              </p>
            </div>
          )}

          <div className="optimize-bar">
            <div className="optimize-summary">
              <span className="optimize-eyebrow">Ajuste actual</span>
              <strong>{describeSettings(settings, profileId)}</strong>
              <span>
                {items.length > 0
                  ? `Se aplicará a ${plural(pendingCount > 0 ? pendingCount : items.length, 'foto', 'fotos')}.`
                  : 'Añade tus fotos para empezar.'}
              </span>
            </div>
            <div className="optimize-actions">
              <button
                type="button"
                className="button button--primary button--large optimize-button"
                onClick={() => {
                  void handleProcess()
                }}
                disabled={processDisabled}
                aria-busy={isProcessing}
              >
                {isProcessing && <span className="spinner" aria-hidden="true" />}
                {processButtonLabel}
              </button>
              {isProcessing && (
                <button
                  type="button"
                  className="button button--secondary button--large optimize-cancel"
                  onClick={handleCancel}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {isProcessing && batchProgress && (
            <div className="batch-progress" aria-label="Progreso del lote">
              <div className="batch-progress-heading">
                <div>
                  <span className="batch-progress-label">
                    Procesando{' '}
                    <strong>
                      {batchProgress.currentName
                        ? `«${batchProgress.currentName}»`
                        : 'el lote'}
                    </strong>
                  </span>
                  <span className="batch-progress-count">
                    {batchProgress.completed} de {batchProgress.total}
                  </span>
                </div>
              </div>
              <div
                className="progress-track progress-track--large"
                role="progressbar"
                aria-label="Progreso total del lote"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallProgress}
                aria-valuetext={`${overallProgress} % del lote procesado`}
              >
                <span
                  className="progress-fill"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <p className="batch-progress-note">
                {overallProgress} % · Se procesan de una en una para cuidar la
                memoria. Cancelar detiene el proceso y mantiene lo ya terminado.
              </p>
            </div>
          )}

          {notice && (
            <div className={`notice notice--${notice.tone}`}>
              {toneIcon(notice.tone)}
              <p>{notice.text}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => setNotice(null)}
              >
                Cerrar
              </button>
            </div>
          )}

          <div className="info-notes" aria-label="Información importante">
            <div className="info-note">
              <ShieldIcon />
              <div>
                <h3>Privacidad</h3>
                <p>
                  No guardamos tus fotos en el navegador ni las enviamos fuera.
                  Cierra la pestaña y no quedará ninguna copia.
                </p>
              </div>
            </div>
            <div className="info-note">
              <InfoIcon />
              <div>
                <h3>Metadatos EXIF</h3>
                <p>
                  No copiamos los metadatos EXIF al archivo generado. Eso no
                  garantiza el anonimato: el contenido de la foto puede seguir
                  siendo identificable.
                </p>
              </div>
            </div>
            <div className="info-note">
              <ImageIcon />
              <div>
                <h3>Calidad y transparencia</h3>
                <p>
                  La compresión puede producir pérdida visual. Si una foto con
                  transparencia se guarda como JPEG, se rellena con fondo blanco
                  y te lo avisamos en el resultado.
                </p>
              </div>
            </div>
          </div>
        </section>

        {hasResults && (
          <section className="step-card step-card--download" aria-labelledby="download-title">
            <header className="section-heading">
              <div className="section-heading-main">
                <span className="section-number" aria-hidden="true">
                  3
                </span>
                <div>
                  <h2 id="download-title">Descarga</h2>
                  <p>
                    Compara antes y después, conserva el original si te
                    conviene y descarga cada foto o todo el lote.
                  </p>
                </div>
              </div>
              <span className="section-aside">En tu dispositivo</span>
            </header>

            <ResultsPanel
              items={items}
              downloadsById={downloadsById}
              settingsKey={currentSettingsKey}
              isProcessing={isProcessing}
              zipBusy={zipBusy}
              zipProgress={zipProgress}
              zipError={zipError}
              onCompare={handleCompare}
              onToggleOriginal={handleToggleOriginal}
              onDownload={handleDownload}
              onDownloadZip={() => {
                void handleDownloadZip()
              }}
              onDismissZipError={() => setZipError(null)}
            />
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-privacy">
          <LockIcon />
          <span>
            Hecho para compartir mejor: sin servidores, sin cuentas y sin
            analítica.
          </span>
        </div>
        <div className="footer-meta">
          <span>Fotos Ligeras</span>
          <span aria-hidden="true">·</span>
          <span>Los originales nunca se modifican</span>
        </div>
      </footer>

      {compareItem?.result && !compareItem.result.useOriginal && (
        <CompareDialog
          item={compareItem}
          stale={compareStale}
          onClose={handleCloseCompare}
        />
      )}

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  )
}

export default App
