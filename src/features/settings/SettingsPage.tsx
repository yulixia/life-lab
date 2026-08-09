import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Boxes, ChartNoAxesColumn, CircleCheck, ClipboardCheck, RotateCcw, Tags } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { InlineError } from '../../components/InlineError'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectLatestDecision, selectTopFeelingTags } from '../../domain/selectors'
import { exportFullBackup, exportValidationSummary } from '../../storage'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const { deleteAll, state } = useLifeLab()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestDecision = state ? selectLatestDecision(state) : null
  const topEnergyTags = useMemo(() => (state ? selectTopFeelingTags(state, 'energy', 5) : []), [state])
  const topDrainTags = useMemo(() => (state ? selectTopFeelingTags(state, 'drain', 5) : []), [state])

  if (!state) {
    return null
  }

  const reviewedCycles = state.cycles.filter((cycle) => cycle.status === 'review_due' || cycle.status === 'reviewed')
  const practicedDays = state.reviews.reduce((total, review) => total + review.effectiveDays, 0)
  const missedDays = state.reviews.reduce((total, review) => total + review.missedDays, 0)
  const blankDays = state.reviews.reduce((total, review) => total + review.blankDays, 0)
  const totalPracticeDays = practicedDays + missedDays + blankDays

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const today = new Date().toISOString().slice(0, 10)

  const handleDeleteAll = () => {
    setError(null)
    const result = deleteAll()
    if (!result.ok) {
      setError(result.message)
      return
    }
    setConfirmOpen(false)
    navigate('/today', { replace: true })
  }

  return (
    <>
      <AppHeader title="数据" eyebrow="本地保存" />
      <div className={styles.stack}>
        <Card className={styles.section}>
          <div className={styles.overviewHero}>
            <div>
              <h2>极简总览</h2>
              <p>当前浏览器里的实验数据概况</p>
            </div>
            <span className={styles.heroBadge}>
              <ChartNoAxesColumn aria-hidden="true" size={17} strokeWidth={2.6} />
              v{state.schemaVersion}
            </span>
          </div>
          <div className={styles.metricGrid}>
            <Metric Icon={Boxes} label="事项" value={state.items.length} />
            <Metric Icon={RotateCcw} label="周期" value={state.cycles.length} />
            <Metric Icon={ClipboardCheck} label="复盘" value={state.reviews.length} />
            <Metric Icon={Activity} label="情绪记录" value={state.energyEntries.length} />
          </div>
          <div className={styles.insightList}>
            <Insight
              Icon={CircleCheck}
              label="实践记录"
              value={`有效 ${practicedDays} / 未实践 ${missedDays} / 空白 ${blankDays}`}
              note={`共 ${totalPracticeDays} 天记录，到达复盘 ${reviewedCycles.length} 个周期`}
            />
            <Insight
              Icon={Tags}
              label="高频标签"
              value={`有能量：${topEnergyTags.join('、') || '暂无'}`}
              note={`被消耗：${topDrainTags.join('、') || '暂无'}`}
            />
            <Insight
              Icon={ClipboardCheck}
              label="最近决定"
              value={latestDecision ? latestDecision.item.title : '暂无'}
              note={latestDecision?.review.conclusion ?? '完成复盘后会出现在这里'}
            />
          </div>
        </Card>

        <Card className={styles.section}>
          <h2>本地数据</h2>
          <p>schemaVersion: {state.schemaVersion}</p>
          <p>数据只保存在当前浏览器。完整备份可能包含隐私内容，下载后请自行保管。</p>
          <div className={styles.actions}>
         
            <Button
              onClick={() => downloadBlob(exportValidationSummary(state), `life-lab-validation-summary-${today}.json`)}
              variant="secondary"
            >
              导出匿名摘要
            </Button>
               <Button onClick={() => downloadBlob(exportFullBackup(state), `life-lab-backup-${today}.json`)}>
              导出完整 JSON
            </Button>
          </div>
        </Card>

        <Card className={`${styles.section} ${styles.dangerZone}`}>
          <h2>删除全部数据</h2>
          <p>会删除事项、周期、每日记录、复盘和情绪记录，且不可恢复。</p>
          <Button onClick={() => setConfirmOpen(true)} variant="danger">
            删除全部数据
          </Button>
          {error ? <InlineError>{error}</InlineError> : null}
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="确认删除"
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDeleteAll}
        title="确认删除全部数据？"
      >
        <p>这会重建一个空的 v1 数据结构，并回到今日页。</p>
      </ConfirmDialog>
    </>
  )
}

function Metric({ Icon, label, value }: { Icon: typeof Boxes; label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>
        <Icon aria-hidden="true" size={16} strokeWidth={2.6} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function Insight({
  Icon,
  label,
  note,
  value,
}: {
  Icon: typeof Boxes
  label: string
  note: string
  value: string
}) {
  return (
    <div className={styles.insight}>
      <span className={styles.insightIcon}>
        <Icon aria-hidden="true" size={16} strokeWidth={2.6} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </div>
  )
}
