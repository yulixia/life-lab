import { Activity, BookOpen, CalendarDays, Database } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './BottomNav.module.css'

const navItems = [
  { to: '/today', label: '今日', Icon: CalendarDays, section: 'today' },
  { to: '/energy', label: '情绪', Icon: Activity, section: 'energy' },
  { to: '/library', label: '总库', Icon: BookOpen, section: 'library' },
  { to: '/settings', label: '数据', Icon: Database, section: 'settings' },
]

export function BottomNav() {
  const location = useLocation()
  const shouldShow = navItems.some((item) => item.to === location.pathname)

  if (!shouldShow) {
    return null
  }

  return (
    <nav className={styles.nav} aria-label="主要导航">
      {navItems.map(({ Icon, ...item }) => (
        <NavLink
          key={item.to}
          to={item.to}
          data-section={item.section}
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        >
          <Icon aria-hidden="true" className={styles.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
