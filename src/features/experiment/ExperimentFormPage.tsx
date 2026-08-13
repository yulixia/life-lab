import { useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SubpageHeader } from '../../components/SubpageHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { InlineError } from '../../components/InlineError'
import { TextArea } from '../../components/TextArea'
import { useLifeLab } from '../../app/LifeLabContext'
import { addCalendarDays, todayLocalDate } from '../../domain/dates'
import { selectItemById, selectOpenCycleByTrack } from '../../domain/selectors'
import { createExperimentCycle } from '../../domain/transitions'
import { DomainError } from '../../domain/types'
import { ExperimentPeriod } from './ExperimentPeriod'
import styles from './ExperimentFormPage.module.css'

export function ExperimentFormPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const item = state && itemId ? selectItemById(state, itemId) : null
  const today = todayLocalDate()
  const [question, setQuestion] = useState(item?.question ?? '')
  const [positiveSignals, setPositiveSignals] = useState('')
  const [negativeSignals, setNegativeSignals] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [minimumStandard, setMinimumStandard] = useState('')
  const [idealStandard, setIdealStandard] = useState('')
  const [error, setError] = useState<string | null>(null)

  const occupiedCycle = useMemo(() => {
    if (!state || !item) {
      return null
    }
    const openCycle = selectOpenCycleByTrack(state, item.track)
    return openCycle && openCycle.itemId !== item.id ? openCycle : null
  }, [item, state])

  if (!state || !itemId) {
    return null
  }

  if (!item) {
    return <Navigate to="/library" replace />
  }

  if (item.status === 'archived' || item.status === 'long_term' || item.status === 'long_term_terminated') {
    return <Navigate to={`/items/${item.id}`} replace />
  }

  const startDate = today
  const endDate = addCalendarDays(today, 6)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      const next = createExperimentCycle(
        state,
        { itemId: item.id, startDate: today, question, positiveSignals, negativeSignals, actionPlan, minimumStandard, idealStandard },
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
      setError(caught instanceof DomainError ? caught.message : '创建实践失败')
    }
  }

  return (
    <>
      <SubpageHeader
        backTo={`/items/${item.id}`}
        context={item.track === 'ideal_self' ? '理想自我' : '副业探索'}
        title="创建实践"
      />
      <Card className={styles.editorCard}>
        {occupiedCycle ? (
          <div className={styles.blockedSummary}>
            <p>当前方向已有未完成周期，需要先完成或复盘后再开始新的实践。</p>
            <Link className={styles.linkButton} to={`/items/${occupiedCycle.itemId}`}>
              查看占用事项
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <Link className={styles.itemLink} to={`/items/${item.id}`}>
              <span>
                <small>所属事项</small>
                <strong>{item.title}</strong>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
            <ExperimentPeriod endDate={endDate} startDate={startDate} />
            <TextArea
              fieldClassName={styles.coreField}
              label="本轮唯一验证问题"
              maxLength={300}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：每天写 10 分钟是否能让我更稳定？"
              prefix="01"
              required
              value={question}
            />
            <TextArea
              fieldClassName={styles.coreField}
              label="每天／本周具体做什么"
              maxLength={500}
              onChange={(event) => setActionPlan(event.target.value)}
              placeholder="例如：每天晚饭后打开文档，写一个 100 字片段"
              prefix="02"
              required
              value={actionPlan}
            />
            <TextArea
              fieldClassName={styles.coreField}
              label="判断有效实践日的最低标准"
              maxLength={240}
              onChange={(event) => setMinimumStandard(event.target.value)}
              placeholder="例如：打开文档并写满 5 分钟"
              prefix="03"
              required
              value={minimumStandard}
            />
            <details className={styles.optional}>
              <summary>
                <span className={styles.optionalTitle}><span>04</span>补充更多</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className={styles.optionalFields}>
                <TextArea
                  fieldClassName={styles.optionalField}
                  label="适合时希望看到什么"
                  maxLength={500}
                  onChange={(event) => setPositiveSignals(event.target.value)}
                  placeholder="例如：开始阻力变小，写完后更清醒，能积累素材"
                  value={positiveSignals}
                />
                <TextArea
                  fieldClassName={styles.optionalField}
                  label="不适合时可能出现什么"
                  maxLength={500}
                  onChange={(event) => setNegativeSignals(event.target.value)}
                  placeholder="例如：持续抗拒、明显消耗、挤占更重要的事"
                  value={negativeSignals}
                />
                <TextArea
                  fieldClassName={styles.optionalField}
                  label="理想行动标准"
                  maxLength={240}
                  onChange={(event) => setIdealStandard(event.target.value)}
                  placeholder="例如：写满 20 分钟并整理一个可复用片段"
                  value={idealStandard}
                />
              </div>
            </details>
            {error ? <InlineError>{error}</InlineError> : null}
            <div className={styles.actions}>
              <Link className={styles.linkButton} to={`/items/${item.id}`}>
                取消
              </Link>
              <Button type="submit">创建 7 天实践</Button>
            </div>
          </form>
        )}
      </Card>
    </>
  )
}
