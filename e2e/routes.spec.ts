import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function createItem(page: import('@playwright/test').Page, title: string, track: 'ideal_self' | 'side_hustle') {
  await page.getByRole('link', { name: '新建事项' }).first().click()
  await page.getByLabel('标题').fill(title)
  await page.getByLabel('方向').selectOption(track)
  await page.getByLabel('为什么想做').fill('想验证这件事是否值得继续')
  await page.getByLabel('长期想验证的问题').fill('这件事是否适合我？')
  await page.getByRole('button', { name: '保存事项' }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
  return page.url().match(/\/items\/([^/?#]+)/)?.[1] ?? ''
}

async function seedReviewDueCycle(page: import('@playwright/test').Page) {
  await page.goto('/today')
  await page.evaluate(() => {
    const now = new Date()
    const toLocalDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const addDays = (date: Date, days: number) => {
      const copy = new Date(date)
      copy.setDate(copy.getDate() + days)
      return copy
    }
    const startDate = toLocalDate(addDays(now, -7))
    const endDate = toLocalDate(addDays(now, -1))
    const instant = now.toISOString()
    window.localStorage.setItem(
      'life-lab:v1',
      JSON.stringify({
        schemaVersion: 1,
        meta: { createdAt: instant, updatedAt: instant, hasSeenLocalDataNotice: true },
        items: [
          {
            id: 'item-review',
            title: '复盘实验',
            track: 'ideal_self',
            status: 'review_due',
            createdAt: instant,
            updatedAt: instant,
          },
        ],
        cycles: [
          {
            id: 'cycle-review',
            itemId: 'item-review',
            cycleNumber: 1,
            startDate,
            endDate,
            status: 'review_due',
            question: '这轮是否值得继续？',
            actionPlan: '每天做一次',
            minimumStandard: '至少 5 分钟',
            adjustments: [],
            createdAt: instant,
            updatedAt: instant,
          },
        ],
        dailyEntries: [
          {
            id: 'entry-1',
            cycleId: 'cycle-review',
            date: startDate,
            status: 'practiced',
            actionSummary: '完成一次',
            feelingTags: [],
            createdAt: instant,
            updatedAt: instant,
          },
          {
            id: 'entry-2',
            cycleId: 'cycle-review',
            date: endDate,
            status: 'not_practiced',
            feelingTags: [],
            createdAt: instant,
            updatedAt: instant,
          },
        ],
        reviews: [],
        energyEntries: [],
      }),
    )
  })
}

test.describe('primary routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/today')
    await page.evaluate(() => window.localStorage.clear())
  })

  test('opens all T00 primary pages on the mobile viewport', async ({ page }) => {
    await page.goto('/today')
    await expect(page.getByRole('heading', { name: '今日', level: 1 })).toBeVisible()
    await expect(page.getByRole('dialog', { name: '数据只保存在这台设备' })).toBeVisible()
    await expect(page.getByRole('button', { name: '开始使用' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: '数据只保存在这台设备' })).toBeHidden()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )

    await page.goto('/energy')
    await expect(page).toHaveURL(/\/energy$/)
    await expect(page.getByRole('heading', { name: '情绪', level: 1 })).toBeVisible()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )

    await page.getByRole('link', { name: '总库', exact: true }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('heading', { name: '总库', level: 1 })).toBeVisible()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )
  })
})

test.describe('library item flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/library')
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
  })

  test('creates, views, edits, and filters an item without horizontal scrolling', async ({ page }) => {
    await page.getByRole('link', { name: '新建事项' }).first().click()
    await expect(page).toHaveURL(/\/items\/new$/)
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeHidden()

    await page.getByLabel('标题').fill('晨间写作')
    await page.getByLabel('方向').selectOption('side_hustle')
    await page.getByLabel('为什么想做').fill('想验证写作是否能带来副业线索')
    await page.getByLabel('长期想验证的问题').fill('我能否稳定输出有价值的内容？')
    await page.getByRole('button', { name: '保存事项' }).click()

    await expect(page).toHaveURL(/\/items\/.+$/)
    await expect(page.getByRole('heading', { name: '晨间写作', level: 1 })).toBeVisible()
    await expect(page.getByText('副业探索')).toBeVisible()
    await expect(page.getByRole('link', { name: '开启 7 天实践' })).toBeHidden()
    await expect(page.getByRole('link', { name: '编辑' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeHidden()

    await page.getByRole('link', { name: '编辑' }).click()
    await page.getByLabel('标题').fill('晨间写作实验')
    await page.getByRole('button', { name: '保存修改' }).click()

    await expect(page.getByRole('heading', { name: '晨间写作实验', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '返回主页' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '晨间写作实验', level: 2 })).toBeVisible()

    await page.getByRole('button', { name: '理想自我' }).click()
    await expect(page.getByText('当前没有事项')).toBeVisible()
    await page.getByRole('button', { name: '副业探索' }).click()
    await expect(page.getByRole('heading', { name: '晨间写作实验', level: 2 })).toBeVisible()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )
  })
})

