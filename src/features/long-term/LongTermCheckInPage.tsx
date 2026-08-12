import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { SubpageHeader } from '../../components/SubpageHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { InlineError } from '../../components/InlineError'
import { TextArea } from '../../components/TextArea'
import { useLifeLab } from '../../app/LifeLabContext'
import { todayLocalDate } from '../../domain/dates'
import { selectItemById, selectLongTermEntry } from '../../domain/selectors'
import { saveLongTermEntry } from '../../domain/transitions'
import { DomainError } from '../../domain/types'
import styles from './LongTermCheckInPage.module.css'

export function LongTermCheckInPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { replaceState, state } = useLifeLab()
  const today = todayLocalDate()
  const item = state && itemId ? selectItemById(state, itemId) : null
  const existing = state && item ? selectLongTermEntry(state, item.id, today) : null
  const [note, setNote] = useState(existing?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!state || !itemId) return null
  if (!item || item.status !== 'long_term') return <Navigate to="/today" replace />

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      const saveResult = replaceState(saveLongTermEntry(state, { itemId: item.id, date: today, note }, new Date(), () => crypto.randomUUID()))
      if (!saveResult.ok) return setError(saveResult.message)
      navigate('/today', { replace: true })
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '保存长期记录失败')
    }
  }

  return (
    <>
      <SubpageHeader
        backTo="/today"
        context={item.track === 'ideal_self' ? '理想自我' : '副业探索'}
        title="完成今天"
      />
      <Card className={styles.card}>
        <div className={styles.summary}>
          <h2>{item.title}</h2>
          <p>{today} 会记为一个完成日。</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <TextArea label="备注" maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="可选，记录今天的一点感受或补充" value={note} />
          {error ? <InlineError>{error}</InlineError> : null}
          <div className={styles.actions}>
            <Link className={styles.cancel} to="/today">取消</Link>
            <Button type="submit">{existing ? '更新备注' : '完成今天'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
