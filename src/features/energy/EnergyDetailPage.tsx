import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { InlineError } from '../../components/InlineError'
import { useLifeLab } from '../../app/LifeLabContext'
import { deleteEnergyEntry } from '../../domain/transitions'
import { DomainError, type EnergyEntry } from '../../domain/types'
import styles from './EnergyDetailPage.module.css'

const categoryLabels: Record<EnergyEntry['category'], string> = {
  energy: '有能量',
  drain: '被消耗',
}

export function EnergyDetailPage() {
  const navigate = useNavigate()
  const { entryId } = useParams()
  const { replaceState, state } = useLifeLab()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!state || !entryId) {
    return null
  }

  const entry = state.energyEntries.find((candidate) => candidate.id === entryId)
  if (!entry) {
    return <Navigate to="/energy" replace />
  }

  const handleDelete = () => {
    setError(null)
    try {
      const next = deleteEnergyEntry(state, entry.id, new Date())
      const saveResult = replaceState(next)
      if (!saveResult.ok) {
        setError(saveResult.message)
        return
      }
      navigate(`/energy?type=${entry.category}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof DomainError ? caught.message : '删除失败')
    }
  }

  return (
    <>
      <AppHeader backTo="/energy" title="情绪详情" eyebrow={categoryLabels[entry.category]} />
      <div className={styles.stack}>
        <Card className={`${styles.section} ${entry.category === 'energy' ? styles.energyTone : styles.drainTone}`}>
          <div className={styles.meta}>
            <span className={styles.tag}>{categoryLabels[entry.category]}</span>
            <span className={styles.deltaTag} data-intensity={Math.abs(entry.energyDelta)}>
              {entry.energyDelta > 0 ? `+${entry.energyDelta}` : entry.energyDelta}
            </span>
          </div>
          <h2>{entry.event}</h2>
          <p>{new Date(entry.occurredAt).toLocaleString()}</p>
          {entry.scene ? <DetailBlock label="场景" value={entry.scene} /> : null}
          {entry.feelingTags.length ? (
            <div className={styles.tagList}>
              {entry.feelingTags.map((tag) => (
                <span className={styles.tag} key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {entry.reason ? <DetailBlock label="原因" value={entry.reason} /> : null}
          {entry.reflection ? <DetailBlock label="补充观察" value={entry.reflection} /> : null}
          {error ? <InlineError>{error}</InlineError> : null}
        </Card>

        <div className={styles.actions}>
          <Button onClick={() => setConfirmOpen(true)} variant="danger">
            删除
          </Button>
          <Link className={styles.linkButton} to={`/energy/${entry.id}/edit`}>
            编辑
          </Link>
        </div>
      </div>
      <ConfirmDialog
        confirmLabel="删除"
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="删除这条情绪？"
      >
        <p>删除后无法恢复。</p>
      </ConfirmDialog>
    </>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className={styles.detailBlock}>
      <h3>{label}</h3>
      <p>{value}</p>
    </section>
  )
}
