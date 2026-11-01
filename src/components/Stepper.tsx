import { CheckIcon } from './Icons'

export type StepState = 'active' | 'done' | 'upcoming'

interface StepperProps {
  steps: Array<{ id: string; label: string; state: StepState }>
}

export function Stepper({ steps }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Pasos para optimizar tus fotos">
      <ol>
        {steps.map((step, index) => (
          <li
            className={`stepper-item stepper-item--${step.state}`}
            key={step.id}
            aria-current={step.state === 'active' ? 'step' : undefined}
          >
            <span className="stepper-number" aria-hidden="true">
              {step.state === 'done' ? <CheckIcon /> : index + 1}
            </span>
            <span className="stepper-label">
              {step.label}
              <span className="visually-hidden">
                {step.state === 'done'
                  ? ': completado'
                  : step.state === 'active'
                    ? ': paso actual'
                    : ': pendiente'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
