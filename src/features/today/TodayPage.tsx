import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import {
  selectCycleDay,
  selectDailyEntry,
  selectOpenCycleByTrack,
} from '../../domain/selectors'
import type { Track } from '../../domain/types'
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
              <div className={styles.practiceBrief}>
                <p>
                  <span>今天做</span>
                  {cycle.actionPlan}
                </p>
                <p>
                  <span>达标线</span>
                  {cycle.minimumStandard}
                </p>
              </div>
              {isRecordable ? (
                <div className={styles.primaryActions}>
                  <Link className={styles.secondaryButton} to={`/experiments/${cycle.id}/check-in?date=${today}&status=not_practiced`}>
                    标记未实践
                  </Link>
                  <Link className={styles.primaryButton} to={`/experiments/${cycle.id}/check-in?date=${today}`}>
                    {entry ? '查看今日记录' : '记录今日'}
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
      </div>
    </>
  )
}
