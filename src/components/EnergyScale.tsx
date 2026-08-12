import type { EnergyDelta } from '../domain/types'
import styles from './EnergyScale.module.css'

type EnergyScaleProps = {
  label: string
  name: string
  onChange: (value: EnergyDelta) => void
  value: EnergyDelta
}

const neutralValues: EnergyDelta[] = [-2, -1, 0, 1, 2]
const labels: Record<EnergyDelta, string> = {
  '-2': '明显消耗',
  '-1': '有些消耗',
  0: '无变化',
  1: '有些补充',
  2: '明显补充',
}

const compactLabels: Record<EnergyDelta, string> = {
  '-2': '强消耗',
  '-1': '轻消耗',
  0: '无变化',
  1: '轻补充',
  2: '强补充',
}

export function EnergyScale({ label, name, onChange, value }: EnergyScaleProps) {
  return (
    <fieldset className={styles.scale}>
      <legend>{label}</legend>
      <div className={styles.options}>
        {neutralValues.map((option) => (
          <label
            data-intensity={Math.abs(option)}
            data-tone={option > 0 ? 'energy' : option < 0 ? 'drain' : 'neutral'}
            key={option}
            className={option === value ? styles.selected : undefined}
          >
            <input
              checked={option === value}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span>{option > 0 ? `+${option}` : option}</span>
            <small>
              <span className={styles.longLabel}>{labels[option]}</span>
              <span className={styles.compactLabel}>{compactLabels[option]}</span>
            </small>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
