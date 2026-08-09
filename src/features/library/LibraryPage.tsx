import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Card } from '../../components/Card'
import { SegmentedControl } from '../../components/SegmentedControl'
import { SelectField } from '../../components/SelectField'
import {
  selectCycleDay,
  selectLibraryItems,
  selectOpenCycleForItem,
  type LibraryStatusFilter,
  type LibraryTrackFilter,
} from '../../domain/selectors'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import type { ExperimentCycle, LifeItem } from '../../domain/types'
import { statusLabels } from './libraryLabels'
import styles from './LibraryPage.module.css'

const statusClassNames: Record<LifeItem['status'], string> = {
  active: styles.activeItem,
  archived: styles.archivedItem,
  exploring: styles.exploringItem,
  long_term: styles.longTermItem,
  review_due: styles.reviewDueItem,
}

export function LibraryPage() {
  const { state } = useLifeLab()
  const [trackFilter, setTrackFilter] = useState<LibraryTrackFilter>('all')
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>('all')
  const today = todayLocalDate()
  const items = useMemo(
    () => (state ? selectLibraryItems(state, trackFilter, statusFilter) : []),
    [state, statusFilter, trackFilter],
  )

  return (
    <>
      <AppHeader
        action={
          <Link className={styles.linkButton} to="/items/new">
            新建事项
          </Link>
        }
        title="总库"
        eyebrow="理想自我 / 副业探索"
      />
      <div className={styles.listPage}>
        <div className={styles.toolbar}>
          <SegmentedControl
            label="方向筛选"
            onChange={setTrackFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '理想自我', value: 'ideal_self' },
              { label: '副业探索', value: 'side_hustle' },
            ]}
            value={trackFilter}
          />
          <SelectField
            label="状态筛选"
            onChange={(event) => setStatusFilter(event.target.value as LibraryStatusFilter)}
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className={styles.scrollArea}>
          {items.length ? (
            <div className={styles.list}>
              {items.map((item) => (
                <LibraryItemCard
                  cycle={state ? selectOpenCycleForItem(state, item.id) : null}
                  item={item}
                  key={item.id}
                  today={today}
                />
              ))}
            </div>
          ) : (
            <Card className={styles.empty}>
              <p>当前没有事项。可以先放入一个想探索的问题，暂时不需要开始实践。</p>
              <div className={styles.actions}>
                <Link className={styles.linkButton} to="/items/new">
                  新建事项
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function LibraryItemCard({
  cycle,
  item,
  today,
}: {
  cycle: ExperimentCycle | null
  item: LifeItem
  today: string
}) {
  const progress = getCycleProgress(cycle, today)
  const shouldShowProgress = Boolean(cycle && cycle.status !== 'scheduled')
  const candidateText = item.status === 'archived' ? '已归档' : item.status === 'long_term' ? '长期进行' : '可开启 7 天实践'

  return (
    <Link className={styles.item} to={`/items/${item.id}`}>
      <Card className={`${styles.itemCard} ${statusClassNames[item.status]}`}>
        <div className={styles.itemTop}>
          <h2>{item.title}</h2>
          <span className={shouldShowProgress ? styles.ratio : styles.candidateBadge}>
            {shouldShowProgress ? progress.ratio : candidateText}
          </span>
        </div>
        <p>{item.latestConclusion || item.question || item.why || '还没有记录最近结论。'}</p>
        {shouldShowProgress ? (
          <>
            <div className={styles.progressTrack} aria-label={progress.label}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <div className={styles.dueRow}>
              <span>{progress.label}</span>
              <span>{progress.dueText}</span>
            </div>
          </>
        ) : (
          <div className={styles.candidateRow}>
            <span>{item.track === 'ideal_self' ? '理想自我候选' : '副业探索候选'}</span>
            <span>点开后可开始</span>
          </div>
        )}
      </Card>
    </Link>
  )
}

function getCycleProgress(cycle: ExperimentCycle | null, today: string) {
  if (!cycle) {
    return {
      dueText: '',
      label: '探索中',
      percent: 0,
      ratio: '',
    }
  }

  const day = selectCycleDay(cycle, today)
  const dayNumber = day === 'scheduled' ? 0 : day === 'review_due' ? 7 : day

  return {
    dueText: `到期 ${formatShortDate(cycle.endDate)}`,
    label: cycle.status === 'review_due' ? '待复盘' : cycle.status === 'scheduled' ? '未开始' : '当前周期',
    percent: Math.min(100, Math.max(0, (dayNumber / 7) * 100)),
    ratio: cycle.status === 'review_due' ? '待复盘' : dayNumber ? `第 ${dayNumber} 天` : '未开始',
  }
}

function formatShortDate(localDate: string) {
  const [, month, day] = localDate.split('-')
  return `${Number(month)}月${Number(day)}日`
}
