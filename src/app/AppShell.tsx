import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InlineError } from '../components/InlineError'
import { PageContainer } from '../components/PageContainer'
import { useLifeLab } from './LifeLabContext'
import styles from './AppShell.module.css'

export function AppShell() {
  const { loadResult, markLocalNoticeSeen, state, status } = useLifeLab()

  if (status === 'loading') {
    return (
      <div className={styles.shell}>
        <PageContainer>
          <div className={styles.loading} role="status">
            正在准备人生实验室
          </div>
        </PageContainer>
      </div>
    )
  }

  if (status === 'load_error') {
    const loadError = loadResult && !loadResult.ok ? loadResult : null
    return (
      <div className={styles.shell}>
        <PageContainer>
          <Card className={styles.recovery}>
            <h1>本地数据暂时无法读取</h1>
            <p>已停止正常加载，避免覆盖当前浏览器里的原始数据。</p>
            <InlineError>{loadError?.message ?? '未知读取错误'}</InlineError>
            {loadError?.raw ? (
              <Button
                onClick={() => {
                  const blob = new Blob([loadError.raw ?? ''], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'life-lab-raw-data.json'
                  link.click()
                  URL.revokeObjectURL(url)
                }}
                variant="secondary"
              >
                导出原始数据
              </Button>
            ) : null}
          </Card>
        </PageContainer>
      </div>
    )
  }

  const shouldShowLocalNotice = Boolean(state && !state.meta.hasSeenLocalDataNotice)

  return (
    <div className={styles.shell}>
      <PageContainer>
        <Outlet />
      </PageContainer>
      <BottomNav />
      <ConfirmDialog
        confirmLabel="开始使用"
        isOpen={shouldShowLocalNotice}
        onConfirm={markLocalNoticeSeen}
        title="数据只保存在这台设备"
      >
        <p>当前版本免登录，不会同步到其他设备；清理浏览器数据或更换设备后，记录可能丢失。</p>
      </ConfirmDialog>
    </div>
  )
}
