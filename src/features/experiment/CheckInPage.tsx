import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EnergyScale } from '../../components/EnergyScale'
import { InlineError } from '../../components/InlineError'
import { TagPicker } from '../../components/TagPicker'
import { TextArea } from '../../components/TextArea'
import { useLifeLab } from '../../app/LifeLabContext'
import { canRecordCycleDate, todayLocalDate } from '../../domain/dates'
import { selectDailyEntry, selectEffectiveCyclePlan } from '../../domain/selectors'
import { saveDailyEntry } from '../../domain/transitions'
import { DomainError, type MissReason } from '../../domain/types'
import styles from './CheckInPage.module.css'

const feelingOptions = ['轻松', '清醒', '稳定', '兴奋', '疲惫', '焦虑', '烦躁', '卡住']
const missReasonOptions = ['忙碌', '低能量', '忘记', '被阻塞', '身体不适', '优先级靠后']
const legacyMissReasonLabels: Record<MissReason, string> = {
  busy: '忙碌',
  low_energy: '低能量',
  forgot: '忘记',
  blocked: '被阻塞',
  unwell: '身体不适',
  not_priority: '优先级靠后',
  other: '其他',
}

export function CheckInPage() {
  const { cycleId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const date = searchParams.get('date') || todayLocalDate()
  const initialStatus = searchParams.get('status') === 'not_practiced' ? 'not_practiced' : 'practiced'
  const cycle = state?.cycles.find((candidate) => candidate.id === cycleId)
  const existing = state && cycleId ? selectDailyEntry(state, cycleId, date) : null
  const plan = useMemo(() => (cycle ? selectEffectiveCyclePlan(cycle, date) : null), [cycle, date])
  const status = existing?.status ?? initialStatus
  const [actionSummary, setActionSummary] = useState(existing?.actionSummary ?? '')
  const [feelingTags, setFeelingTags] = useState<string[]>(existing?.feelingTags ?? [])
  const [energyDelta, setEnergyDelta] = useState(existing?.energyDelta ?? 0)
  const [observation, setObservation] = useState(existing?.observation ?? '')
  const [missReasonTags, setMissReasonTags] = useState<string[]>(existing?.missReasonTags ?? (existing?.missReason ? [legacyMissReasonLabels[existing.missReason]] : []))
  const [missReasonOther, setMissReasonOther] = useState(existing?.missReasonOther ?? '')
  const [additionalOpen, setAdditionalOpen] = useState(Boolean(existing?.feelingTags.length || existing?.energyDelta || existing?.observation))
  const [error, setError] = useState<string | null>(null)

  if (!state || !cycleId) {
    return null
  }

  if (!cycle || !plan) {
    return <Navigate to="/today" replace />
  }

  const item = state.items.find((candidate) => candidate.id === cycle.itemId)
  const recordable = canRecordCycleDate(cycle, date, todayLocalDate())
  const isNotPracticed = status === 'not_practiced'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      const next = saveDailyEntry(
        state,
        {
          cycleId: cycle.id,
          date,
          status,
          actionSummary,
          feelingTags,
          energyDelta,
          observation,
          missReasonTags: isNotPracticed ? missReasonTags : undefined,
          missReasonOther: isNotPracticed ? missReasonOther : undefined,
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
      setError(caught instanceof DomainError ? caught.message : '保存记录失败')
    }
  }

  return (
    <>
      <AppHeader backTo="/today" title={isNotPracticed ? '标记未实践' : '每日记录'} eyebrow={item?.title ?? '实践'} />
      <Card>
        {!recordable ? (
          <div className={styles.plan}>
            <p>这个日期当前不可记录。</p>
            <Link className={styles.linkButton} to="/today">
              回到今日
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.plan}>
              <h2>{isNotPracticed ? '今天没有完成实践' : date}</h2>
              <p>行动计划：{plan.actionPlan}</p>
              <p>最低标准：{plan.minimumStandard}</p>
            </div>
            {!isNotPracticed ? (
              <>
                <TextArea
                  label="行动摘要"
                  maxLength={500}
                  onChange={(event) => setActionSummary(event.target.value)}
                  placeholder="例如：写了开头 120 字，记录了一个案例"
                  required
                  value={actionSummary}
                />
              </>
            ) : (
              <div className={styles.notPracticedFields}>
                <TagPicker label="未实践原因" onChange={setMissReasonTags} options={missReasonOptions} value={missReasonTags} />
                <TextArea
                  label="补充说明"
                  maxLength={500}
                  onChange={(event) => setMissReasonOther(event.target.value)}
                  placeholder="例如：临时会议延长到很晚，回家后没有精力开始"
                  value={missReasonOther}
                />
              </div>
            )}
            {!isNotPracticed ? (
              <details
                className={styles.optional}
                onToggle={(event) => setAdditionalOpen(event.currentTarget.open)}
                open={additionalOpen}
              >
                <summary>补充更多</summary>
                <div className={styles.optionalFields}>
                  <>
                    <TagPicker label="感受标签" onChange={setFeelingTags} options={feelingOptions} value={feelingTags} />
                    <EnergyScale label="能量变化" name="energyDelta" onChange={setEnergyDelta} value={energyDelta} />
                    <TextArea
                      label="观察"
                      maxLength={500}
                      onChange={(event) => setObservation(event.target.value)}
                      placeholder="例如：开始前很抗拒，但做 5 分钟后变顺了"
                      value={observation}
                    />
                  </>
                </div>
              </details>
            ) : null}
            {error ? <InlineError>{error}</InlineError> : null}
            <div className={styles.actions}>
              <Link className={styles.linkButton} to="/today">
                取消
              </Link>
              <Button type="submit">{isNotPracticed ? '保存未实践' : '保存记录'}</Button>
            </div>
          </form>
        )}
      </Card>
    </>
  )
}
