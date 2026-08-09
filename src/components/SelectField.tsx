import type { SelectHTMLAttributes } from 'react'
import { InlineError } from './InlineError'
import styles from './TextField.module.css'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string
  label: string
}

export function SelectField({ children, error, id, label, ...props }: SelectFieldProps) {
  const inputId = id ?? props.name ?? label
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.labelRow}>
        <span>{label}</span>
        <small>{props.required ? '必填' : '选填'}</small>
      </span>
      <select aria-describedby={errorId} aria-invalid={Boolean(error)} id={inputId} {...props}>
        {children}
      </select>
      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </label>
  )
}
