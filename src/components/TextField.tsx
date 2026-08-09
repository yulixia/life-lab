import type { InputHTMLAttributes } from 'react'
import { InlineError } from './InlineError'
import styles from './TextField.module.css'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  label: string
}

export function TextField({ error, id, label, ...props }: TextFieldProps) {
  const inputId = id ?? props.name ?? label
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.labelRow}>
        <span>{label}</span>
        <small>{props.required ? '必填' : '选填'}</small>
      </span>
      <input aria-describedby={errorId} aria-invalid={Boolean(error)} id={inputId} {...props} />
      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </label>
  )
}
