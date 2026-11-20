import { defineConfig } from '@playwright/test';

const withDemo = process.env.MARKER_E2E_DEMO === '1';
const local = port => `http://127.0.0.1:${port}`;
const env = { API_PROXY_TARGET: local(3109), VITE_API_BASE: '', VITE_DEMO_LOGIN: 'false' };
const vite = 'node node_modules/vite/bin/vite.js';
const args = port => `--host 127.0.0.1 --port ${port} --strictPort`;
const server = (command, port, vars = env) => ({
  command, url: local(port), env: vars, reuseExistingServer: false, timeout: 60000,
});

export default defineConfig({
  testDir: './tests/e2e',
  // Playwright 会清空自己的输出目录，不能指向保存用户验收记录的 test-results 根目录。
  outputDir: './test-results/playwright-run',
  globalSetup: './tests/e2e/setup.js',
  workers: 1, timeout: 60000, reporter: 'list',
  use: {
    browserName: 'chromium', channel: process.env.MARKER_E2E_BROWSER || (process.platform === 'win32' ? 'msedge' : 'chromium'),
    viewport: { width: 1600, height: 1100 }, screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'workspace', testIgnore: ['**/demo.spec.js', '**/production.spec.js'], use: { baseURL: local(5189) } },
    { name: 'production', testMatch: ['**/production.spec.js', '**/reliability.spec.js'], use: { baseURL: local(5191) } },
    ...(withDemo ? [{ name: 'demo', testMatch: '**/demo.spec.js', use: { baseURL: local(5188) } }] : []),
  ],
  webServer: [
    server(`${vite} --mode e2e ${args(5189)}`, 5189),
    server(`${vite} build --outDir test-results/e2e-dist && ${vite} preview --mode e2e --outDir test-results/e2e-dist ${args(5191)}`, 5191),
    ...(withDemo ? [server(`${vite} --mode demo ${args(5188)}`, 5188, { ...env, API_PROXY_TARGET: local(3110), VITE_DEMO_LOGIN: 'true' })] : []),
  ],
});
