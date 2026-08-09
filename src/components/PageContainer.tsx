import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './PageContainer.module.css'

type PageContainerProps = {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  const location = useLocation()
  const containerRef = useRef<HTMLElement>(null)
  const usesContainedScroll = location.pathname === '/energy' || location.pathname === '/library'

  useLayoutEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0 })
  }, [location.pathname])

  return (
    <main
      className={usesContainedScroll ? `${styles.container} ${styles.containedScroll}` : styles.container}
      ref={containerRef}
    >
      {children}
    </main>
  )
}
