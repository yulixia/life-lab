import type { TextareaHTMLAttributes } from 'react'
import { InlineError } from './InlineError'
import styles from './TextField.module.css'

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string
  label: string
}

export function TextArea({ error, id, label, ...props }: TextAreaProps) {
  const inputId = id ?? props.name ?? label
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.labelRow}>
        <span>{label}</span>
        <small>{props.required ? '必填' : '选填'}</small>
      </span>
      <textarea aria-describedby={errorId} aria-invalid={Boolean(error)} id={inputId} {...props} />
      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </label>
  )
}
