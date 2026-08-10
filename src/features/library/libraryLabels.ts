import type { ItemStatus, Track } from '../../domain/types'

export const trackLabels: Record<Track, string> = {
  ideal_self: '理想自我',
  side_hustle: '副业探索',
}

export const statusLabels: Record<ItemStatus, string> = {
  exploring: '待探索',
  active: '进行中',
  long_term: '长期进行',
  long_term_terminated: '长期已终止',
  terminated: '已终止',
  completed: '已完成',
  concluded: '已完结',
  archived: '已归档',
}
