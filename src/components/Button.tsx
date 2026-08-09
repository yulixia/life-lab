import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  isLoading?: boolean
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    icon,
    isLoading = false,
    type = 'button',
    variant = 'primary',
    ...props
  },
  ref,
) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return (
    <button className={classes} disabled={disabled || isLoading} ref={ref} type={type} {...props}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{isLoading ? '处理中' : children}</span>
    </button>
  )
})
