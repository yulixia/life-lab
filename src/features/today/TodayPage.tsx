import { ArrowRight, ChevronRight, Clock3, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import { addCalendarDays, compareLocalDate, todayLocalDate } from '../../domain/dates'
import {
  selectCycleDay,
  selectDailyEntry,
  selectLongTermEntry,
  selectOpenCycleByTrack,
  isCyclePendingReview,
} from '../../domain/selectors'
import type { DailyEntry, ExperimentCycle, Track } from '../../domain/types'
import styles from './TodayPage.module.css'

const tracks: Track[] = ['ideal_self', 'side_hustle']
const trackEmptyText: Record<Track, string> = {
  ideal_self: '理想自我',
  side_hustle: '副业探索',
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
  const reviewDue = openCycles.filter(({ cycle }) => isCyclePendingReview(cycle))
  const activeOrScheduled = openCycles.filter(({ cycle }) => !isCyclePendingReview(cycle))
  const longTermItems = state.items.filter((item) => item.status === 'long_term' || item.status === 'long_term_terminated')

  return (
    <>
      <AppHeader className={styles.todayHeader} action={<span className={styles.headerDate}>{headerDate}</span>} title="今日" />
      <div className={styles.stack}>
        {reviewDue.map(({ cycle, track }) => {
          const item = state.items.find((candidate) => candidate.id === cycle.itemId)
          return (
            <Card className={styles.card} key={cycle.id}>
              <div className={styles.cardTitleRow}>
                <h2>{item?.title ?? '待复盘事项'}</h2>
                <Link className={styles.linkButton} to={`/experiments/${cycle.id}/review`}>
                  <span>去复盘</span>
                  <ArrowRight aria-hidden="true" className={styles.inlineIcon} />
                </Link>
              </div>
              <div className={styles.meta}>
                <TrackBadge track={track} />
                <StatusBadge status={item?.status ?? 'terminated'} />
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
                <span className={styles.focusEyebrow}>本轮想验证</span>
                {item ? (
                  <Link className={styles.detailLink} to={`/experiments/${cycle.id}`}>
                    <span>实践详情</span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <h2 className={styles.focusQuestion}>{cycle.question}</h2>
              <div className={styles.cyclePanel}>
                <div className={styles.dayLine}>
                  <div>
                    <strong>{day === 'scheduled' ? '明天开始' : day === 'ended' ? '本轮已结束' : `第 ${day} 天`}</strong>
                  </div>
                  <span className={styles.daysLeft}>
                    {day === 'scheduled' ? `${cycle.startDate} 开始` : day === 'ended' ? '等待系统结算' : `还剩 ${daysLeft} 天`}
                  </span>
                </div>
                <CycleProgress cycle={cycle} day={day} entries={state.dailyEntries} />
              </div>
              <div className={styles.practiceBrief}>
                <div className={styles.briefItem}>
                  <span className={styles.briefIcon}>
                    <Sparkles aria-hidden="true" className={styles.briefSvg} />
                  </span>
                  <p>
                    <span>今天做</span>
                    <strong>{cycle.actionPlan}</strong>
                  </p>
                </div>
                <div className={styles.briefItem}>
                  <span className={`${styles.briefIcon} ${styles.targetIcon}`}>
                    <Target aria-hidden="true" className={styles.briefSvg} />
                  </span>
                  <p>
                    <span>达标线</span>
                    <strong>{cycle.minimumStandard}</strong>
                  </p>
                </div>
              </div>
              {isRecordable ? (
                entry ? (
                  <Link className={`${styles.completedButton} ${styles.recordedTodayButton}`} to={`/experiments/${cycle.id}/check-in?date=${today}`}>
                    <span>今天已记录 ✓</span>
                    <ArrowRight aria-hidden="true" className={styles.inlineIcon} />
                  </Link>
                ) : (
                  <div className={styles.primaryActions}>
                    <Link className={styles.secondaryButton} to={`/experiments/${cycle.id}/check-in?date=${today}&status=not_practiced`}>
                      标记未实践
                    </Link>
                    <Link className={`${styles.primaryButton} ${styles.recordTodayButton}`} to={`/experiments/${cycle.id}/check-in?date=${today}`}>
                      <span>记录今日</span>
                      <ArrowRight aria-hidden="true" className={styles.inlineIcon} />
                    </Link>
                  </div>
                )
              ) : (
                <span className={styles.disabledAction}>
                  <Clock3 aria-hidden="true" className={styles.inlineIcon} />
                  开始前先保留精力
                </span>
              )}
              <div className={styles.focusFooter}>{trackEmptyText[track]}</div>
            </Card>
          )
        })}

        {tracks
          .filter((track) => !openCycles.some((entry) => entry.track === track))
          .map((track) => (
            <Card className={styles.card} key={track}>
              <div className={styles.cardTitleRow}>
                <h2>{trackEmptyText[track]}</h2>
                <Link className={`${styles.linkButton} ${styles.libraryLinkButton}`} to="/library">
                  <span>去总库</span>
                  {/* <ArrowRight aria-hidden="true" className={styles.inlineIcon} /> */}
                </Link>
              </div>
              <p>当前没有重点实践</p>
            </Card>
          ))}

        {longTermItems.length ? (
          <section className={styles.longTermSection}>
            <div className={styles.cardTitleRow}>
              <h2>长期事项</h2>
            </div>
            <div className={styles.stack}>
              {longTermItems.map((item) => {
                const entry = selectLongTermEntry(state, item.id, today)
                return (
                  <Card className={styles.card} key={item.id}>
                    <div className={styles.cardTitleRow}>
                      <h2>{item.title}</h2>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.status === 'long_term' ? (
                      <Link className={styles.primaryButton} to={`/items/${item.id}/long-term/check-in`}>
                        <span>{entry ? '更新今日备注' : '完成今天'}</span>
                        <ArrowRight aria-hidden="true" className={styles.inlineIcon} />
                      </Link>
                    ) : (
                      <p>已停止记录，可在事项详情中重启。</p>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}

type CycleDay = ReturnType<typeof selectCycleDay>

function CycleProgress({ cycle, day, entries }: { cycle: ExperimentCycle; day: CycleDay; entries: DailyEntry[] }) {
  const label = day === 'scheduled' ? '7 天实践尚未开始' : day === 'ended' ? '7 天实践已结束' : `7 天实践当前为第 ${day} 天`
  const practicedDates = new Set(
    entries
      .filter((entry) => entry.cycleId === cycle.id && entry.status === 'practiced')
      .map((entry) => entry.date),
  )

  return (
    <div aria-label={label} className={styles.progress} role="img">
      {Array.from({ length: 7 }, (_, index) => {
        const segmentDay = index + 1
        const segmentDate = addCalendarDays(cycle.startDate, index)
        const isPracticed = practicedDates.has(segmentDate)
        const isPast = compareLocalDate(segmentDate, todayLocalDate()) < 0
        const isToday = typeof day === 'number' && segmentDay === day
        const stateClass = isPracticed
          ? isToday ? styles.progressToday : styles.progressComplete
          : isPast ? styles.progressMissed : styles.progressFuture
        return (
          <span
            className={`${styles.progressSegment} ${stateClass}`}
            data-status={isPracticed ? 'practiced' : isPast ? 'missed' : 'empty'}
            key={segmentDay}
          />
        )
      })}
    </div>
  )
}
