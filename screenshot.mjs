import { _electron as electron } from 'playwright'
import { join } from 'path'

const app = await electron.launch({
  args: ['/tmp/ai-workflow-hub/out/main/index.js'],
  env: {
    ...process.env,
    AI_HUB_REGISTRY: '/tmp/ai-workflow-hub/registry/workflows.yaml',
  },
})

const win = await app.firstWindow()
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(1200)
await win.screenshot({ path: '/tmp/hub-window.png' })
console.log('Screenshot saved')
await app.close()
