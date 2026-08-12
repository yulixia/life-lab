import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AppHeader.module.css'

type AppHeaderProps = {
  title: string
  action?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}

export function AppHeader({ title, action, backLabel = '返回', backTo, className }: AppHeaderProps) {
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
      {action ? (
        <div className={styles.side}>
          <div className={styles.action}>{action}</div>
        </div>
      ) : null}
    </header>
  )
}
