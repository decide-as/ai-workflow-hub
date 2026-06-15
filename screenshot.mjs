import { _electron as electron } from 'playwright'

const app = await electron.launch({
  args: ['./out/main/index.js'],
  env: {
    ...process.env,
    AI_HUB_REGISTRY: './registry/workflows.yaml',
  },
})

const win = await app.firstWindow()
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(1000)

// Click the first workflow card to trigger the modal
await win.locator('[role="button"]').first().click()
await win.waitForTimeout(400)
await win.screenshot({ path: '/tmp/hub-modal.png' })
console.log('Modal screenshot saved')
await app.close()
