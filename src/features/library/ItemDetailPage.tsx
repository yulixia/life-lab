import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Archive, Flag, MoreHorizontal, Play, Repeat2, RotateCcw, Trash2 } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { InlineError } from '../../components/InlineError'
import { useLifeLab } from '../../app/LifeLabContext'
import {
  isCyclePendingReview,
  selectCycleCounts,
  selectCyclesByItem,
  selectItemById,
  selectLongTermEntriesByItem,
  selectOpenCycleByTrack,
  selectOpenCycleForItem,
} from '../../domain/selectors'
import {
  archiveLifeItem,
  convertArchivedItemToLongTerm,
  deleteLifeItem,
  endCycleEarly,
  restartLongTermItem,
  restoreArchivedItem,
  terminateLongTermItem,
} from '../../domain/transitions'
import { DomainError, type CycleStatus, type DailyEntry, type ItemStatus, type LifeLabState, type MissReason, type ReviewDecision } from '../../domain/types'
import styles from './ItemDetailPage.module.css'

const cycleStatusLabels: Record<CycleStatus, string> = {
  scheduled: '未开始',
  active: '进行中',
  terminated: '已终止，待复盘',
  completed: '已完成，待复盘',
  concluded: '已完结，待复盘',
  reviewed: '已复盘',
}

const reviewDecisionLabels: Record<ReviewDecision, string> = {
  terminated: '已终止',
  completed: '已完成',
  concluded: '已完结',
}

const legacyMissReasonLabels: Record<MissReason, string> = {
  busy: '忙碌',
  low_energy: '低能量',
  forgot: '忘记',
  blocked: '被阻塞',
  unwell: '身体不适',
  not_priority: '优先级靠后',
  other: '其他',
}

type ConfirmAction = 'archive' | 'delete' | 'end' | 'terminate_long_term' | null

