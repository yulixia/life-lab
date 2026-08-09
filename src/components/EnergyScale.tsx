import type { EnergyDelta } from '../domain/types'
import styles from './EnergyScale.module.css'

type EnergyScaleProps = {
  label: string
  name: string
  onChange: (value: EnergyDelta) => void
  value: EnergyDelta
}

const values: EnergyDelta[] = [-2, -1, 0, 1, 2]

export function EnergyScale({ label, name, onChange, value }: EnergyScaleProps) {
  return (
    <fieldset className={styles.scale}>
      <legend>{label}</legend>
      <div className={styles.options}>
        {values.map((option) => (
          <label key={option} className={option === value ? styles.selected : undefined}>
            <input
              checked={option === value}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span>{option > 0 ? `+${option}` : option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
