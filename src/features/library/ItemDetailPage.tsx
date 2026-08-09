import { Link, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { StatusBadge, TrackBadge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import {
  selectCyclesByItem,
  selectItemById,
  selectOpenCycleByTrack,
  selectOpenCycleForItem,
} from '../../domain/selectors'
import styles from './ItemDetailPage.module.css'

export function ItemDetailPage() {
  const { itemId } = useParams()
  const { state } = useLifeLab()

  if (!state || !itemId) {
    return null
  }

  const item = selectItemById(state, itemId)
  if (!item) {
    return (
      <>
        <AppHeader backTo="/library" title="记录不存在" eyebrow="总库" />
        <Card className={styles.section}>
          <p>这条记录不存在或已删除。</p>
        </Card>
      </>
    )
  }

  const cycles = selectCyclesByItem(state, item.id)
  const openCycle = selectOpenCycleForItem(state, item.id)
  const trackCycle = selectOpenCycleByTrack(state, item.track)
  const isTrackOccupiedByOther = Boolean(trackCycle && trackCycle.itemId !== item.id)
  const reviewsByCycleId = new Map(state.reviews.map((review) => [review.cycleId, review]))

  return (
    <>
      <AppHeader backTo="/library" title={item.title} eyebrow="事项详情" />
      <div className={styles.stack}>
        <Card className={styles.section}>
          <div className={styles.meta}>
            <TrackBadge track={item.track} />
            <StatusBadge status={item.status} />
          </div>
          <p>{item.why || '还没有填写为什么想做。'}</p>
          <p>{item.question || '还没有填写长期想验证的问题。'}</p>
        </Card>

        <Card className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>当前周期</h2>
            <Link className={styles.textAction} to={`/items/${item.id}/edit`}>
              编辑
            </Link>
          </div>
          {openCycle ? (
            <div className={styles.cycleSummary}>
              <strong>第 {openCycle.cycleNumber} 轮</strong>
              <span>
                {openCycle.startDate} 至 {openCycle.endDate}
              </span>
              <span>{openCycle.status}</span>
            </div>
          ) : (
            <p>{isTrackOccupiedByOther ? '同方向已有未完成周期。' : '当前没有未完成周期。'}</p>
          )}
        </Card>

        <Card className={styles.section}>
          <h2>历史周期</h2>
          {cycles.length ? (
            <div className={styles.cycleList}>
              {cycles.map((cycle) => {
                const review = reviewsByCycleId.get(cycle.id)
                return (
                  <section className={styles.cycleItem} key={cycle.id}>
                    <p>
                      第 {cycle.cycleNumber} 轮：{cycle.startDate} 至 {cycle.endDate}，{cycle.status}
                    </p>
                    {review ? <p className={styles.reviewConclusion}>{review.conclusion}</p> : null}
                  </section>
                )
              })}
            </div>
          ) : (
            <p>还没有历史周期。</p>
          )}
        </Card>
      </div>
    </>
  )
}
