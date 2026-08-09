import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { InlineError } from '../../components/InlineError'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import {
  selectCycleCounts,
  selectCyclesByItem,
  selectItemById,
  selectOpenCycleByTrack,
  selectOpenCycleForItem,
} from '../../domain/selectors'
import {
  archiveLifeItem,
  deleteLifeItem,
  endCycleEarly,
  restoreArchivedItem,
} from '../../domain/transitions'
import { DomainError, type CycleStatus, type DailyEntry, type ItemStatus, type LifeLabState, type ReviewDecision } from '../../domain/types'
import styles from './ItemDetailPage.module.css'

const cycleStatusLabels: Record<CycleStatus, string> = {
  scheduled: '未开始',
  active: '进行中',
  review_due: '待复盘',
  reviewed: '已复盘',
}

const reviewDecisionLabels: Record<ReviewDecision, string> = {
  continue: '继续下一轮',
  adjust_continue: '重置',
  defer: '暂缓',
  long_term: '转长期',
  archive: '归档',
  voided: '作废',
  terminated: '终止',
  completed: '完结',
}

export function ItemDetailPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | 'end' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  if (!state || !itemId) {
    return null
  }

  if (deleted) {
    return <Navigate to="/library" replace />
  }

  const item = selectItemById(state, itemId)
  if (!item) {
    return (
      <>
        <AppHeader backTo="/library" title="记录不存在" eyebrow="总库" />
        <Card className={styles.section}>
          <p>这条记录不存在或已删除。</p>
        </Card>
      </>
    )
  }

  const cycles = selectCyclesByItem(state, item.id)
  const openCycle = selectOpenCycleForItem(state, item.id)
  const trackCycle = selectOpenCycleByTrack(state, item.track)
  const isTrackOccupiedByOther = Boolean(trackCycle && trackCycle.itemId !== item.id)
  const reviewsByCycleId = new Map(state.reviews.map((review) => [review.cycleId, review]))
  const canStartCycle = !openCycle && !isTrackOccupiedByOther && item.status !== 'archived' && !isEndedItemStatus(item.status)
  const today = todayLocalDate()
  const hasQuietActions = Boolean(
    (openCycle && openCycle.status !== 'review_due') || (item.status !== 'archived' && !openCycle) || !openCycle,
  )

  const handleRestore = () => {
    runAction(() => restoreArchivedItem(state, item.id, new Date()))
  }

  const handleConfirm = () => {
    if (confirmAction === 'archive') {
      runAction(() => archiveLifeItem(state, item.id, new Date()))
      setConfirmAction(null)
    }
    if (confirmAction === 'delete') {
      runAction(() => deleteLifeItem(state, item.id, new Date()), () => {
        setConfirmAction(null)
        setDeleted(true)
      })
    }
    if (confirmAction === 'end' && openCycle) {
      runAction(() => endCycleEarly(state, openCycle.id, new Date()), () => {
        setConfirmAction(null)
        navigate(`/experiments/${openCycle.id}/review`, { replace: true })
      })
    }
  }

  const runAction = (createNext: () => LifeLabState, onSuccess?: () => void) => {
    setError(null)
    try {
      const next = createNext()
      const saveResult = replaceState(next)
      if (!saveResult.ok) {
        setError(saveResult.message)
        return
      }
      onSuccess?.()
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '操作失败')
    }
  }

  return (
    <>
      <AppHeader backTo="/library" title={item.title} eyebrow="事项详情" />
      <div className={styles.stack}>
        <Card className={styles.section}>
          <div className={styles.meta}>
            <TrackBadge track={item.track} />
            <StatusBadge status={item.status} />
          </div>
          <p>{item.why || '还没有填写为什么想做。'}</p>
          <p>{item.question || '还没有填写长期想验证的问题。'}</p>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className={styles.actions}>
            {canStartCycle ? (
              <Link className={styles.linkButton} to={`/items/${item.id}/experiments/new`}>
                {cycles.length ? '开启新一轮' : '开启实践'}
              </Link>
            ) : null}
            {item.status === 'archived' ? (
              <Button onClick={handleRestore} variant="secondary">
                恢复事项
              </Button>
            ) : null}
            {openCycle?.status === 'active' ? (
              <Link
                className={`${styles.linkButton} ${styles.rightAction}`}
                to={`/experiments/${openCycle.id}/check-in?date=${today}`}
              >
                记录今日
              </Link>
            ) : null}
            {openCycle?.status === 'review_due' ? (
              <Link className={styles.linkButton} to={`/experiments/${openCycle.id}/review`}>
                去复盘
              </Link>
            ) : null}
          </div>
          {hasQuietActions ? (
            <details className={styles.moreActions}>
              <summary>更多操作</summary>
              <div className={styles.quietActions}>
                {openCycle && openCycle.status !== 'review_due' ? (
                  <Button onClick={() => setConfirmAction('end')} variant="secondary">
                    提前结束本轮
                  </Button>
                ) : null}
                {item.status !== 'archived' && !openCycle ? (
                  <Button onClick={() => setConfirmAction('archive')} variant="secondary">
                    归档事项
                  </Button>
                ) : null}
                {!openCycle ? (
                  <Button onClick={() => setConfirmAction('delete')} variant="danger">
                    删除事项
                  </Button>
                ) : null}
              </div>
            </details>
          ) : null}
        </Card>

        <Card className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>当前周期</h2>
            <Link className={styles.textAction} to={`/items/${item.id}/edit`}>
              编辑
            </Link>
          </div>
          {openCycle ? (
            <div className={styles.cycleSummary}>
              <strong>第 {openCycle.cycleNumber} 轮</strong>
              <span>
                {openCycle.startDate} 至 {openCycle.endDate}
              </span>
              <span>{cycleStatusLabels[openCycle.status]}</span>
            </div>
          ) : (
            <p>{isTrackOccupiedByOther ? '同方向已有未完成周期。' : '当前没有未完成周期。'}</p>
          )}
        </Card>

        <Card className={styles.section}>
          <h2>历史周期</h2>
          {cycles.length ? (
            <div className={styles.cycleList}>
              {cycles.map((cycle) => {
                const review = reviewsByCycleId.get(cycle.id)
                const entries = state.dailyEntries.filter((entry) => entry.cycleId === cycle.id)
                const counts = selectCycleCounts(cycle, state.dailyEntries)
                return (
                  <section className={styles.cycleItem} key={cycle.id}>
                    <p>
                      第 {cycle.cycleNumber} 轮：{cycle.startDate} 至 {cycle.endDate}，
                      {cycleStatusLabels[cycle.status]}
                    </p>
                    {cycle.endedEarlyAt ? <p>已提前结束。</p> : null}
                    <p>有效 / 未实践 / 空白：{counts.practiced} / {counts.notPracticed} / {counts.blank}</p>
                    <DailyEvidence entries={entries} />
                    {review ? (
                      <div className={styles.reviewEvidence}>
                        <p className={styles.reviewConclusion}>{review.conclusion}</p>
                        <EvidenceLine label="结束决定" value={reviewDecisionLabels[review.decision]} />
                        <EvidenceLine label="事实" value={review.factSummary} />
                        <EvidenceLine label="有能量" value={review.energizing} />
                        <EvidenceLine label="被消耗" value={review.draining} />
                        <EvidenceLine label="支持继续" value={review.evidenceFor} />
                        <EvidenceLine label="支持停止" value={review.evidenceAgainst} />
                        <EvidenceLine label="发现" value={review.discovery} />
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          ) : (
            <p>还没有历史周期。</p>
          )}
        </Card>
      </div>
      <ConfirmDialog
        confirmLabel={confirmAction === 'delete' ? '确认删除' : '确认'}
        isOpen={Boolean(confirmAction)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={getConfirmTitle(confirmAction)}
      >
        <p>{getConfirmBody(confirmAction)}</p>
      </ConfirmDialog>
    </>
  )
}

function isEndedItemStatus(status: ItemStatus) {
  return status === 'voided' || status === 'terminated' || status === 'completed'
}

function DailyEvidence({ entries }: { entries: DailyEntry[] }) {
  if (!entries.length) {
    return <p>还没有每日记录。</p>
  }
  return (
    <ul className={styles.dailyList}>
      {entries
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((entry) => (
          <li key={entry.id}>
            {entry.date}：{entry.status === 'practiced' ? entry.actionSummary : '未实践'}
            {entry.feelingTags.length ? `；感受：${entry.feelingTags.join('、')}` : ''}
            {entry.observation ? `；${entry.observation}` : ''}
          </li>
        ))}
    </ul>
  )
}

function EvidenceLine({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null
  }
  return (
    <p>
      <strong>{label}：</strong>
      {value}
    </p>
  )
}

function getConfirmTitle(action: 'archive' | 'delete' | 'end' | null) {
  if (action === 'archive') {
    return '归档这个事项？'
  }
  if (action === 'delete') {
    return '删除这个事项？'
  }
  if (action === 'end') {
    return '提前结束本轮？'
  }
  return '确认操作？'
}

function getConfirmBody(action: 'archive' | 'delete' | 'end' | null) {
  if (action === 'archive') {
    return '事项会移入已归档，历史证据会保留。'
  }
  if (action === 'delete') {
    return '会删除这个事项以及它的周期、每日记录和复盘证据，且不可恢复。'
  }
  if (action === 'end') {
    return '本轮会立即进入待复盘，7天结束日期和已有记录不会改变。'
  }
  return '请确认是否继续。'
}
