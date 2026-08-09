import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import {
  selectCycleDay,
  selectDailyEntry,
  selectLatestDecision,
  selectOpenCycleByTrack,
  selectRecentEnergy,
  selectTopFeelingTags,
} from '../../domain/selectors'
import type { EnergyCategory, EnergyEntry, Track } from '../../domain/types'
import styles from './TodayPage.module.css'

const tracks: Track[] = ['ideal_self', 'side_hustle']
const trackEmptyText: Record<Track, string> = {
  ideal_self: '理想自我当前没有重点实践。',
  side_hustle: '副业探索当前没有重点实践。',
}

function formatHeaderDate(date = new Date()) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${weekdays[date.getDay()]} · ${date.getMonth() + 1}月${date.getDate()}日`
}

export function TodayPage() {
  const { state } = useLifeLab()
  const today = todayLocalDate()
  const headerDate = formatHeaderDate()

  if (!state) {
    return null
  }

  const openCycles = tracks
    .map((track) => ({ track, cycle: selectOpenCycleByTrack(state, track) }))
    .filter((entry): entry is { track: Track; cycle: NonNullable<typeof entry.cycle> } => Boolean(entry.cycle))
  const reviewDue = openCycles.filter(({ cycle }) => cycle.status === 'review_due')
  const activeOrScheduled = openCycles.filter(({ cycle }) => cycle.status !== 'review_due')
  const latestDecision = selectLatestDecision(state)

  return (
    <>
      <AppHeader action={<span className={styles.headerDate}>{headerDate}</span>} title="今日" />
      <div className={styles.stack}>
        {reviewDue.map(({ cycle, track }) => {
          const item = state.items.find((candidate) => candidate.id === cycle.itemId)
          return (
            <Card className={styles.card} key={cycle.id}>
              <div className={styles.cardTitleRow}>
                <h2>{item?.title ?? '待复盘事项'}</h2>
                <Link className={styles.linkButton} to={`/experiments/${cycle.id}/review`}>
                  去复盘
                </Link>
              </div>
              <div className={styles.meta}>
                <TrackBadge track={track} />
                <StatusBadge status="review_due" />
              </div>
              <p>第 {cycle.cycleNumber} 轮已结束，需要先复盘后才能继续这个方向。</p>
            </Card>
          )
        })}

        {activeOrScheduled.map(({ cycle, track }) => {
          const item = state.items.find((candidate) => candidate.id === cycle.itemId)
          const day = selectCycleDay(cycle, today)
          const entry = selectDailyEntry(state, cycle.id, today)
          const isRecordable = typeof day === 'number'
          const daysLeft = typeof day === 'number' ? 7 - day : 7
          return (
            <Card className={`${styles.card} ${styles.focusCard}`} key={cycle.id}>
              <div className={styles.focusHeader}>
                <div>
                  <span className={styles.kicker}>今天的实践</span>
                  <h2>{item?.title ?? '当前实践'}</h2>
                </div>
                <TrackBadge track={track} />
              </div>
              <div className={styles.dayLine}>
                <strong>{day === 'scheduled' ? '明天开始' : `第 ${day} 天`}</strong>
                <span>{day === 'scheduled' ? `${cycle.startDate} 开始` : `还剩 ${daysLeft} 天`}</span>
              </div>
              <p className={styles.planText}>
                第 {cycle.cycleNumber} 轮，{cycle.startDate} 至 {cycle.endDate}
              </p>
              {isRecordable ? (
                <div className={styles.primaryActions}>
                  <Link className={styles.primaryButton} to={`/experiments/${cycle.id}/check-in?date=${today}`}>
                    {entry ? '查看今日记录' : '记录今日'}
                  </Link>
                  <Link className={styles.secondaryButton} to={`/experiments/${cycle.id}/check-in?date=${today}&status=not_practiced`}>
                    标记未实践
                  </Link>
                </div>
              ) : (
                <span className={styles.disabledAction}>开始前先保留精力</span>
              )}
            </Card>
          )
        })}

        {tracks
          .filter((track) => !openCycles.some((entry) => entry.track === track))
          .map((track) => (
            <Card className={styles.card} key={track}>
              <div className={styles.cardTitleRow}>
                <h2>当前没有重点实践</h2>
                <Link className={styles.linkButton} to="/library">
                  去总库
                </Link>
              </div>
              <p>{trackEmptyText[track]}</p>
            </Card>
          ))}

        <section className={styles.overview} aria-label="极简总览">
          <h2 className={styles.sectionTitle}>最近的证据</h2>
          <OverviewCard
            category="energy"
            entries={selectRecentEnergy(state, 'energy', 5)}
            tags={selectTopFeelingTags(state, 'energy', 5)}
            title="近期有能量"
          />
          <OverviewCard
            category="drain"
            entries={selectRecentEnergy(state, 'drain', 5)}
            tags={selectTopFeelingTags(state, 'drain', 5)}
            title="近期被消耗"
          />
          <Card className={styles.card}>
            <h2>最近决定</h2>
            {latestDecision ? (
              <>
                <p>{latestDecision.item.title}</p>
                <p>{latestDecision.review.conclusion}</p>
              </>
            ) : (
              <p>还没有完成周期复盘。</p>
            )}
          </Card>
        </section>
      </div>
    </>
  )
}

function OverviewCard({
  category,
  entries,
  tags,
  title,
}: {
  category: EnergyCategory
  entries: EnergyEntry[]
  tags: string[]
  title: string
}) {
  return (
    <Card className={styles.card}>
      <div className={styles.cardTitleRow}>
        <h2>{title}</h2>
        <Link className={styles.linkButton} to={`/energy?type=${category}`}>
          查看
        </Link>
      </div>
      <div className={styles.tagList}>
        {tags.length ? tags.map((tag) => <span key={tag}>{tag}</span>) : <span>暂无标签</span>}
      </div>
      {entries.length ? (
        <ul className={styles.evidenceList}>
          {entries.slice(0, 3).map((entry) => (
            <li key={entry.id}>{entry.event}</li>
          ))}
        </ul>
      ) : (
        <p>暂无记录。</p>
      )}
    </Card>
  )
}
