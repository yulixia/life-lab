import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Card } from '../../components/Card'
import { SegmentedControl } from '../../components/SegmentedControl'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectRecentEnergy, selectTopFeelingTags } from '../../domain/selectors'
import type { EnergyCategory, EnergyEntry } from '../../domain/types'
import styles from './EnergyPage.module.css'

type ColumnMode = EnergyCategory

export function EnergyPage() {
  const { state } = useLifeLab()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('type') === 'drain' ? 'drain' : 'energy'
  const [columnMode, setColumnMode] = useState<ColumnMode>(initialMode)

  const energyEntries = useMemo(() => (state ? selectRecentEnergy(state, 'energy', 1000) : []), [state])
  const drainEntries = useMemo(() => (state ? selectRecentEnergy(state, 'drain', 1000) : []), [state])
  const topEnergyTags = useMemo(() => (state ? selectTopFeelingTags(state, 'energy') : []), [state])
  const topDrainTags = useMemo(() => (state ? selectTopFeelingTags(state, 'drain') : []), [state])

  if (!state) {
    return null
  }

  return (
    <>
      <AppHeader
        action={
          <Link className={styles.headerAction} to="/energy/new">
            记录情绪
          </Link>
        }
        title="情绪"
        eyebrow="观察列表"
      />
      <div className={styles.listPage}>
        <div className={styles.fixedContent}>
          <div className={styles.summary}>
            <Card className={styles.summaryCard}>
              <h2>有能量</h2>
              <strong>{energyEntries.length}</strong>
              <TagSummary tags={topEnergyTags} />
            </Card>
            <Card className={styles.summaryCard}>
              <h2>被消耗</h2>
              <strong>{drainEntries.length}</strong>
              <TagSummary tags={topDrainTags} />
            </Card>
          </div>

          <SegmentedControl
            label="手机列表"
            onChange={setColumnMode}
            options={[
              { label: '有能量', value: 'energy' },
              { label: '被消耗', value: 'drain' },
            ]}
            value={columnMode}
          />
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.columns}>
            <EnergyColumn
              entries={energyEntries}
              isVisibleOnMobile={columnMode === 'energy'}
              title="有能量"
            />
            <EnergyColumn
              entries={drainEntries}
              isVisibleOnMobile={columnMode === 'drain'}
              title="被消耗"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function TagSummary({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <span className={styles.tag}>暂无标签</span>
  }
  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <span className={styles.tag} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function EnergyColumn({
  entries,
  isVisibleOnMobile,
  title,
}: {
  entries: EnergyEntry[]
  isVisibleOnMobile: boolean
  title: string
}) {
  return (
    <section className={`${styles.column} ${isVisibleOnMobile ? '' : styles.hideMobile}`}>
      <h2>{title}</h2>
      {entries.length ? (
        entries.map((entry) => <EnergySummary entry={entry} key={entry.id} />)
      ) : (
        <Card className={styles.entry}>
          <p>暂无记录。</p>
        </Card>
      )}
    </section>
  )
}

function EnergySummary({ entry }: { entry: EnergyEntry }) {
  const summary = entry.scene || entry.reason || entry.reflection || '没有补充说明。'
  return (
    <Link className={styles.entryLink} to={`/energy/${entry.id}`}>
      <Card className={styles.entry}>
        <div className={styles.entryHeader}>
          <h3>{entry.event}</h3>
          <span className={styles.tag}>{entry.energyDelta > 0 ? `+${entry.energyDelta}` : entry.energyDelta}</span>
        </div>
        <p>{new Date(entry.occurredAt).toLocaleString()}</p>
        <p className={styles.summaryText}>{summary}</p>
        <div className={styles.tagList}>
          {entry.feelingTags.slice(0, 4).map((tag) => (
            <span className={styles.tag} key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </Card>
    </Link>
  )
}
