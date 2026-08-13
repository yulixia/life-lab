import type { LocalDate } from '../../domain/types'
import styles from './ExperimentPeriod.module.css'

type ExperimentPeriodProps = {
  endDate: LocalDate
  startDate: LocalDate
}

export function ExperimentPeriod({ endDate, startDate }: ExperimentPeriodProps) {
  return (
    <div aria-label={`实践周期：${startDate} 至 ${endDate}，共 7 天`} className={styles.panel}>
      <div className={styles.header}>
        <span>实践周期</span>
        <span>共 7 天</span>
      </div>
      <div className={styles.dates}>
        <div>
          <strong>{formatCycleDate(startDate)}</strong>
          <span>开始</span>
        </div>
        <div aria-hidden="true" className={styles.arrow}>
          <span />
        </div>
        <div className={styles.end}>
          <strong>{formatCycleDate(endDate)}</strong>
          <span>结束</span>
        </div>
      </div>
    </div>
  )
}

function formatCycleDate(date: string) {
  return date.replaceAll('-', '.')
}
