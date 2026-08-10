import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Card } from '../../components/Card'
import { SegmentedControl } from '../../components/SegmentedControl'
import {
  isCyclePendingReview,
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
  completed: styles.completedItem,
  exploring: styles.exploringItem,
  long_term: styles.longTermItem,
  long_term_terminated: styles.longTermTerminatedItem,
  terminated: styles.terminatedItem,
  concluded: styles.concludedItem,
}

const statusFilterOptions = [
  { label: '待探索', value: 'exploring' },
  { label: '进行中', value: 'active' },
  { label: '已终止', value: 'terminated' },
  { label: '已完成', value: 'completed' },
  { label: '已完结', value: 'concluded' },
  { label: '已归档', value: 'archived' },
  { label: '长期', value: 'long_term' },
] satisfies Array<{ label: string; value: LibraryStatusFilter }>

export function LibraryPage() {
  const { state } = useLifeLab()
  const [trackFilter, setTrackFilter] = useState<LibraryTrackFilter>('all')
  const [statusFilters, setStatusFilters] = useState<LibraryStatusFilter[]>(['exploring','active'])
  const [statusFiltersExpanded, setStatusFiltersExpanded] = useState(false)
  const today = todayLocalDate()
  const items = useMemo(
    () => (state ? selectLibraryItems(state, trackFilter, statusFilters) : []),
    [state, statusFilters, trackFilter],
  )
  const trackCounts = useMemo(
    () => ({
      all: state ? selectLibraryItems(state, 'all', statusFilters).length : 0,
      ideal_self: state ? selectLibraryItems(state, 'ideal_self', statusFilters).length : 0,
      side_hustle: state ? selectLibraryItems(state, 'side_hustle', statusFilters).length : 0,
    }),
    [state, statusFilters],
  )

  return (
    <>
      <AppHeader
        action={
          <Link className={styles.linkButton} to="/items/new">
            <Plus aria-hidden="true" size={16} strokeWidth={2.8} />
            新建事项
          </Link>
        }
        title="总库"
        eyebrow="理想自我 / 副业探索"
      />
      <div className={styles.listPage}>
        <div className={styles.toolbar}>
          <SegmentedControl
            label=""
            onChange={setTrackFilter}
            options={[
              { count: trackCounts.all, label: '全部', value: 'all' },
              { count: trackCounts.ideal_self, label: '理想自我', value: 'ideal_self' },
              { count: trackCounts.side_hustle, label: '副业探索', value: 'side_hustle' },
            ]}
            value={trackFilter}
          />
          <fieldset aria-label="状态筛选" className={styles.statusFilters}>
            <div className={styles.statusFiltersHeading}>
              <span>状态筛选</span>
              <button
                aria-expanded={statusFiltersExpanded}
                aria-label={statusFiltersExpanded ? '收起状态筛选' : '展开状态筛选'}
                className={`${styles.statusFiltersToggle} ${statusFiltersExpanded ? styles.statusFiltersToggleExpanded : ''}`}
                onClick={() => setStatusFiltersExpanded((expanded) => !expanded)}
                title={statusFiltersExpanded ? '收起状态筛选' : '展开状态筛选'}
                type="button"
              >
                <ChevronDown aria-hidden="true" size={18} strokeWidth={2.6} />
              </button>
            </div>
            {statusFiltersExpanded ? (
              <div className={styles.statusFiltersOptions}>
                {statusFilterOptions.map(({ value, label }) => (
                  <label key={value}>
                    <input
                      checked={statusFilters.includes(value)}
                      onChange={() => setStatusFilters((current) => current.includes(value) ? current.filter((status) => status !== value) : [...current, value])}
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
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
                {/* <Link className={styles.linkButton} to="/items/new">
                  新建事项
                </Link> */}
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
  const candidateText = item.status === 'exploring' ? '可开启 7 天实践' : statusLabels[item.status]
  const candidateRow = getCandidateRowText(item)

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
            <span>{candidateRow.left}</span>
            <span>{candidateRow.right}</span>
          </div>
        )}
      </Card>
    </Link>
  )
}

function getCandidateRowText(item: LifeItem) {
  if (item.status === 'exploring') {
    return {
      left: item.track === 'ideal_self' ? '理想自我候选' : '副业探索候选',
      right: '点开后可开始',
    }
  }

  if (item.status === 'terminated' || item.status === 'completed' || item.status === 'concluded') {
    return {
      left: statusLabels[item.status],
      right: '查看本轮结果',
    }
  }

  return {
    left: statusLabels[item.status],
    right: '历史保留',
  }
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
  const dayNumber = day === 'scheduled' ? 0 : day === 'ended' ? 7 : day
  const pendingReview = isCyclePendingReview(cycle)

  return {
    dueText: `到期 ${formatShortDate(cycle.endDate)}`,
    label: pendingReview ? '等待复盘' : cycle.status === 'scheduled' ? '未开始' : '当前周期',
    percent: Math.min(100, Math.max(0, (dayNumber / 7) * 100)),
    ratio: pendingReview ? '待复盘' : dayNumber ? `第 ${dayNumber} 天` : '未开始',
  }
}

function formatShortDate(localDate: string) {
  const [, month, day] = localDate.split('-')
  return `${Number(month)}月${Number(day)}日`
}
