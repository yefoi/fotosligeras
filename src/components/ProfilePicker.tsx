import { useState } from 'react'
import { formatBytes } from '../lib/format'
import {
  DEFAULT_TARGET_BYTES,
  MAX_MAX_SIDE,
  MAX_QUALITY,
  MAX_TARGET_KB,
  MIN_MAX_SIDE,
  MIN_QUALITY,
  MIN_TARGET_KB,
  PROFILE_OPTIONS,
  TARGET_MAX_SIDE,
  qualityApplies,
} from '../lib/profiles'
import type { AppSettings, OutputFormat, ProfileId } from '../types'
import { CheckIcon, InfoIcon } from './Icons'

interface ProfilePickerProps {
  profileId: ProfileId
  customSettings: AppSettings
  targetSettings: AppSettings
  onProfileChange: (profileId: ProfileId) => void
  onCustomSettingsChange: (settings: AppSettings) => void
  onTargetSettingsChange: (settings: AppSettings) => void
  disabled: boolean
}

const TARGET_PRESETS_KB = [100, 200, 500, 1024, 2048]

interface TargetSettingsProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function TargetSettings({ settings, onChange }: TargetSettingsProps) {
  const appliedKb = Math.min(
    MAX_TARGET_KB,
    Math.max(
      MIN_TARGET_KB,
      Math.round((settings.targetBytes ?? DEFAULT_TARGET_BYTES) / 1024),
    ),
  )
  const [draft, setDraft] = useState(String(appliedKb))

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setDraft(String(appliedKb))
      return
    }

    const nextKb = Math.min(
      MAX_TARGET_KB,
      Math.max(MIN_TARGET_KB, Math.round(parsed)),
    )
    setDraft(String(nextKb))
    if (nextKb !== appliedKb) {
      onChange({ ...settings, targetBytes: nextKb * 1024 })
    }
  }

  function applyPreset(kb: number) {
    setDraft(String(kb))
    onChange({ ...settings, targetBytes: kb * 1024 })
  }

  function updateTarget(patch: Partial<AppSettings>) {
    onChange({ ...settings, ...patch })
  }

  return (
    <div className="custom-settings target-settings">
      <div className="custom-settings-heading">
        <h3>Fija un peso máximo</h3>
        <span className="pill pill--soft">Calidad automática</span>
      </div>

      <div className="target-grid">
        <div className="field">
          <label htmlFor="target-format">Formato de salida</label>
          <select
            id="target-format"
            value={settings.format === 'image/webp' ? 'image/webp' : 'image/jpeg'}
            onChange={(event) =>
              updateTarget({
                format: event.target.value as OutputFormat,
              })
            }
          >
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
          </select>
          <p className="field-hint">
            JPEG es más compatible; WebP suele pesar menos.
          </p>
        </div>

        <div className="field target-size-field">
          <div className="field-heading">
            <label htmlFor="target-size">Peso máximo por foto</label>
            <output htmlFor="target-size">
              {formatBytes(appliedKb * 1024)}
            </output>
          </div>

          <div className="target-input-row">
            <div className="target-input-wrap">
              <input
                id="target-size"
                type="number"
                min={MIN_TARGET_KB}
                max={MAX_TARGET_KB}
                step={10}
                inputMode="numeric"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitDraft()
                  }
                }}
                aria-describedby="target-size-help"
              />
              <span aria-hidden="true">KB</span>
            </div>

            <div
              className="preset-list"
              role="group"
              aria-label="Objetivos de peso habituales"
            >
              {TARGET_PRESETS_KB.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-chip${appliedKb === preset ? ' preset-chip--active' : ''}`}
                  onClick={() => applyPreset(preset)}
                  aria-pressed={appliedKb === preset}
                >
                  {formatBytes(preset * 1024)}
                </button>
              ))}
            </div>
          </div>

          <p className="field-hint" id="target-size-help">
            Ajustamos la calidad automáticamente y reducimos la resolución solo
            si hace falta, hasta {TARGET_MAX_SIDE} px de partida y un mínimo de
            320 px. Si el original ya cumple el objetivo y tiene el formato
            elegido, se conserva sin recomprimir. El PNG no está disponible en
            este modo.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ProfilePicker({
  profileId,
  customSettings,
  targetSettings,
  onProfileChange,
  onCustomSettingsChange,
  onTargetSettingsChange,
  disabled,
}: ProfilePickerProps) {
  const qualityEnabled = qualityApplies(customSettings.format)

  function updateCustomSettings(patch: Partial<AppSettings>) {
    onCustomSettingsChange({ ...customSettings, ...patch })
  }

  return (
    <fieldset className="settings-fieldset" disabled={disabled}>
      <legend className="visually-hidden">Perfil de compresión</legend>

      <div className="profile-grid">
        {PROFILE_OPTIONS.map((profile) => {
          const selected = profileId === profile.id
          return (
            <label
              key={profile.id}
              className={`profile-option${selected ? ' profile-option--selected' : ''}${profile.id === 'target' ? ' profile-option--wide' : ''}`}
            >
              <input
                className="profile-input visually-hidden"
                type="radio"
                name="compression-profile"
                value={profile.id}
                checked={selected}
                onChange={() => onProfileChange(profile.id)}
              />
              <span className="profile-radio" aria-hidden="true" />
              <span className="profile-content">
                <span className="profile-name">{profile.name}</span>
                <span className="profile-detail">{profile.detail}</span>
                <span className="profile-description">
                  {profile.description}
                </span>
              </span>
              {selected && (
                <span className="profile-check" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </label>
          )
        })}
      </div>

      {profileId === 'target' && (
        <TargetSettings
          settings={targetSettings}
          onChange={onTargetSettingsChange}
        />
      )}

      {profileId === 'custom' && (
        <div className="custom-settings">
          <div className="custom-settings-heading">
            <h3>Ajusta a tu medida</h3>
            <span className="pill pill--soft">Se aplica solo a este lote</span>
          </div>

          <div className="custom-grid">
            <div className="field">
              <label htmlFor="custom-format">Formato de salida</label>
              <select
                id="custom-format"
                value={customSettings.format}
                onChange={(event) =>
                  updateCustomSettings({
                    format: event.target.value as OutputFormat,
                  })
                }
              >
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
                <option value="image/png">PNG</option>
              </select>
            </div>

            <div className="field">
              <div className="field-heading">
                <label htmlFor="custom-size">Lado máximo</label>
                <output htmlFor="custom-size">
                  {customSettings.maxSide} px
                </output>
              </div>
              <input
                id="custom-size"
                type="range"
                min={MIN_MAX_SIDE}
                max={MAX_MAX_SIDE}
                step={50}
                value={customSettings.maxSide}
                onChange={(event) =>
                  updateCustomSettings({
                    maxSide: Number(event.target.value),
                  })
                }
                aria-valuetext={`${customSettings.maxSide} píxeles en el lado más largo`}
              />
              <p className="field-hint">
                Se aplica al lado más largo. Nunca ampliamos fotos pequeñas.
              </p>
            </div>

            <div className="field">
              <div className="field-heading">
                <label htmlFor="custom-quality">Calidad</label>
                <output htmlFor="custom-quality">
                  {Math.round(customSettings.quality * 100)} %
                </output>
              </div>
              <input
                id="custom-quality"
                type="range"
                min={MIN_QUALITY}
                max={MAX_QUALITY}
                step={1}
                value={Math.round(customSettings.quality * 100)}
                onChange={(event) =>
                  updateCustomSettings({
                    quality: Number(event.target.value) / 100,
                  })
                }
                disabled={!qualityEnabled}
                aria-describedby="quality-help"
                aria-valuetext={`${Math.round(customSettings.quality * 100)} por ciento de calidad`}
              />
              <p className="field-hint" id="quality-help">
                {qualityEnabled
                  ? 'Más calidad, más peso. Puede haber pérdida visual.'
                  : 'El PNG no usa control de calidad: se guarda con sus píxeles.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="settings-note">
        <InfoIcon />
        <p>
          El control de calidad se aplica a JPEG y WebP, no a PNG. La compresión
          puede producir pérdida visual, así que revisa la comparación antes de
          descargar.
        </p>
      </div>

      <p className="profile-footnote">
        Los perfiles son ajustes de Fotos Ligeras, no límites oficiales de
        WhatsApp, el correo ni ninguna web.
      </p>
    </fieldset>
  )
}
