import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { refreshTemporalState } from '../domain/transitions'
import type { LifeLabState } from '../domain/types'
import { deleteAllData, loadState, saveState, type LoadResult, type SaveResult } from '../storage'

type AppStatus = 'loading' | 'ready' | 'load_error'

type AppState = {
  status: AppStatus
  state: LifeLabState | null
  loadResult: LoadResult | null
  lastSaveResult: SaveResult | null
}

type LifeLabAction =
  | { type: 'loaded'; result: LoadResult }
  | { type: 'replace_state'; next: LifeLabState; saveResult: SaveResult }
  | { type: 'refresh_temporal'; now: Date }
  | { type: 'mark_local_notice_seen'; now: Date; saveResult: SaveResult }
  | { type: 'delete_all'; next: LifeLabState; saveResult: SaveResult }

type LifeLabContextValue = AppState & {
  deleteAll: () => SaveResult
  markLocalNoticeSeen: () => SaveResult
  replaceState: (next: LifeLabState) => SaveResult
  refreshNow: (now?: Date) => void
}

const LifeLabContext = createContext<LifeLabContextValue | null>(null)

const initialState: AppState = {
  status: 'loading',
  state: null,
  loadResult: null,
  lastSaveResult: null,
}

export function LifeLabProvider({ children }: { children: ReactNode }) {
  const [appState, dispatch] = useReducer(lifeLabReducer, initialState)

  useEffect(() => {
    const result = loadState()
    dispatch({ type: 'loaded', result })
  }, [])

  useEffect(() => {
    const refresh = () => dispatch({ type: 'refresh_temporal', now: new Date() })
    window.addEventListener('visibilitychange', refresh)
    const timerId = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener('visibilitychange', refresh)
      window.clearInterval(timerId)
    }
  }, [])

  const replaceState = useCallback((next: LifeLabState): SaveResult => {
    const saveResult = saveState(next)
    dispatch({ type: 'replace_state', next, saveResult })
    return saveResult
  }, [])

  const markLocalNoticeSeen = useCallback((): SaveResult => {
    if (!appState.state) {
      return { ok: false, reason: 'write_failed', message: 'state is not ready' }
    }
    const now = new Date()
    const next: LifeLabState = {
      ...appState.state,
      meta: {
        ...appState.state.meta,
        hasSeenLocalDataNotice: true,
        updatedAt: now.toISOString(),
      },
    }
    const saveResult = saveState(next)
    dispatch({ type: 'mark_local_notice_seen', now, saveResult })
    return saveResult
  }, [appState.state])

  const deleteAll = useCallback((): SaveResult => {
    const now = new Date()
    const next = deleteAllData(undefined, now)
    const saveResult = saveState(next)
    dispatch({ type: 'delete_all', next, saveResult })
    return saveResult
  }, [])

  const refreshNow = useCallback((now = new Date()) => {
    dispatch({ type: 'refresh_temporal', now })
  }, [])

  const value = useMemo(
    () => ({ ...appState, deleteAll, markLocalNoticeSeen, replaceState, refreshNow }),
    [appState, deleteAll, markLocalNoticeSeen, replaceState, refreshNow],
  )

  return <LifeLabContext.Provider value={value}>{children}</LifeLabContext.Provider>
}

export function useLifeLab() {
  const context = useContext(LifeLabContext)
  if (!context) {
    throw new Error('useLifeLab must be used within LifeLabProvider')
  }
  return context
}

export function lifeLabReducer(state: AppState, action: LifeLabAction): AppState {
  switch (action.type) {
    case 'loaded':
      return action.result.ok
        ? {
            status: 'ready',
            state: refreshTemporalState(action.result.state),
            loadResult: action.result,
            lastSaveResult: null,
          }
        : {
            status: 'load_error',
            state: null,
            loadResult: action.result,
            lastSaveResult: null,
          }

    case 'replace_state':
      return action.saveResult.ok
        ? { ...state, state: action.next, status: 'ready', lastSaveResult: action.saveResult }
        : { ...state, lastSaveResult: action.saveResult }

    case 'refresh_temporal':
      return state.state
        ? { ...state, state: refreshTemporalState(state.state, action.now) }
        : state

    case 'mark_local_notice_seen':
      if (!state.state || !action.saveResult.ok) {
        return { ...state, lastSaveResult: action.saveResult }
      }
      return {
        ...state,
        state: {
          ...state.state,
          meta: {
            ...state.state.meta,
            hasSeenLocalDataNotice: true,
            updatedAt: action.now.toISOString(),
          },
        },
        lastSaveResult: action.saveResult,
      }

    case 'delete_all':
      return action.saveResult.ok
        ? { ...state, status: 'ready', state: action.next, lastSaveResult: action.saveResult }
        : { ...state, lastSaveResult: action.saveResult }
  }
}
