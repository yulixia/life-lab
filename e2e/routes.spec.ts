import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function createItem(page: import('@playwright/test').Page, title: string, track: 'ideal_self' | 'side_hustle') {
  await page.getByRole('link', { name: '新建事项' }).first().click()
  await page.getByLabel('标题').fill(title)
  await page.getByRole('button', { name: track === 'ideal_self' ? '理想自我' : '副业探索' }).click()
  await page.getByText('补充想法').click()
  await page.getByLabel('为什么想做').fill('想验证这件事是否值得继续')
  await page.getByLabel('长期想验证的问题').fill('这件事是否适合我？')
  await page.getByRole('button', { name: '放入总库' }).click()
  await page.getByRole('button', { name: '展开状态筛选' }).click()
  await page.getByRole('checkbox', { name: '待探索' }).check()
  await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()
  await page.getByRole('link', { name: title }).click()
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
        schemaVersion: 2,
        meta: { createdAt: instant, updatedAt: instant, hasSeenLocalDataNotice: true },
        items: [
          {
            id: 'item-review',
            title: '复盘实验',
            track: 'ideal_self',
            status: 'concluded',
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
            status: 'concluded',
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
        longTermEntries: [],
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
    await expect(page.getByRole('link', { name: '去总库' }).first()).toHaveCSS('color', 'rgb(78, 181, 216)')

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
    await page.getByRole('button', { name: '副业探索' }).click()
    await page.getByText('补充想法').click()
    await page.getByLabel('为什么想做').fill('想验证写作是否能带来副业线索')
    await page.getByLabel('长期想验证的问题').fill('我能否稳定输出有价值的内容？')
    await page.getByRole('button', { name: '放入总库' }).click()

    await expect(page).toHaveURL(/\/library$/)
    await page.getByRole('button', { name: '展开状态筛选' }).click()
    await page.getByRole('checkbox', { name: '待探索' }).check()
    await expect(page.getByRole('heading', { name: '晨间写作', level: 2 })).toBeVisible()
    await page.getByRole('link', { name: /晨间写作/ }).click()
    await expect(page.getByRole('heading', { name: '晨间写作', level: 1 })).toBeVisible()
    await expect(page.getByText('副业探索')).toBeVisible()
    await expect(page.getByRole('link', { name: '开启 7 天实践' })).toBeHidden()
    const startAction = page.getByRole('link', { name: '开启实践' })
    await expect(startAction).toBeVisible()
    const actionDimensions = await startAction.evaluate((element) => {
      const row = element.closest('[class*="startActionRow"]')
      const moreAction = row?.querySelector('button')
      const startBounds = element.getBoundingClientRect()
      const moreBounds = moreAction?.getBoundingClientRect()
      return { startHeight: startBounds.height, startWidth: startBounds.width, moreHeight: moreBounds?.height, moreWidth: moreBounds?.width }
    })
    expect(actionDimensions.moreHeight).toBe(actionDimensions.startHeight)
    expect(actionDimensions.startWidth / (actionDimensions.moreWidth ?? 1)).toBeGreaterThan(1.8)
    expect(actionDimensions.startWidth / (actionDimensions.moreWidth ?? 1)).toBeLessThan(2.2)
    await expect(page.getByRole('link', { name: '编辑' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeHidden()

    await page.getByRole('link', { name: '编辑' }).click()
    await page.getByLabel('标题').fill('晨间写作实验')
    await page.getByRole('button', { name: '保存修改' }).click()

    await expect(page.getByRole('heading', { name: '晨间写作实验', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '返回' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible()
    await page.getByRole('button', { name: '展开状态筛选' }).click()
    await page.getByRole('checkbox', { name: '待探索' }).check()
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
    const recordToday = page.getByRole('link', { name: '记录今日' })
    await expect(recordToday).toBeVisible()
    const titleAndActionLayout = await page.getByRole('heading', { name: '晨间写作', level: 2 }).evaluate((title) => {
      const card = title.closest('section')
      const track = card?.querySelector('[class*="track"]')
      const titleBounds = title.getBoundingClientRect()
      const trackBounds = track?.getBoundingClientRect()
      return {
        titleRight: titleBounds.right,
        trackLeft: trackBounds?.left,
      }
    })
    expect(titleAndActionLayout.titleRight).toBeLessThanOrEqual(titleAndActionLayout.trackLeft ?? 0)
    await expect(recordToday).toHaveCSS('justify-content', 'space-between')
    await recordToday.click()

    await expect(page.getByRole('heading', { name: '每日记录', level: 1 })).toBeVisible()
    await expect(page.getByLabel('今天达到最低标准了吗？')).toBeHidden()
    await page.getByLabel('行动摘要').fill('写了 15 分钟')
    await expect(page.getByLabel('时长（分钟）')).toBeHidden()
    await expect(page.getByLabel('调整后的行动计划')).toBeHidden()
    await page.getByText('补充更多').click()
    await page.getByRole('radio', { name: '-1' }).check()
    await page.locator('input[name="energyDelta"][value="1"]').check()
    await page.getByRole('radio', { name: '0' }).check()
    await expect(page.getByLabel('观察')).toBeVisible()
    await page.getByRole('button', { name: '保存记录' }).click()

    await expect(page).toHaveURL(/\/today$/)
    const recordedToday = page.getByRole('link', { name: '今天已记录' })
    await expect(recordedToday).toBeVisible()
    await expect(recordedToday).toHaveCSS('justify-content', 'space-between')
    await expect(recordedToday).toHaveCSS('color', 'rgb(78, 181, 216)')
    await recordedToday.click()
    await expect(page.getByLabel('行动摘要')).toHaveValue('写了 15 分钟')
    await page.getByLabel('行动摘要').fill('写了 18 分钟')
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('link', { name: '总库', exact: true }).click()
    await createItem(page, '阅读实验', 'ideal_self')
    await expect(page.getByText('同方向已有待完成或待复盘的事项')).toBeVisible()
    await expect(page.getByRole('link', { name: '开启 7 天实践' })).toBeHidden()
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(
      true,
    )
  })

  test('uses the unpracticed entry point and removes it after today is recorded', async ({ page }) => {
    const itemId = await createItem(page, '晚间阅读', 'ideal_self')
    await page.goto(`/items/${itemId}/experiments/new`)
    await page.getByLabel('本轮唯一验证问题').fill('睡前阅读是否更容易坚持？')
    await page.getByLabel('每天／本周具体做什么').fill('阅读 5 分钟')
    await page.getByLabel('判断有效实践日的最低标准').fill('打开书并阅读一页')
    await page.getByRole('button', { name: '创建 7 天实践' }).click()

    await page.getByRole('link', { name: '标记未实践' }).click()
    await expect(page.getByRole('heading', { name: '标记未实践', level: 1 })).toBeVisible()
    await expect(page.getByLabel('行动摘要')).toBeHidden()
    await page.getByRole('button', { name: '忙碌' }).click()
    await page.getByLabel('自定义标签').fill('临时安排')
    await page.getByRole('button', { name: '添加' }).click()
    await expect(page.getByRole('button', { name: '临时安排' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('补充说明').fill('临时会议延长到很晚，回家后没有精力开始')
    await page.getByRole('button', { name: '保存未实践' }).click()

    await expect(page.getByRole('link', { name: '今天已记录' })).toBeVisible()
    await expect(page.getByRole('link', { name: '标记未实践' })).toBeHidden()
    await page.getByRole('link', { name: '今天已记录' }).click()
    await expect(page.getByRole('button', { name: '忙碌' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '临时安排' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('补充说明')).toHaveValue('临时会议延长到很晚，回家后没有精力开始')
  })
})

test.describe('cycle review flow', () => {
  test('reviews a concluded item and starts the next round from item actions', async ({ page }) => {
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
    await page.getByLabel('本轮结论').fill('完成后再开一轮观察。')
    await page.getByRole('button', { name: '提交复盘' }).click()

    await expect(page).toHaveURL(/\/today$/)
    await page.getByRole('link', { name: '总库', exact: true }).click()
    await page.getByRole('button', { name: '展开状态筛选' }).click()
    await page.getByRole('checkbox', { name: '已完结' }).check()
    await page.getByRole('link', { name: '复盘实验' }).click()
    await expect(page.getByText('完成后再开一轮观察。')).toBeVisible()
    await expect(page.getByText('已完结').first()).toBeVisible()
    await expect(page.getByRole('link', { name: '记录今日' })).toBeHidden()
    await page.getByText('更多操作').click()
    await expect(page.getByRole('button', { name: '归档事项' })).toHaveCount(0)
    await page.getByRole('link', { name: '开启下一轮' }).click()
    await page.getByLabel('本轮唯一验证问题').fill('这轮继续是否更稳？')
    await page.getByLabel('每天／本周具体做什么').fill('每天做 3 分钟')
    await page.getByLabel('判断有效实践日的最低标准').fill('打开并做 1 分钟')
    await page.getByRole('button', { name: '创建 7 天实践' }).click()
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByText('第 1 天')).toBeVisible()
  })

  test('deletes an active item with no record instead of creating a voided status', async ({ page }) => {
    await page.goto('/library')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/library')
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
    const itemId = await createItem(page, '空白实验', 'ideal_self')
    await page.goto(`/items/${itemId}/experiments/new`)
    await page.getByLabel('本轮唯一验证问题').fill('还要不要做？')
    await page.getByLabel('每天／本周具体做什么').fill('每天做一次')
    await page.getByLabel('判断有效实践日的最低标准').fill('开始就算')
    await page.getByRole('button', { name: '创建 7 天实践' }).click()
    await page.goto(`/items/${itemId}`)
    await page.getByText('更多操作').click()
    await expect(page.getByRole('button', { name: '删除事项' })).toBeVisible()
    await page.getByRole('heading', { name: '空白实验', level: 1 }).click()
    await expect(page.getByRole('button', { name: '删除事项' })).toBeHidden()
    await page.getByText('更多操作').click()
    await page.getByRole('button', { name: '删除事项' }).click()
    await page.getByRole('button', { name: '确认删除' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('heading', { name: '空白实验', level: 2 })).toBeHidden()
  })

  test('converts an archived success into a long-term item and records today', async ({ page }) => {
    await page.goto('/today')
    await page.evaluate(() => {
      const instant = new Date().toISOString()
      window.localStorage.setItem('life-lab:v1', JSON.stringify({
        schemaVersion: 2,
        meta: { createdAt: instant, updatedAt: instant, hasSeenLocalDataNotice: true },
        items: [{ id: 'long-item', title: '早睡', track: 'ideal_self', status: 'archived', archivedFromStatus: 'completed', createdAt: instant, updatedAt: instant }],
        cycles: [],
        dailyEntries: [],
        reviews: [],
        longTermEntries: [],
        energyEntries: [],
      }))
    })
    await page.goto('/items/long-item')
    await page.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '转为长期' }).click()
    await expect(page.getByText('长期进行')).toBeVisible()

    await page.goto('/today')
    await expect(page.getByRole('heading', { name: '长期事项', level: 2 })).toBeVisible()
    await page.getByRole('link', { name: '完成今天' }).click()
    await page.getByLabel('备注').fill('22:30 前放下手机')
    await page.getByRole('button', { name: '完成今天' }).click()
    await expect(page.getByRole('link', { name: '更新今日备注' })).toBeVisible()

    await page.goto('/items/long-item')
    await page.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '终止长期事项' }).click()
    await page.getByRole('button', { name: '确认' }).click()
    await expect(page.getByText('长期已终止')).toBeVisible()
    await page.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '重启长期事项' }).click()
    await expect(page.getByText('累计完成 1 天')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: '记录一件事', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '有能量' }).click()
    await page.getByLabel('发生了什么？').fill('散步后有精神')
    await page.getByRole('button', { name: '轻松' }).click()
    await page.getByLabel('自定义标签').fill('平静')
    await page.getByRole('button', { name: '添加' }).click()
    await expect(page.getByRole('button', { name: '平静' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radio', { name: '0' })).toBeVisible()
    await page.getByRole('radio', { name: '0' }).check()
    await page.getByText('补充更多').click()
    await page.getByLabel('原因').fill('身体有点累，但心情更稳')
    await page.getByRole('button', { name: '保存记录' }).click()

    const energyEntry = page.getByRole('link', { name: /散步后有精神/ })
    await expect(energyEntry).toBeVisible()
    await expect(energyEntry.locator('[class*="deltaTag"]')).toHaveText('0')
    await expect(energyEntry.getByText('轻松')).toBeVisible()
    await expect(energyEntry.getByText('平静')).toBeVisible()
    await energyEntry.click()
    await expect(page.getByRole('heading', { name: '情绪详情', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '散步后有精神', level: 2 })).toBeVisible()
    await expect(page.getByText('平静')).toBeVisible()
    await page.getByRole('link', { name: '编辑' }).click()
    await expect(page.getByRole('button', { name: '平静' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: '返回' }).click()

    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByRole('button', { name: '被消耗' }).click()
    await page.getByLabel('发生了什么？').fill('临时会议')
    await page.getByRole('button', { name: '疲惫' }).click()
    await page.getByRole('radio', { name: '-2' }).check()
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('button', { name: '被消耗' }).click()
    const drainEntry = page.getByRole('link', { name: /临时会议/ })
    await expect(drainEntry).toBeVisible()
    await expect(drainEntry.getByText('-2')).toBeVisible()

    await drainEntry.click()
    await expect(page.getByRole('heading', { name: '情绪详情', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '编辑' }).click()
    await expect(page).toHaveURL(/\/energy\/.+\/edit$/)
    await expect(page.getByRole('heading', { name: '编辑记录', level: 1 })).toBeVisible()
    await page.getByLabel('发生了什么？').fill('临时会议后复盘')
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
    await page.getByRole('button', { name: '有能量' }).click()
    await page.getByLabel('发生了什么？').fill('晨间写作')
    await page.getByRole('button', { name: '保存记录' }).click()
    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByRole('button', { name: '被消耗' }).click()
    await page.getByLabel('发生了什么？').fill('长时间刷消息')
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

  test('exports a full backup, merges imported data, and deletes all data', async ({ page }) => {
    await page.getByRole('link', { name: '总库', exact: true }).click()
    await createItem(page, '隐私事项标题', 'ideal_self')
    await page.goto('/energy')
    await page.getByRole('link', { name: '记录情绪' }).click()
    await page.getByLabel('发生了什么？').fill('非常私密的事件')
    await page.getByRole('button', { name: '焦虑' }).click()
    await page.getByRole('button', { name: '保存记录' }).click()

    await page.getByRole('link', { name: '今日', exact: true }).click()
    await page.getByRole('link', { name: '数据' }).click()
    await expect(page.getByRole('heading', { name: '数据', level: 1 })).toBeVisible()
    await expect(page.getByText('schemaVersion: 2')).toBeVisible()
    await expect(page.getByText('高频标签')).toBeVisible()
    await expect(page.getByText('有能量：焦虑')).toBeVisible()

    const fullDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出完整 JSON' }).click()
    const fullDownload = await fullDownloadPromise
    const fullPath = await fullDownload.path()
    const fullContent = await readFile(String(fullPath), 'utf8')
    expect(fullContent).toContain('隐私事项标题')
    expect(fullContent).toContain('非常私密的事件')

    const importedBackup = JSON.stringify({
      schemaVersion: 2,
      meta: { createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-10T04:00:00.000Z', hasSeenLocalDataNotice: true },
      items: [{ id: 'imported-item', title: '导入事项', track: 'side_hustle', status: 'exploring', createdAt: '2026-08-09T04:00:00.000Z', updatedAt: '2026-08-10T04:00:00.000Z' }],
      cycles: [],
      dailyEntries: [],
      reviews: [],
      longTermEntries: [],
      energyEntries: [],
    })
    await page.locator('input[type="file"]').setInputFiles({ name: 'life-lab-backup.json', mimeType: 'application/json', buffer: Buffer.from(importedBackup) })
    await expect(page.getByText('已合并导入的数据。')).toBeVisible()
    await page.getByRole('link', { name: '总库', exact: true }).click()
    await page.getByRole('button', { name: '展开状态筛选' }).click()
    await page.getByRole('checkbox', { name: '待探索' }).check()
    await expect(page.getByRole('heading', { name: '导入事项', level: 2 })).toBeVisible()
    await page.getByRole('link', { name: '数据' }).click()

    await page.getByRole('button', { name: '删除全部数据' }).click()
    const dialog = page.getByRole('dialog', { name: '确认删除全部数据？' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '确认删除' }).click()
    await expect(page).toHaveURL(/\/today$/)
    await expect(page.getByRole('dialog', { name: '数据只保存在这台设备' })).toBeVisible()
    await page.getByRole('button', { name: '开始使用' }).press('Enter')
    await expect(page.getByRole('heading', { name: '理想自我', level: 2 })).toBeVisible()
    await expect(page.getByText('当前没有重点实践').first()).toBeVisible()
    await page.getByRole('link', { name: '数据' }).click()
    await expect(page.getByText('schemaVersion: 2')).toBeVisible()
    await expect(page.getByText('事项').locator('..').getByText('0')).toBeVisible()
  })
})
