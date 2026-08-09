import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <AppHeader title="设置与数据" eyebrow="本地保存" />
      <div className={styles.stack}>
        <Card className={styles.section}>
          <h2>极简总览</h2>
          <div className={styles.grid}>
            <Metric label="事项" value={state.items.length} />
            <Metric label="周期" value={state.cycles.length} />
            <Metric label="复盘" value={state.reviews.length} />
            <Metric label="情绪记录" value={state.energyEntries.length} />
          </div>
          <ul className={styles.list}>
            <li>到达复盘的周期：{reviewedCycles.length}</li>
            <li>有效实践 / 未实践 / 空白：{practicedDays} / {missedDays} / {blankDays}</li>
            <li>有能量高频标签：{topEnergyTags.join('、') || '暂无'}</li>
            <li>被消耗高频标签：{topDrainTags.join('、') || '暂无'}</li>
            <li>
              最近决定：
              {latestDecision
                ? `${latestDecision.item.title}：${latestDecision.review.conclusion}`
                : '暂无'}
            </li>
          </ul>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
