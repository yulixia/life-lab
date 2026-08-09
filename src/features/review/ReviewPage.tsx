import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { InlineError } from '../../components/InlineError'
import { SelectField } from '../../components/SelectField'
import { TextArea } from '../../components/TextArea'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectCycleCounts } from '../../domain/selectors'
import { submitCycleReview } from '../../domain/transitions'
import { DomainError, type ReviewDecision } from '../../domain/types'
import styles from './ReviewPage.module.css'

const decisionLabels: Record<ReviewDecision, string> = {
  continue: '继续下一轮',
  adjust_continue: '调整后继续',
  defer: '暂缓',
  long_term: '转长期',
  archive: '归档',
}

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
  const [decision, setDecision] = useState<ReviewDecision>('continue')
  const [adjustActionPlan, setAdjustActionPlan] = useState('')
  const [adjustMinimumStandard, setAdjustMinimumStandard] = useState('')
  const [adjustIdealStandard, setAdjustIdealStandard] = useState('')
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

  if (cycle.status !== 'review_due') {
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
          decision,
          adjustedPlan:
            decision === 'adjust_continue'
              ? {
                  actionPlan: adjustActionPlan,
                  minimumStandard: adjustMinimumStandard,
                  idealStandard: adjustIdealStandard,
                }
              : undefined,
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
            required
            value={factSummary}
          />
          <TextArea
            label="带来能量的部分"
            maxLength={500}
            onChange={(event) => setEnergizing(event.target.value)}
            value={energizing}
          />
          <TextArea
            label="带来消耗的部分"
            maxLength={500}
            onChange={(event) => setDraining(event.target.value)}
            value={draining}
          />
          <TextArea
            label="支持继续的证据"
            maxLength={800}
            onChange={(event) => setEvidenceFor(event.target.value)}
            value={evidenceFor}
          />
          <TextArea
            label="支持停止的证据"
            maxLength={800}
            onChange={(event) => setEvidenceAgainst(event.target.value)}
            value={evidenceAgainst}
          />
          <TextArea
            label="本轮发现"
            maxLength={800}
            onChange={(event) => setDiscovery(event.target.value)}
            value={discovery}
          />
          <SelectField
            label="决定"
            onChange={(event) => setDecision(event.target.value as ReviewDecision)}
            required
            value={decision}
          >
            {Object.entries(decisionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          {decision === 'adjust_continue' ? (
            <>
              <TextArea
                label="下一轮行动计划"
                maxLength={500}
                onChange={(event) => setAdjustActionPlan(event.target.value)}
                value={adjustActionPlan}
              />
              <TextArea
                label="下一轮最低标准"
                maxLength={240}
                onChange={(event) => setAdjustMinimumStandard(event.target.value)}
                value={adjustMinimumStandard}
              />
              <TextArea
                label="下一轮理想标准"
                maxLength={240}
                onChange={(event) => setAdjustIdealStandard(event.target.value)}
                value={adjustIdealStandard}
              />
            </>
          ) : null}
          <TextArea
            label="本轮结论"
            maxLength={300}
            onChange={(event) => setConclusion(event.target.value)}
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
