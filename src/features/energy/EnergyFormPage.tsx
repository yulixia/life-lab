import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CloudRain, Sparkles } from 'lucide-react'
import { SubpageHeader } from '../../components/SubpageHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EnergyScale } from '../../components/EnergyScale'
import { InlineError } from '../../components/InlineError'
import { TagPicker } from '../../components/TagPicker'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { useLifeLab } from '../../app/LifeLabContext'
import { saveEnergyEntry } from '../../domain/transitions'
import { DomainError, type EnergyCategory, type EnergyDelta } from '../../domain/types'
import styles from './EnergyFormPage.module.css'

const feelingOptions = ['轻松', '清醒', '稳定', '兴奋', '疲惫', '焦虑', '烦躁', '卡住']

function initialEnergyDelta(entry?: { category: EnergyCategory; energyDelta: EnergyDelta } | null): EnergyDelta {
  return entry?.energyDelta ?? (entry?.category === 'drain' ? -1 : 1)
}

function toLocalInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

type EnergyFormPageProps = {
  mode: 'new' | 'edit'
}

export function EnergyFormPage({ mode }: EnergyFormPageProps) {
  const navigate = useNavigate()
  const { entryId } = useParams()
  const { replaceState, state } = useLifeLab()

  const editing = mode === 'edit' ? state?.energyEntries.find((entry) => entry.id === entryId) : null
  const [category, setCategory] = useState<EnergyCategory>(editing?.category ?? 'energy')
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue(editing ? new Date(editing.occurredAt) : undefined))
  const [scene, setScene] = useState(editing?.scene ?? '')
  const [event, setEvent] = useState(editing?.event ?? '')
  const [feelingTags, setFeelingTags] = useState<string[]>(editing?.feelingTags ?? [])
  const [energyDelta, setEnergyDelta] = useState<EnergyDelta>(initialEnergyDelta(editing))
  const [reason, setReason] = useState(editing?.reason ?? '')
  const [reflection, setReflection] = useState(editing?.reflection ?? '')
  const [additionalOpen, setAdditionalOpen] = useState(Boolean(editing?.scene || editing?.reason || editing?.reflection))
  const [error, setError] = useState<string | null>(null)

  if (!state) {
    return null
  }

  if (mode === 'edit' && !editing) {
    return <Navigate to="/energy" replace />
  }

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    setError(null)
    try {
      const next = saveEnergyEntry(
        state,
        {
          id: editing?.id,
          category,
          occurredAt: new Date(occurredAt).toISOString(),
          scene,
          event,
          feelingTags,
          energyDelta,
          reason,
          reflection,
        },
        new Date(),
        () => crypto.randomUUID(),
      )
      const saveResult = replaceState(next)
      if (!saveResult.ok) {
        setError(saveResult.message)
        return
      }
      navigate(`/energy?type=${category}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '保存情绪失败')
    }
  }

  const selectCategory = (nextCategory: EnergyCategory) => {
    setCategory(nextCategory)
    setEnergyDelta((current) => {
      if (nextCategory === 'energy') {
        return current > 0 ? current : 1
      }
      return current < 0 ? current : -1
    })
  }

  const handleEnergyDeltaChange = (nextDelta: EnergyDelta) => {
    setEnergyDelta(nextDelta)
    if (nextDelta > 0) {
      setCategory('energy')
    }
    if (nextDelta < 0) {
      setCategory('drain')
    }
  }

  const toneClass = category === 'energy' ? styles.energyTone : styles.drainTone

  return (
    <>
      <SubpageHeader
        backTo="/energy"
        context={category === 'energy' ? '有能量' : '被消耗'}
        title={mode === 'edit' ? '编辑记录' : '记录一件事'}
      />
      <Card className={`${styles.formCard} ${toneClass}`}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.sectionIntro}>
            <h2>快速记录</h2>
            <p>先抓住这件事本身，后面想补再补。</p>
          </div>
          <fieldset className={styles.choiceGroup}>
            <legend>这件事主要属于哪一类？</legend>
            <div className={styles.choiceGrid}>
              <button
                aria-pressed={category === 'energy'}
                className={styles.energyChoice}
                onClick={() => selectCategory('energy')}
                type="button"
              >
                <Sparkles aria-hidden="true" size={18} strokeWidth={2.7} />
                <span>有能量</span>
              </button>
              <button
                aria-pressed={category === 'drain'}
                className={styles.drainChoice}
                onClick={() => selectCategory('drain')}
                type="button"
              >
                <CloudRain aria-hidden="true" size={18} strokeWidth={2.7} />
                <span>被消耗</span>
              </button>
            </div>
          </fieldset>
          <TextArea
            label="发生了什么？"
            maxLength={240}
            onChange={(changeEvent) => setEvent(changeEvent.target.value)}
            placeholder="例如：和朋友聊完一个想法后变得很兴奋"
            required
            value={event}
          />
          <TagPicker label="感受标签" onChange={setFeelingTags} options={feelingOptions} value={feelingTags} />
          <EnergyScale
            label="这件事让你更有能量还是更消耗？"
            name="energyDelta"
            onChange={handleEnergyDeltaChange}
            value={energyDelta}
          />
          <details className={styles.optional} onToggle={(event) => setAdditionalOpen(event.currentTarget.open)} open={additionalOpen}>
            <summary>补充更多</summary>
            <div className={styles.optionalFields}>
              <TextField
                label="发生时间"
                max={toLocalInputValue()}
                onChange={(changeEvent) => setOccurredAt(changeEvent.target.value)}
                placeholder="默认使用当前时间"
                type="datetime-local"
                value={occurredAt}
              />
              <TextField
                label="场景"
                maxLength={80}
                onChange={(changeEvent) => setScene(changeEvent.target.value)}
                placeholder="例如：家里、通勤路上、会议后"
                value={scene}
              />
              <TextArea
                label="原因"
                maxLength={240}
                onChange={(changeEvent) => setReason(changeEvent.target.value)}
                placeholder="具体是哪一部分让你有这种感觉？"
                value={reason}
              />
              <TextArea
                label="补充观察"
                maxLength={500}
                onChange={(changeEvent) => setReflection(changeEvent.target.value)}
                placeholder="例如：我好像更适合先讨论再独自整理"
                value={reflection}
              />
            </div>
          </details>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className={styles.actions}>
            <Link className={styles.cancelLink} to="/energy">
              取消
            </Link>
            <Button type="submit">{mode === 'edit' ? '保存修改' : '保存记录'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
