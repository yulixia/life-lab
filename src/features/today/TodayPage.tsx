import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import { selectCycleDay, selectDailyEntry, selectOpenCycleByTrack } from '../../domain/selectors'
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
          return (
            <Card className={styles.card} key={cycle.id}>
              <div className={styles.cardTitleRow}>
                <h2>{item?.title ?? '当前实践'}</h2>
                {isRecordable ? (
                  <Link className={styles.linkButton} to={`/experiments/${cycle.id}/check-in?date=${today}`}>
                    {entry ? '查看记录' : '记录今日'}
                  </Link>
                ) : (
                  <span className={styles.disabledAction}>明日开始</span>
                )}
              </div>
              <div className={styles.meta}>
                <TrackBadge track={track} />
                <StatusBadge status={cycle.status === 'scheduled' ? 'active' : 'active'} />
              </div>
              <p>
                第 {cycle.cycleNumber} 轮，{cycle.startDate} 至 {cycle.endDate}
              </p>
              <p>{day === 'scheduled' ? '还未开始' : `第 ${day} 天`}</p>
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
              <div className={styles.meta}>
                <TrackBadge track={track} />
              </div>
              <p>{trackEmptyText[track]}</p>
            </Card>
          ))}
      </div>
    </>
  )
}