export function ItemDetailPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const moreActionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreActionsOpen) return

    const closeMoreActions = (event: PointerEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setMoreActionsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreActionsOpen(false)
    }

    document.addEventListener('pointerdown', closeMoreActions)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMoreActions)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [moreActionsOpen])

  if (!state || !itemId) return null
  if (deleted) return <Navigate to="/library" replace />

  const item = selectItemById(state, itemId)
  if (!item) {
    return <><AppHeader backTo="/library" title="记录不存在" /><Card className={styles.section}><p>这条记录不存在或已删除。</p></Card></>
  }

  const cycles = selectCyclesByItem(state, item.id)
  const openCycle = selectOpenCycleForItem(state, item.id)
  const pendingReviewCycle = cycles.find((cycle) => isCyclePendingReview(cycle)) ?? null
  const latestCycle = cycles[0] ?? null
  const trackCycle = selectOpenCycleByTrack(state, item.track)
  const isTrackOccupiedByOther = Boolean(trackCycle && trackCycle.itemId !== item.id)
  const reviewsByCycleId = new Map(state.reviews.map((review) => [review.cycleId, review]))
  const itemCycleIds = new Set(cycles.map((cycle) => cycle.id))
  const hasPracticeRecords = state.dailyEntries.some((entry) => itemCycleIds.has(entry.cycleId))
  const latestCycleReviewed = latestCycle?.status === 'reviewed' && Boolean(latestCycle.reviewId)
  const longTermEntries = selectLongTermEntriesByItem(state, item.id)
  const canStartFirstCycle = item.status === 'exploring' && !openCycle && !isTrackOccupiedByOther
  const canStartNextRound =
    !openCycle && !isTrackOccupiedByOther && latestCycleReviewed && ['terminated', 'completed', 'concluded'].includes(item.status)
  const canArchive = latestCycleReviewed && item.status === 'completed'
  const canConvertToLongTerm = item.status === 'archived' && item.archivedFromStatus === 'completed'
  const canDelete = !hasPracticeRecords && (item.status === 'exploring' || item.status === 'active')
  const canEndEarly = Boolean(openCycle && !isCyclePendingReview(openCycle) && hasPracticeRecords)
  const hasPrimaryActions = canStartFirstCycle || item.status === 'archived' || Boolean(pendingReviewCycle)
  const hasQuietActions = canStartNextRound || canEndEarly || canArchive || canConvertToLongTerm || item.status === 'long_term' || item.status === 'long_term_terminated' || canDelete
  const pairStartWithMoreActions = canStartFirstCycle && hasQuietActions

  const runAction = (createNext: () => LifeLabState, onSuccess?: () => void) => {
    setError(null)
    try {
      const saveResult = replaceState(createNext())
      if (!saveResult.ok) return setError(saveResult.message)
      onSuccess?.()
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '操作失败')
    }
  }

  const handleConfirm = () => {
    if (confirmAction === 'archive') runAction(() => archiveLifeItem(state, item.id, new Date()), closeConfirm)
    if (confirmAction === 'delete') runAction(() => deleteLifeItem(state, item.id, new Date()), () => { closeConfirm(); setDeleted(true) })
    if (confirmAction === 'end' && openCycle) runAction(() => endCycleEarly(state, openCycle.id, new Date()), () => { closeConfirm(); navigate(`/experiments/${openCycle.id}/review`, { replace: true }) })
    if (confirmAction === 'terminate_long_term') runAction(() => terminateLongTermItem(state, item.id, new Date()), closeConfirm)
  }
  const closeConfirm = () => { setMoreActionsOpen(false); setConfirmAction(null) }

  return (
    <>
      <AppHeader backTo="/library" title={item.title} />
      <div className={styles.stack}>
        <Card className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.meta}><TrackBadge track={item.track} /><StatusBadge status={item.status} /></div>
            <Link className={styles.textAction} to={`/items/${item.id}/edit`}>编辑</Link>
          </div>
          <div className={styles.descriptionBlock}>
            <p>{item.why || '还没有填写为什么想做。'}</p>
            <p>{item.question || '还没有填写长期想验证的问题。'}</p>
          </div>
          <CycleSummary cycle={openCycle} item={item} otherTrackOccupied={isTrackOccupiedByOther} state={state} />
          {error ? <InlineError>{error}</InlineError> : null}
          {hasPrimaryActions || hasQuietActions ? (
            <div className={`${styles.actionArea} ${pairStartWithMoreActions ? styles.startActionRow : ''}`}>
              {hasPrimaryActions ? (
                <div className={styles.actions}>
                  {canStartFirstCycle ? <Link className={styles.linkButton} to={`/items/${item.id}/experiments/new`}>开启实践</Link> : null}
                  {item.status === 'archived' ? <Button onClick={() => runAction(() => restoreArchivedItem(state, item.id, new Date()))} variant="secondary">恢复事项</Button> : null}
                  {pendingReviewCycle ? <Link className={styles.linkButton} to={`/experiments/${pendingReviewCycle.id}/review`}>去复盘</Link> : null}
                </div>
              ) : null}
              {hasQuietActions ? (
                <div className={styles.moreActions} ref={moreActionsRef}>
                  <button aria-expanded={moreActionsOpen} className={styles.moreActionsTrigger} onClick={() => setMoreActionsOpen((value) => !value)} type="button">
                    <span>更多操作</span><MoreHorizontal aria-hidden="true" size={16} strokeWidth={2.8} />
                  </button>
                  {moreActionsOpen ? (
                    <div className={styles.quietActions}>
                      {canStartNextRound ? <Link className={`${styles.menuAction} ${styles.primaryMenuAction}`} onClick={() => setMoreActionsOpen(false)} to={`/items/${item.id}/experiments/new`}><Repeat2 aria-hidden="true" size={16} /><span>开启下一轮</span></Link> : null}
                      {canEndEarly ? <button className={styles.menuAction} onClick={() => setConfirmAction('end')} type="button"><Flag aria-hidden="true" size={16} /><span>终止本轮</span></button> : null}
                      {canArchive ? <button className={styles.menuAction} onClick={() => setConfirmAction('archive')} type="button"><Archive aria-hidden="true" size={16} /><span>归档事项</span></button> : null}
                      {canConvertToLongTerm ? <button className={`${styles.menuAction} ${styles.primaryMenuAction}`} onClick={() => runAction(() => convertArchivedItemToLongTerm(state, item.id, new Date()), () => setMoreActionsOpen(false))} type="button"><Play aria-hidden="true" size={16} /><span>转为长期</span></button> : null}
                      {item.status === 'long_term' ? <button className={styles.menuAction} onClick={() => setConfirmAction('terminate_long_term')} type="button"><Flag aria-hidden="true" size={16} /><span>终止长期事项</span></button> : null}
                      {item.status === 'long_term_terminated' ? <button className={`${styles.menuAction} ${styles.primaryMenuAction}`} onClick={() => runAction(() => restartLongTermItem(state, item.id, new Date()), () => setMoreActionsOpen(false))} type="button"><RotateCcw aria-hidden="true" size={16} /><span>重启长期事项</span></button> : null}
                      {canDelete ? <button className={`${styles.menuAction} ${styles.dangerMenuAction}`} onClick={() => setConfirmAction('delete')} type="button"><Trash2 aria-hidden="true" size={16} /><span>删除事项</span></button> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        {item.status === 'long_term' || item.status === 'long_term_terminated' ? (
          <Card className={styles.section}>
            <h2>长期记录</h2>
            <div className={styles.cycleSummary}>
              <strong>累计完成 {longTermEntries.length} 天</strong>
              <span>{longTermEntries[0] ? `最近完成：${longTermEntries[0].date}` : '还没有完成记录。'}</span>
            </div>
            {longTermEntries.length ? <ul className={styles.dailyList}>{longTermEntries.slice(0, 8).map((entry) => <li key={entry.id}>{entry.date}{entry.note ? `：${entry.note}` : ''}</li>)}</ul> : null}
          </Card>
        ) : null}

        <Card className={styles.section}>
          <h2>历史周期</h2>
          {cycles.length ? <div className={styles.cycleList}>{cycles.map((cycle) => {
            const review = reviewsByCycleId.get(cycle.id)
            const entries = state.dailyEntries.filter((entry) => entry.cycleId === cycle.id)
            const counts = selectCycleCounts(cycle, state.dailyEntries)
            return <section className={styles.cycleItem} key={cycle.id}>
              <div className={styles.cycleHeader}>
                <div>
                  <strong>第 {cycle.cycleNumber} 轮</strong>
                  <p>{cycle.startDate} 至 {cycle.endDate}</p>
                </div>
                <span className={styles.cycleStatus}>{cycleStatusLabels[cycle.status]}</span>
              </div>
              <p className={styles.cycleMetrics}>记录 {counts.recorded}/7 · 有效实践 {counts.practiced} · 未实践 {counts.notPracticed} · 空白 {counts.blank}</p>
              {cycle.endedEarlyAt ? <p className={styles.cycleNote}>本轮提前结束。</p> : null}
              <DailyEvidence entries={entries} />
              {review ? <div className={styles.reviewEvidence}><p className={styles.reviewConclusion}>{review.conclusion}</p><EvidenceLine label="结算结果" value={reviewDecisionLabels[review.decision]} /><EvidenceLine label="事实" value={review.factSummary} /><EvidenceLine label="有能量" value={review.energizing} /><EvidenceLine label="被消耗" value={review.draining} /><EvidenceLine label="支持继续" value={review.evidenceFor} /><EvidenceLine label="支持停止" value={review.evidenceAgainst} /><EvidenceLine label="发现" value={review.discovery} /></div> : null}
            </section>
          })}</div> : <p>还没有历史周期。</p>}
        </Card>
      </div>
      <ConfirmDialog confirmLabel={confirmAction === 'delete' ? '确认删除' : '确认'} isOpen={Boolean(confirmAction)} onCancel={() => setConfirmAction(null)} onConfirm={handleConfirm} title={getConfirmTitle(confirmAction)}><p>{getConfirmBody(confirmAction)}</p></ConfirmDialog>
    </>
  )
}

function CycleSummary({ cycle, item, otherTrackOccupied, state }: { cycle: ReturnType<typeof selectOpenCycleForItem>; item: { status: ItemStatus }; otherTrackOccupied: boolean; state: LifeLabState }) {
  if (item.status === 'long_term' || item.status === 'long_term_terminated') return null
  if (!cycle) return <div className={styles.cycleSummary}><p>{otherTrackOccupied ? '同方向已有待完成或待复盘的事项。' : '当前没有进行中的周期。'}</p></div>
  const counts = selectCycleCounts(cycle, state.dailyEntries)
  return <div className={styles.cycleSummary}><strong>{isCyclePendingReview(cycle) ? '本轮等待复盘' : `当前周期 · 第 ${cycle.cycleNumber} 轮`}</strong><span>{cycle.startDate} 至 {cycle.endDate}</span><span>{isCyclePendingReview(cycle) ? `${cycleStatusLabels[cycle.status]} · 已记录 ${counts.recorded}/7 天` : `已记录 ${counts.recorded}/7 天`}</span></div>
}

function DailyEvidence({ entries }: { entries: DailyEntry[] }) {
  if (!entries.length) return <p>还没有每日记录。</p>
  return <ul className={styles.dailyList}>{entries.sort((left, right) => left.date.localeCompare(right.date)).map((entry) => {
    const missReasonTags = entry.missReasonTags?.length ? entry.missReasonTags : entry.missReason ? [legacyMissReasonLabels[entry.missReason]] : []
    return <li key={entry.id}>{entry.date}：{entry.status === 'practiced' ? entry.actionSummary : '未实践'}{entry.status === 'practiced' && entry.feelingTags.length ? `；感受：${entry.feelingTags.join('、')}` : ''}{entry.status === 'not_practiced' && missReasonTags.length ? `；原因：${missReasonTags.join('、')}` : ''}{entry.status === 'not_practiced' && entry.missReasonOther ? `；${entry.missReasonOther}` : ''}{entry.observation ? `；${entry.observation}` : ''}</li>
  })}</ul>
}

function EvidenceLine({ label, value }: { label: string; value?: string }) {
  return value ? <p><strong>{label}：</strong>{value}</p> : null
}

function getConfirmTitle(action: ConfirmAction) {
  if (action === 'archive') return '归档这个事项？'
  if (action === 'delete') return '删除这个事项？'
  if (action === 'end') return '终止本轮？'
  if (action === 'terminate_long_term') return '终止长期事项？'
  return '确认操作？'
}

function getConfirmBody(action: ConfirmAction) {
  if (action === 'archive') return '事项会移入已归档，历史周期和复盘会保留。'
  if (action === 'delete') return '会删除这个没有记录的事项及其空周期，且不可恢复。'
  if (action === 'end') return '本轮会立即进入已终止，随后需要复盘。'
  if (action === 'terminate_long_term') return '长期记录会保留，之后可以随时重启。'
  return '请确认是否继续。'
}
