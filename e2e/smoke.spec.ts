import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

function makeState(overrides: Record<string, unknown> = {}) {
  const instant = new Date().toISOString()
  return {
    schemaVersion: 2,
    meta: { createdAt: instant, updatedAt: instant, hasSeenLocalDataNotice: true },
    items: [],
    cycles: [],
    dailyEntries: [],
    reviews: [],
    longTermEntries: [],
    energyEntries: [],
    ...overrides,
  }
}

async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
}

test.describe('cross-browser smoke and accessibility', () => {
  test('renders primary pages without accessibility violations', async ({ page }) => {
    await page.goto('/today')
    await page.evaluate(
      (state) => window.localStorage.setItem('life-lab:v1', JSON.stringify(state)),
      makeState(),
    )
    for (const path of ['/today', '/energy', '/library', '/settings']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page)
      const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
      expect(results.violations).toEqual([])
    }
  })

  test('shows recoverable corrupt-data state without overwriting raw storage', async ({ page }) => {
    await page.goto('/today')
    await page.evaluate(() => window.localStorage.setItem('life-lab:v1', '{bad json'))
    await page.goto('/today')

    await expect(page.getByRole('heading', { name: '本地数据暂时无法读取', level: 1 })).toBeVisible()
    await expect(page.getByText('已停止正常加载')).toBeVisible()
    await expect(page.evaluate(() => window.localStorage.getItem('life-lab:v1'))).resolves.toBe('{bad json')
    await expectNoHorizontalScroll(page)
  })

  test('handles boundary-size local data on library, energy, and settings pages', async ({ page }) => {
    const instant = new Date().toISOString()
    const items = Array.from({ length: 500 }, (_, index) => ({
      id: `item-${index}`,
      title: `边界事项 ${index}`,
      track: index % 2 === 0 ? 'ideal_self' : 'side_hustle',
      status: index === 0 ? 'active' : index % 5 === 0 ? 'long_term' : 'exploring',
      createdAt: instant,
      updatedAt: new Date(Date.now() - index * 1000).toISOString(),
    }))
    const energyEntries = Array.from({ length: 120 }, (_, index) => ({
      id: `energy-${index}`,
      category: index % 2 === 0 ? 'energy' : 'drain',
      occurredAt: new Date(Date.now() - index * 60_000).toISOString(),
      event: `边界事件 ${index}`,
      feelingTags: [index % 2 === 0 ? '稳定' : '疲惫'],
      energyDelta: (index % 5) - 2,
      createdAt: instant,
      updatedAt: instant,
    }))

    await page.goto('/today')
    await page.evaluate(
      (state) => window.localStorage.setItem('life-lab:v1', JSON.stringify(state)),
      makeState({ items, energyEntries }),
    )

    await page.goto('/library')
    await expect(page.getByRole('heading', { name: '边界事项 0', level: 2 })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.goto('/energy')
    await expect(page.getByRole('heading', { name: '边界事件 0', level: 3 })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.goto('/settings')
    await expect(page.locator('text=事项').locator('..').getByText('500')).toBeVisible()
    await expect(page.locator('text=情绪记录').locator('..').getByText('120')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
