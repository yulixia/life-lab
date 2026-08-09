import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

type ConfirmDialogProps = {
  children: ReactNode
  cancelLabel?: string
  confirmLabel: string
  isOpen: boolean
  onCancel?: () => void
  onConfirm: () => void
  title: string
}

export function ConfirmDialog({
  cancelLabel = '取消',
  children,
  confirmLabel,
  isOpen,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !onCancel) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div aria-labelledby="local-notice-title" aria-modal="true" className={styles.dialog} role="dialog">
        <h2 id="local-notice-title">{title}</h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>
          {onCancel ? (
            <Button onClick={onCancel} variant="secondary">
              {cancelLabel}
            </Button>
          ) : null}
          <Button ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
