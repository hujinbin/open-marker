import assert from 'node:assert/strict';

export default async function setup() {
  // 先验证前端实际代理到的后端身份，不能因为主页能打开就向错误的环境写入测试数据。
  for (const port of [5189, 5191]) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/test/ready`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      assert.ok(response.ok);
      assert.deepEqual(await response.json(), { suite: 'open-marker-isolated', ready: true });
    } catch (cause) {
      throw new Error('隔离测试后端尚未就绪。请在配套后端执行 node scripts/test-annotation-api.cjs --serve，等提示 3109 已就绪后再运行。', { cause });
    }
  }
  if (process.env.MARKER_E2E_DEMO === '1') {
    const r = await fetch('http://127.0.0.1:5188/api/annotation/demo-info', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    assert.ok(r.ok && (await r.json()).data?.isolated === true, '请先启动本机隔离演示后端（3110）');
  }
}
