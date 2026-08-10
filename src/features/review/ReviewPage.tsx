import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { InlineError } from '../../components/InlineError'
import { TextArea } from '../../components/TextArea'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectCycleCounts } from '../../domain/selectors'
import { submitCycleReview } from '../../domain/transitions'
import { DomainError } from '../../domain/types'
import styles from './ReviewPage.module.css'

export function ReviewPage() {
  const { cycleId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const cycle = state?.cycles.find((candidate) => candidate.id === cycleId)
  const item = cycle ? state?.items.find((candidate) => candidate.id === cycle.itemId) : undefined
  const counts = cycle && state ? selectCycleCounts(cycle, state.dailyEntries) : null
  const [factSummary, setFactSummary] = useState('')
  const [energizing, setEnergizing] = useState('')
  const [draining, setDraining] = useState('')
  const [evidenceFor, setEvidenceFor] = useState('')
  const [evidenceAgainst, setEvidenceAgainst] = useState('')
  const [discovery, setDiscovery] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!state || !cycleId) {
    return null
  }

  if (!cycle || !item || !counts) {
    return <Navigate to="/today" replace />
  }

  if (cycle.status === 'reviewed') {
    return <Navigate to="/today" replace />
  }

  if (cycle.status !== 'terminated' && cycle.status !== 'completed' && cycle.status !== 'concluded') {
    return <Navigate to={`/items/${cycle.itemId}`} replace />
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      const next = submitCycleReview(
        state,
        {
          cycleId: cycle.id,
          factSummary,
          energizing,
          draining,
          evidenceFor,
          evidenceAgainst,
          discovery,
          conclusion,
        },
        new Date(),
        () => crypto.randomUUID(),
      )
      const saveResult = replaceState(next)
      if (!saveResult.ok) {
        setError(saveResult.message)
        return
      }
      navigate('/today', { replace: true })
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '提交复盘失败')
    }
  }

  return (
    <>
      <AppHeader backTo="/today" title="周期复盘" eyebrow={item.title} />
      <Card>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.stack}>
            <div className={styles.counts} aria-label="周期统计">
              <div className={styles.count}>
                <strong>{counts.practiced}</strong>
                <span>有效实践</span>
              </div>
              <div className={styles.count}>
                <strong>{counts.notPracticed}</strong>
                <span>未实践</span>
              </div>
              <div className={styles.count}>
                <strong>{counts.blank}</strong>
                <span>空白</span>
              </div>
            </div>
            <div className={styles.summary}>
              <p>
                第 {cycle.cycleNumber} 轮，{cycle.startDate} 至 {cycle.endDate}
              </p>
              <p>验证问题：{cycle.question}</p>
            </div>
          </div>
          <TextArea
            label="事实摘要"
            maxLength={1000}
            onChange={(event) => setFactSummary(event.target.value)}
            placeholder="例如：7 天里有效实践 4 天，主要完成了 3 个片段"
            required
            value={factSummary}
          />
          <details
            className={styles.optional}
            open={Boolean(energizing || draining || evidenceFor || evidenceAgainst || discovery)}
          >
            <summary>补充更多</summary>
            <div className={styles.optionalFields}>
              <TextArea
                label="带来能量的部分"
                maxLength={500}
                onChange={(event) => setEnergizing(event.target.value)}
                placeholder="例如：写具体案例时最有劲，完成后更清醒"
                value={energizing}
              />
              <TextArea
                label="带来消耗的部分"
                maxLength={500}
                onChange={(event) => setDraining(event.target.value)}
                placeholder="例如：空白页启动困难，晚上太晚做会拖延"
                value={draining}
              />
              <TextArea
                label="支持继续的证据"
                maxLength={800}
                onChange={(event) => setEvidenceFor(event.target.value)}
                placeholder="例如：有效天数过半，且有两次明显能量补充"
                value={evidenceFor}
              />
              <TextArea
                label="支持停止的证据"
                maxLength={800}
                onChange={(event) => setEvidenceAgainst(event.target.value)}
                placeholder="例如：连续三天需要硬撑，影响睡眠或主线任务"
                value={evidenceAgainst}
              />
              <TextArea
                label="本轮发现"
                maxLength={800}
                onChange={(event) => setDiscovery(event.target.value)}
                placeholder="例如：我需要先有小题目，不能只写“随便写点”"
                value={discovery}
              />
            </div>
          </details>
          <div className={styles.summary}>
            <p>本轮已{cycle.status === 'completed' ? '完成' : cycle.status === 'concluded' ? '完结' : '终止'}，复盘会保留这一结算结果。</p>
          </div>
          <TextArea
            label="本轮结论"
            maxLength={300}
            onChange={(event) => setConclusion(event.target.value)}
            placeholder="例如：值得继续，但标准要降到更容易启动"
            required
            value={conclusion}
          />
          {error ? <InlineError>{error}</InlineError> : null}
          <div className={styles.actions}>
            <Link className={styles.linkButton} to="/today">
              取消
            </Link>
            <Button type="submit">提交复盘</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
