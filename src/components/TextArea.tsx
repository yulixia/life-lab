import type { TextareaHTMLAttributes } from 'react'
import { InlineError } from './InlineError'
import styles from './TextField.module.css'

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string
  fieldClassName?: string
  hint?: string
  label: string
  prefix?: string
}

export function TextArea({ error, fieldClassName, hint, id, label, prefix, ...props }: TextAreaProps) {
  const inputId = id ?? props.name ?? label
  const errorId = error ? `${inputId}-error` : undefined
  const className = [styles.field, fieldClassName].filter(Boolean).join(' ')
  return (
    <label className={className} htmlFor={inputId}>
      <span className={styles.labelRow}>
        <span className={styles.labelMain}>
          {prefix ? <span className={styles.labelPrefix}>{prefix}</span> : null}
          <span>{label}</span>
        </span>
        <small>{props.required ? '必填' : '选填'}</small>
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      <textarea aria-describedby={errorId} aria-invalid={Boolean(error)} aria-label={props['aria-label'] ?? label} id={inputId} {...props} />
      {error ? <InlineError id={errorId}>{error}</InlineError> : null}
    </label>
  )
}
