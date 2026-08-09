import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  )
}
