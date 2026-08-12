import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SubpageHeader } from '../../components/SubpageHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { InlineError } from '../../components/InlineError'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectItemById, selectOpenCycleForItem } from '../../domain/selectors'
import {
  createLifeItem,
  findDuplicateItemTitle,
  updateLifeItem,
  type SaveItemInput,
} from '../../domain/transitions'
import { DomainError, type Track } from '../../domain/types'
import { trackLabels } from './libraryLabels'
import styles from './ItemFormPage.module.css'

type ItemFormPageProps = {
  mode: 'new' | 'edit'
}

export function ItemFormPage({ mode }: ItemFormPageProps) {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const item = state && itemId ? selectItemById(state, itemId) : null
  const openCycle = state && itemId ? selectOpenCycleForItem(state, itemId) : null
  const isEdit = mode === 'edit'
  const [title, setTitle] = useState(isEdit ? (item?.title ?? '') : '')
  const [track, setTrack] = useState<Track>(isEdit ? (item?.track ?? 'ideal_self') : 'ideal_self')
  const [why, setWhy] = useState(isEdit ? (item?.why ?? '') : '')
  const [question, setQuestion] = useState(isEdit ? (item?.question ?? '') : '')
  const [error, setError] = useState<string | null>(null)

  const duplicate = useMemo(() => {
    if (!state) {
      return null
    }
    return findDuplicateItemTitle(state, { title, track }, isEdit ? itemId : undefined)
  }, [isEdit, itemId, state, title, track])

  if (!state) {
    return null
  }

  if (isEdit && !item) {
    return <Navigate to="/library" replace />
  }

  const canChangeTrack = !openCycle
  const submitLabel = isEdit ? '保存修改' : '放入总库'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const input: SaveItemInput = { title, track, why, question }
    try {
      const next = isEdit && itemId
        ? updateLifeItem(state, itemId, input, new Date())
        : createLifeItem(state, input, new Date(), () => crypto.randomUUID())
      const saveResult = replaceState(next)
      if (!saveResult.ok) {
        setError(saveResult.message)
        return
      }
      navigate(isEdit && itemId ? `/items/${itemId}` : '/library', { replace: true })
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '保存失败')
    }
  }

  return (
    <>
      <SubpageHeader
        backTo={isEdit && itemId ? `/items/${itemId}` : '/library'}
        context={trackLabels[track]}
        title={isEdit ? '编辑事项' : '新建事项'}
      />
      <Card>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.sectionIntro}>
            <h2>候选想法</h2>
            <p>先把想法收进总库，不必马上开始实践。</p>
          </div>
          <TextField
            label="标题"
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：连续早起写作、做一个小红书账号"
            required
            value={title}
          />
          <fieldset className={styles.choiceGroup} disabled={!canChangeTrack}>
            <legend>方向</legend>
            <div className={styles.choiceGrid}>
              {Object.entries(trackLabels).map(([value, label]) => (
                <button
                  aria-pressed={track === value}
                  key={value}
                  onClick={() => setTrack(value as Track)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {!canChangeTrack ? <p className={styles.warning}>已有未完成周期时不能修改方向。</p> : null}
          {duplicate ? <p className={styles.warning}>同方向已有同名事项，仍可继续保存。</p> : null}
          <details className={styles.optional} open={Boolean(why || question)}>
            <summary>补充想法</summary>
            <div className={styles.optionalFields}>
              <TextArea
                label="为什么想做"
                maxLength={500}
                onChange={(event) => setWhy(event.target.value)}
                placeholder="例如：想验证自己是否真的享受表达，而不只是羡慕别人"
                value={why}
              />
              <TextArea
                label="长期想验证的问题"
                maxLength={300}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：这件事能否让我更稳定、更有能量，或带来真实机会？"
                value={question}
              />
            </div>
          </details>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className={styles.actions}>
            <Link className={styles.linkButton} to={isEdit && itemId ? `/items/${itemId}` : '/library'}>
              取消
            </Link>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
