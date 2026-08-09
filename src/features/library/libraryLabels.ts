import type { ItemStatus, Track } from '../../domain/types'

export const trackLabels: Record<Track, string> = {
  ideal_self: '理想自我',
  side_hustle: '副业探索',
}

export const statusLabels: Record<ItemStatus, string> = {
  exploring: '待探索',
  active: '进行中',
  review_due: '待复盘',
  long_term: '长期进行',
  archived: '已归档',
}
