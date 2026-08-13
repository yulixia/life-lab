import { ChevronRight } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { SubpageHeader } from '../../components/SubpageHeader'
import { useLifeLab } from '../../app/LifeLabContext'
import { trackLabels } from '../library/libraryLabels'
import { ExperimentPeriod } from './ExperimentPeriod'
import styles from './ExperimentDetailPage.module.css'

export function ExperimentDetailPage() {
  const { cycleId } = useParams()
  const { state } = useLifeLab()

  if (!state || !cycleId) {
    return null
  }

  const cycle = state.cycles.find((candidate) => candidate.id === cycleId)
  const item = cycle ? state.items.find((candidate) => candidate.id === cycle.itemId) : null

  if (!cycle || !item) {
    return <Navigate to="/today" replace />
  }

  return (
    <>
      <SubpageHeader backTo="/today" context={trackLabels[item.track]} title="实践详情" />
      <Card className={styles.detailCard}>
        <Link className={styles.itemLink} to={`/items/${item.id}`}>
          <span>
            <small>所属事项</small>
            <strong>{item.title}</strong>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>

        <ExperimentPeriod endDate={cycle.endDate} startDate={cycle.startDate} />

        <div className={styles.settings}>
          <SettingSection label="本轮唯一验证问题" number="01" value={cycle.question} />
          <SettingSection label="每天／本周具体做什么" number="02" value={cycle.actionPlan} />
          <SettingSection label="判断有效实践日的最低标准" number="03" value={cycle.minimumStandard} />
          <section className={`${styles.settingSection} ${styles.moreSection}`}>
            <h2 className={styles.settingHeading}>
              <span>04</span>
              <span>更多设定</span>
            </h2>
            <dl className={styles.moreList}>
              <SettingDetail label="适合时希望看到什么" value={cycle.positiveSignals} />
              <SettingDetail label="不适合时可能出现什么" value={cycle.negativeSignals} />
              <SettingDetail label="理想行动标准" value={cycle.idealStandard} />
            </dl>
          </section>
        </div>
      </Card>
    </>
  )
}

function SettingSection({ label, number, value }: { label: string; number: string; value: string }) {
  return (
    <section className={styles.settingSection}>
      <h2 className={styles.settingHeading}>
        <span>{number}</span>
        <span>{label}</span>
      </h2>
      <p className={styles.settingValue}>{value}</p>
    </section>
  )
}

function SettingDetail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={value ? '' : styles.emptyValue}>{value || '未设置'}</dd>
    </div>
  )
}
