import { Activity, BookOpen, CalendarDays, Settings } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './BottomNav.module.css'

const navItems = [
  { to: '/today', label: '今日', Icon: CalendarDays },
  { to: '/energy', label: '情绪', Icon: Activity },
  { to: '/library', label: '总库', Icon: BookOpen },
  { to: '/settings', label: '设置', Icon: Settings },
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
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        >
          <Icon aria-hidden="true" size={24} strokeWidth={2} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
