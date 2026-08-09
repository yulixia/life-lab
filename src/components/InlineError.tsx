import type { ReactNode } from 'react'
import styles from './InlineError.module.css'

type InlineErrorProps = {
  children: ReactNode
  id?: string
}

export function InlineError({ children, id }: InlineErrorProps) {
  return (
    <p className={styles.error} id={id} role="alert">
      {children}
    </p>
  )
}