test.describe('experiment creation and daily check-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/library')
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
  })

  test('starts a seven-day cycle, records today once, edits it, and blocks same-track capacity', async ({
    page,
  }) => {
    const itemId = await createItem(page, '晨间写作', 'ideal_self')
    await page.goto(`/items/${itemId}/experiments/new`)
    await expect(page.getByRole('heading', { name: '创建实践', level: 1 })).toBeVisible()
    await page.getByLabel('本轮唯一验证问题').fill('写作是否让我更稳定？')
    await page.getByLabel('每天／本周具体做什么').fill('每天写 20 分钟')
    await page.getByLabel('判断有效实践日的最低标准').fill('至少写 10 分钟')
    await page.getByRole('button', { name: '创建 7 天实践' }).click()

    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: '晨间写作', level: 2 })).toBeVisible()
    await expect(page.getByText('第 1 天')).toBeVisible()
    await page.getByRole('link', { name: '记录今日' }).click()

    await expect(page.getByRole('heading', { name: '每日记录', level: 1 })).toBeVisible()
    await page.getByLabel('行动摘要').fill('写了 15 分钟')
    await page.getByLabel('时长（分钟）').fill('15')
    await page.getByLabel('调整后的行动计划').fill('每天写 5 分钟')
    await page.getByLabel('调整后的最低标准').fill('打开文档')
    await page.getByRole('button', { name: '保存记录' }).click()

    await expect(page).toHaveURL(/\/today$/)
    await page.getByRole('link', { name: '查看记录' }).click()
    await expect(page.getByLabel('行动摘要')).toHaveValue('写了 15 分钟')
    await page.getByLabel('行动摘要').fill('写了 18 分钟')
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('link', { name: '总库', exact: true }).click()
    await createItem(page, '阅读实验', 'ideal_self')
    await expect(page.getByText('同方向已有未完成周期')).toBeVisible()
    await expect(page.getByRole('link', { name: '开启 7 天实践' })).toBeHidden()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )
  })
})

test.describe('cycle review flow', () => {
  test('shows review due first and continues with a new cycle from tomorrow', async ({ page }) => {
    await seedReviewDueCycle(page)
    await page.goto('/today')

    await expect(page.getByRole('heading', { name: '复盘实验', level: 2 })).toBeVisible()
    await expect(page.getByRole('link', { name: '去复盘' })).toBeVisible()
    await page.getByRole('link', { name: '去复盘' }).click()

    await expect(page.getByRole('heading', { name: '周期复盘', level: 1 })).toBeVisible()
    await expect(page.getByText('有效实践')).toBeVisible()
    await expect(page.getByText('未实践')).toBeVisible()
    await expect(page.getByText('空白')).toBeVisible()
    await page.getByLabel('事实摘要').fill('完成 1 天，错过 1 天，其余空白。')
    await page.getByLabel('本轮结论').fill('继续下一轮观察。')
    await page.getByLabel('决定').selectOption('continue')
    await page.getByRole('button', { name: '提交复盘' }).click()

    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('heading', { name: '复盘实验', level: 2 })).toBeVisible()
    await expect(page.getByText('第 2 轮')).toBeVisible()
    await expect(page.getByText('明日开始')).toBeVisible()
    await page.getByRole('link', { name: '总库', exact: true }).click()
    await page.getByRole('link', { name: '复盘实验' }).click()
    await expect(page.getByText('继续下一轮观察。')).toBeVisible()
  })

  test('requires adjusted fields for adjust-and-continue decisions', async ({ page }) => {
    await seedReviewDueCycle(page)
    await page.goto('/experiments/cycle-review/review')
    await page.getByLabel('事实摘要').fill('需要调整节奏。')
    await page.getByLabel('本轮结论').fill('调整后再试。')
    await page.getByLabel('决定').selectOption('adjust_continue')
    await page.getByRole('button', { name: '提交复盘' }).click()
    await expect(page.getByText('adjust_continue requires at least one adjusted field')).toBeVisible()

    await page.getByLabel('下一轮行动计划').fill('每天做 3 分钟')
    await page.getByRole('button', { name: '提交复盘' }).click()
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByText('第 2 轮')).toBeVisible()
  })
})

