import styles from './SegmentedControl.module.css'

type SegmentedOption<T extends string> = {
  label: string
  value: T
}

type SegmentedControlProps<T extends string> = {
  label: string
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  value: T
}

export function SegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className={styles.control}>
      <legend>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
