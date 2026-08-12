import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AppHeader.module.css'

type AppHeaderProps = {
  title: string
  action?: ReactNode
  meta?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}

export function AppHeader({ title, action, meta, backLabel = '返回', backTo, className }: AppHeaderProps) {
  const headerClassName = [styles.header, backTo ? styles.subpage : '', className].filter(Boolean).join(' ')

  return (
    <header className={headerClassName}>
      <div className={styles.titleGroup}>
        {backTo ? (
          <Link aria-label={backLabel} className={styles.backLink} to={backTo}>
            <ArrowLeft aria-hidden="true" className={styles.backIcon} strokeWidth={2.4} />
          </Link>
        ) : null}
        <h1>{title}</h1>
      </div>
      {action || meta ? (
        <div className={styles.side}>
          {action ? <div className={styles.action}>{action}</div> : null}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </div>
      ) : null}
    </header>
  )
}
