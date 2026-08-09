import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AppHeader.module.css'

type AppHeaderProps = {
  title: string
  eyebrow?: string
  action?: ReactNode
  backTo?: string
  backLabel?: string
}

export function AppHeader({ title, action, backLabel = '返回', backTo, eyebrow }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        {backTo ? (
          <Link aria-label={backLabel} className={styles.backLink} to={backTo}>
            <ArrowLeft aria-hidden="true" size={22} strokeWidth={2.4} />
          </Link>
        ) : null}
        <div className={styles.headingText}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1>{title}</h1>
        </div>
      </div>
      {action ? (
        <div className={styles.side}>
          <div className={styles.action}>{action}</div>
        </div>
      ) : null}
    </header>
  )
}
