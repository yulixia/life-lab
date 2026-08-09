import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EnergyScale } from '../../components/EnergyScale'
import { InlineError } from '../../components/InlineError'
import { SelectField } from '../../components/SelectField'
import { TagPicker } from '../../components/TagPicker'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { useLifeLab } from '../../app/LifeLabContext'
import { canRecordCycleDate, todayLocalDate } from '../../domain/dates'
import { selectDailyEntry, selectEffectiveCyclePlan } from '../../domain/selectors'
import { addCycleAdjustment, saveDailyEntry } from '../../domain/transitions'
import { DomainError, type MissReason } from '../../domain/types'
import styles from './CheckInPage.module.css'

const feelingOptions = ['轻松', '清醒', '稳定', '兴奋', '疲惫', '焦虑', '烦躁', '卡住']

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
  const [status, setStatus] = useState<'practiced' | 'not_practiced'>(existing?.status ?? initialStatus)
  const [actionSummary, setActionSummary] = useState(existing?.actionSummary ?? '')
  const [durationMinutes, setDurationMinutes] = useState(existing?.durationMinutes?.toString() ?? '')
  const [feelingTags, setFeelingTags] = useState<string[]>(existing?.feelingTags ?? [])
  const [energyDelta, setEnergyDelta] = useState(existing?.energyDelta ?? 0)
  const [observation, setObservation] = useState(existing?.observation ?? '')
  const [missReason, setMissReason] = useState<MissReason | ''>(existing?.missReason ?? '')
  const [adjustActionPlan, setAdjustActionPlan] = useState('')
  const [adjustMinimumStandard, setAdjustMinimumStandard] = useState('')
  const [adjustIdealStandard, setAdjustIdealStandard] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!state || !cycleId) {
    return null
  }

  if (!cycle || !plan) {
    return <Navigate to="/today" replace />
  }

  const item = state.items.find((candidate) => candidate.id === cycle.itemId)
  const recordable = canRecordCycleDate(cycle, date, todayLocalDate())

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      let next = saveDailyEntry(
        state,
        {
          cycleId: cycle.id,
          date,
          status,
          actionSummary,
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
          feelingTags,
          energyDelta,
          observation,
          missReason: status === 'not_practiced' ? missReason || undefined : undefined,
        },
        new Date(),
        () => crypto.randomUUID(),
      )
      if (adjustActionPlan.trim() || adjustMinimumStandard.trim() || adjustIdealStandard.trim()) {
        next = addCycleAdjustment(
          next,
          {
            cycleId: cycle.id,
            effectiveFrom: date,
            actionPlan: adjustActionPlan,
            minimumStandard: adjustMinimumStandard,
            idealStandard: adjustIdealStandard,
          },
          new Date(),
          () => crypto.randomUUID(),
        )
      }
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
      <AppHeader backTo="/today" title="每日记录" eyebrow={item?.title ?? '实践'} />
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
              <h2>{date}</h2>
              <p>行动计划：{plan.actionPlan}</p>
              <p>最低标准：{plan.minimumStandard}</p>
            </div>
            <SelectField
              label="今天达到最低标准了吗？"
              onChange={(event) => setStatus(event.target.value as 'practiced' | 'not_practiced')}
              value={status}
            >
              <option value="practiced">有效实践</option>
              <option value="not_practiced">未实践</option>
            </SelectField>
            {status === 'practiced' ? (
              <>
                <TextArea
                  label="行动摘要"
                  maxLength={500}
                  onChange={(event) => setActionSummary(event.target.value)}
                  required
                  value={actionSummary}
                />
                <TextField
                  label="时长（分钟）"
                  max="1440"
                  min="0"
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  type="number"
                  value={durationMinutes}
                />
                <TagPicker label="感受标签" onChange={setFeelingTags} options={feelingOptions} value={feelingTags} />
                <EnergyScale label="能量变化" name="energyDelta" onChange={setEnergyDelta} value={energyDelta} />
                <TextArea
                  label="观察"
                  maxLength={500}
                  onChange={(event) => setObservation(event.target.value)}
                  value={observation}
                />
              </>
            ) : (
              <SelectField
                label="未实践原因"
                onChange={(event) => setMissReason(event.target.value as MissReason | '')}
                value={missReason}
              >
                <option value="">不填写</option>
                <option value="busy">忙碌</option>
                <option value="low_energy">低能量</option>
                <option value="forgot">忘记</option>
                <option value="blocked">被阻塞</option>
                <option value="unwell">身体不适</option>
                <option value="not_priority">不是优先级</option>
                <option value="other">其他</option>
              </SelectField>
            )}
            <TextArea
              label="调整后的行动计划"
              maxLength={500}
              onChange={(event) => setAdjustActionPlan(event.target.value)}
              value={adjustActionPlan}
            />
            <TextArea
              label="调整后的最低标准"
              maxLength={240}
              onChange={(event) => setAdjustMinimumStandard(event.target.value)}
              value={adjustMinimumStandard}
            />
            <TextArea
              label="调整后的理想标准"
              maxLength={240}
              onChange={(event) => setAdjustIdealStandard(event.target.value)}
              value={adjustIdealStandard}
            />
            {error ? <InlineError>{error}</InlineError> : null}
            <div className={styles.actions}>
              <Link className={styles.linkButton} to="/today">
                取消
              </Link>
              <Button type="submit">保存记录</Button>
            </div>
          </form>
        )}
      </Card>
    </>
  )
}
