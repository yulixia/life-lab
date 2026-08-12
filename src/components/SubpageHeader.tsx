import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'

type SubpageHeaderProps = {
  backLabel?: string
  backTo: string
  context?: ReactNode
  title: string
}

export function SubpageHeader({ backLabel, backTo, context, title }: SubpageHeaderProps) {
  return <AppHeader backLabel={backLabel} backTo={backTo} meta={context} title={title} />
}
