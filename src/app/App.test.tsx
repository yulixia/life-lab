import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { LifeLabProvider } from './LifeLabContext'

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LifeLabProvider>
        <App />
      </LifeLabProvider>
    </MemoryRouter>,
  )
}

describe('App routes', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('redirects the index route to today', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: '今日', level: 1 })).toBeInTheDocument()
  })

  it.each([
    ['/today', '今日'],
    ['/energy', '情绪'],
    ['/library', '总库'],
    ['/settings', '数据'],
  ])('renders %s', async (route, heading) => {
    renderAt(route)

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
  })

  it('sends unknown routes back to today', async () => {
    renderAt('/missing')

    expect(await screen.findByRole('heading', { name: '今日', level: 1 })).toBeInTheDocument()
  })

  it('shows and persists the local data notice before normal use', async () => {
    const user = userEvent.setup()
    renderAt('/today')

    expect(await screen.findByRole('dialog', { name: '数据只保存在这台设备' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始使用' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('life-lab:v1')).toContain('"hasSeenLocalDataNotice":true')
  })
})