test.describe('energy log flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/energy')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/energy')
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
  })

  test('creates mixed-delta energy entries, edits, sorts, and deletes them on mobile', async ({ page }) => {
    await expect(page.getByLabel('主要归类')).toBeHidden()
    await page.getByRole('link', { name: '记录情绪' }).click()
    await expect(page).toHaveURL(/\/energy\/new$/)
    await expect(page.getByRole('heading', { name: '新增情绪', level: 1 })).toBeVisible()
    await page.getByLabel('主要归类').selectOption('energy')
    await page.getByLabel('事件').fill('散步后有精神')
    await page.getByRole('button', { name: '轻松' }).click()
    await page.getByLabel('自定义标签').fill('平静')
    await page.getByRole('button', { name: '添加' }).click()
    await expect(page.getByRole('button', { name: '平静' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('radio', { name: '-1' }).check()
    await page.getByLabel('原因').fill('身体有点累，但心情更稳')
    await page.getByRole('button', { name: '保存记录' }).click()

    const energyEntry = page.getByRole('link', { name: /散步后有精神/ })
    await expect(energyEntry).toBeVisible()
    await expect(energyEntry.getByText('-1')).toBeVisible()
    await expect(energyEntry.getByText('轻松')).toBeVisible()
    await expect(energyEntry.getByText('平静')).toBeVisible()
    await energyEntry.click()
    await expect(page.getByRole('heading', { name: '情绪详情', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '散步后有精神', level: 2 })).toBeVisible()
    await expect(page.getByText('平静')).toBeVisible()
    await page.getByRole('link', { name: '编辑' }).click()
    await expect(page.getByRole('button', { name: '平静' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: '返回主页' }).click()

    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByLabel('主要归类').selectOption('drain')
    await page.getByLabel('事件').fill('临时会议')
    await page.getByRole('button', { name: '疲惫' }).click()
    await page.getByRole('radio', { name: '+1' }).check()
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('button', { name: '被消耗' }).click()
    const drainEntry = page.getByRole('link', { name: /临时会议/ })
    await expect(drainEntry).toBeVisible()
    await expect(drainEntry.getByText('+1')).toBeVisible()

    await drainEntry.click()
    await expect(page.getByRole('heading', { name: '情绪详情', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '编辑' }).click()
    await expect(page).toHaveURL(/\/energy\/.+\/edit$/)
    await expect(page.getByRole('heading', { name: '编辑情绪', level: 1 })).toBeVisible()
    await page.getByLabel('事件').fill('临时会议后复盘')
    await page.getByRole('button', { name: '保存修改' }).click()
    await page.getByRole('button', { name: '被消耗' }).click()
    await expect(page.getByRole('heading', { name: '临时会议后复盘', level: 3 })).toBeVisible()

    await page.getByRole('link', { name: /临时会议后复盘/ }).click()
    await page.getByRole('button', { name: '删除' }).click()
    const dialog = page.getByRole('dialog', { name: '删除这条情绪？' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '删除' }).click()
    await expect(page.getByRole('heading', { name: '临时会议后复盘', level: 3 })).toBeHidden()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )
  })

  test('shows both energy columns on wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByLabel('主要归类').selectOption('energy')
    await page.getByLabel('事件').fill('晨间写作')
    await page.getByRole('button', { name: '保存记录' }).click()
    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByLabel('主要归类').selectOption('drain')
    await page.getByLabel('事件').fill('长时间刷消息')
    await page.getByRole('button', { name: '保存记录' }).click()

    await expect(page.getByRole('heading', { name: '晨间写作', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '长时间刷消息', level: 3 })).toBeVisible()
  })
})

test.describe('settings data flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/today')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/today')
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
  })

  test('exports full backup, anonymous summary, and deletes all data', async ({ page }) => {
    await page.getByRole('link', { name: '总库', exact: true }).click()
    await createItem(page, '隐私事项标题', 'ideal_self')
    await page.goto('/energy')
    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByLabel('事件').fill('非常私密的事件')
    await page.getByRole('button', { name: '焦虑' }).click()
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('link', { name: '今日', exact: true }).click()
    await page.getByRole('link', { name: '设置' }).click()
    await expect(page.getByRole('heading', { name: '设置与数据', level: 1 })).toBeVisible()
    await expect(page.getByText('schemaVersion: 1')).toBeVisible()
    await expect(page.getByText('有能量高频标签')).toBeVisible()

    const fullDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出完整 JSON' }).click()
    const fullDownload = await fullDownloadPromise
    const fullPath = await fullDownload.path()
    const fullContent = await readFile(String(fullPath), 'utf8')
    expect(fullContent).toContain('隐私事项标题')
    expect(fullContent).toContain('非常私密的事件')

    const summaryDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出匿名摘要' }).click()
    const summaryDownload = await summaryDownloadPromise
    const summaryPath = await summaryDownload.path()
    const summaryContent = await readFile(String(summaryPath), 'utf8')
    expect(summaryContent).toContain('"itemsCreated": 1')
    expect(summaryContent).toContain('"energyEntryCount": 1')
    expect(summaryContent).not.toContain('隐私事项标题')
    expect(summaryContent).not.toContain('非常私密的事件')
    expect(summaryContent).not.toContain('焦虑')

    await page.getByRole('button', { name: '删除全部数据' }).click()
    const dialog = page.getByRole('dialog', { name: '确认删除全部数据？' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '确认删除' }).click()
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('dialog', { name: '数据只保存在这台设备' })).toBeVisible()
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
    await expect(page.getByText('理想自我当前没有重点实践。')).toBeVisible()
    await page.getByRole('link', { name: '设置' }).click()
    await expect(page.getByText('schemaVersion: 1')).toBeVisible()
    await expect(page.getByText('事项').locator('..').getByText('0')).toBeVisible()
  })
})
