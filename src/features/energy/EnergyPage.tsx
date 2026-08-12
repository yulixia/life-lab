import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BatteryCharging,
  Brain,
  CalendarDays,
  CloudLightning,
  CloudRain,
  Coffee,
  Flame,
  Flower2,
  Frown,
  Heart,
  Leaf,
  Moon,
  Music,
  Plus,
  Smile,
  Sparkles,
  Sun,
  Umbrella,
  Waves,
  Zap,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Card } from '../../components/Card'
import { useLifeLab } from '../../app/LifeLabContext'
import { selectRecentEnergy, selectTopFeelingTags } from '../../domain/selectors'
import type { EnergyCategory, EnergyEntry } from '../../domain/types'
import styles from './EnergyPage.module.css'

type ColumnMode = EnergyCategory

const categoryMeta: Record<EnergyCategory, {
  Icon: typeof Sparkles
  action: string
  label: string
  toneClass: string
}> = {
  energy: {
    Icon: Sparkles,
    action: '补充感',
    label: '有能量',
    toneClass: styles.energyTone,
  },
  drain: {
    Icon: CloudRain,
    action: '消耗感',
    label: '被消耗',
    toneClass: styles.drainTone,
  },
}

const entryIcons: Record<EnergyCategory, Array<typeof Sparkles>> = {
  energy: [Sparkles, Sun, Coffee, Flame, Zap, Music, Flower2, Smile, Heart, Leaf, BatteryCharging],
  drain: [CloudRain, CloudLightning, Umbrella, Moon, Frown, Waves, Brain],
}

export function EnergyPage() {
  const { state } = useLifeLab()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('type') === 'drain' ? 'drain' : 'energy'
  const [columnMode, setColumnMode] = useState<ColumnMode>(initialMode)

  const energyEntries = useMemo(() => (state ? selectRecentEnergy(state, 'energy', 1000) : []), [state])
  const drainEntries = useMemo(() => (state ? selectRecentEnergy(state, 'drain', 1000) : []), [state])
  const topEnergyTags = useMemo(() => (state ? selectTopFeelingTags(state, 'energy') : []), [state])
  const topDrainTags = useMemo(() => (state ? selectTopFeelingTags(state, 'drain') : []), [state])

  if (!state) {
    return null
  }

  return (
    <>
      <AppHeader
        action={
          <Link className={styles.headerAction} to="/energy/new">
            <Plus aria-hidden="true" size={16} strokeWidth={2.8} />
            记录情绪
          </Link>
        }
        title="情绪"
      />
      <div className={styles.listPage}>
        <div className={styles.fixedContent}>
          <div className={styles.summary}>
            <Card className={`${styles.summaryCard} ${styles.energyTone}`}>
              <div className={styles.summaryHeader}>
                <span className={styles.iconBadge}>
                  <Sparkles aria-hidden="true" size={17} strokeWidth={2.6} />
                </span>
                <h2>有能量</h2>
              </div>
              <strong>{energyEntries.length}</strong>
              <TagSummary tags={topEnergyTags} />
            </Card>
            <Card className={`${styles.summaryCard} ${styles.drainTone}`}>
              <div className={styles.summaryHeader}>
                <span className={styles.iconBadge}>
                  <CloudRain aria-hidden="true" size={17} strokeWidth={2.6} />
                </span>
                <h2>被消耗</h2>
              </div>
              <strong>{drainEntries.length}</strong>
              <TagSummary tags={topDrainTags} />
            </Card>
          </div>

          <fieldset className={styles.mobileSwitch}>
            <legend>列表</legend>
            <div className={styles.switchOptions}>
              {(['energy', 'drain'] as const).map((value) => {
                const { Icon, label, toneClass } = categoryMeta[value]
                return (
                  <button
                    aria-pressed={columnMode === value}
                    className={toneClass}
                    key={value}
                    onClick={() => setColumnMode(value)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={15} strokeWidth={2.7} />
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.columns}>
            <EnergyColumn
              category="energy"
              entries={energyEntries}
              isVisibleOnMobile={columnMode === 'energy'}
            />
            <EnergyColumn
              category="drain"
              entries={drainEntries}
              isVisibleOnMobile={columnMode === 'drain'}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function TagSummary({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <span className={styles.tag}>暂无标签</span>
  }
  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <span className={styles.tag} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function EnergyColumn({
  category,
  entries,
  isVisibleOnMobile,
}: {
  category: EnergyCategory
  entries: EnergyEntry[]
  isVisibleOnMobile: boolean
}) {
  const { Icon, action, label, toneClass } = categoryMeta[category]
  return (
    <section className={`${styles.column} ${toneClass} ${isVisibleOnMobile ? '' : styles.hideMobile}`}>
      <h2>
        <Icon aria-hidden="true" size={17} strokeWidth={2.7} />
        {label}
        <span>{action}</span>
      </h2>
      {entries.length ? (
        entries.map((entry) => <EnergySummary entry={entry} key={entry.id} />)
      ) : (
        <Card className={styles.entry}>
          <p>暂无记录。</p>
        </Card>
      )}
    </section>
  )
}

function EnergySummary({ entry }: { entry: EnergyEntry }) {
  const summary = entry.scene || entry.reason || entry.reflection || '没有补充说明。'
  const { toneClass } = categoryMeta[entry.category]
  const Icon = pickEntryIcon(entry)
  return (
    <Link className={styles.entryLink} to={`/energy/${entry.id}`}>
      <Card className={`${styles.entry} ${toneClass}`}>
        <div className={styles.entryHeader}>
          <span className={styles.iconBadge}>
            <Icon aria-hidden="true" size={16} strokeWidth={2.7} />
          </span>
          <h3>{entry.event}</h3>
          <span className={styles.deltaTag}>{entry.energyDelta > 0 ? `+${entry.energyDelta}` : entry.energyDelta}</span>
        </div>
        <p className={styles.summaryText}>{summary}</p>
        <div className={styles.entryFooter}>
          <div className={styles.tagList}>
            {entry.feelingTags.slice(0, 4).map((tag) => (
              <span className={styles.tag} key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <span className={styles.time}>
            <CalendarDays aria-hidden="true" size={13} strokeWidth={2.5} />
            {new Date(entry.occurredAt).toLocaleDateString()}
          </span>
        </div>
      </Card>
    </Link>
  )
}

function pickEntryIcon(entry: EnergyEntry) {
  const icons = entryIcons[entry.category]
  const seed = `${entry.id}-${entry.event}-${entry.occurredAt}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647
  }
  return icons[hash % icons.length]
}
