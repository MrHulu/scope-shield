#!/usr/bin/env node
/**
 * scripts/feishu-login.mjs
 *
 * 一键飞书 Project 凭证获取：
 *   1. Playwright headed 模式打开 https://project.feishu.cn/
 *   2. 用户在弹窗内扫码 / 验证码登录
 *   3. 检测到 `meego_csrf_token` cookie → 保存 storage_state 到
 *      ~/.credential-center/feishu_project_state.json
 *   4. vite proxy 在每次请求时重读该文件，**无需重启 dev server**
 *
 * 用法：
 *   npm run feishu:login
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TARGET = 'https://project.feishu.cn/';
const OUT = path.join(os.homedir(), '.credential-center', 'feishu_project_state.json');
const REQUIRED_COOKIE = 'meego_csrf_token';
const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 500;

function banner(line) {
  process.stdout.write(`\n${line}\n`);
}

async function main() {
  banner('🛡️  Scope Shield · Feishu Project 登录');
  console.log('═════════════════════════════════════════');
  console.log(`目标 : ${TARGET}`);
  console.log(`输出 : ${OUT}`);
  console.log('提示 : 弹出窗口中扫码 / 输入手机号登录飞书 Project');
  console.log('       登录成功后脚本会自动保存凭证并关闭浏览器');
  console.log('═════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  // 飞书登录页第三方广告资源极多 — 别 await，让它后台加载即可
  // DOM 一出来用户就能扫码；cookie 轮询跟 goto 并行，goto 失败也不影响
  page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }).catch((err) => {
    console.log(`⚠️  页面加载异常（${err && err.message ? err.message.split('\n')[0] : err}），继续等待登录...`);
  });

  console.log(`⏳ 浏览器已打开，等待扫码登录（最长 ${TIMEOUT_MS / 60_000} 分钟）...`);

  // 真·登录态检测：调一个登录后才返回 code:0 的飞书 API
  // (meego_csrf_token cookie 未登录访问就会被 set，不能单独作为登录信号)
  async function isLoggedIn() {
    const cookies = await context.cookies();
    const csrf = cookies.find(
      (c) => c.name === REQUIRED_COOKIE && c.domain.includes('feishu'),
    );
    if (!csrf) return false;
    const cookieHeader = cookies
      .filter((c) => c.domain.includes('feishu'))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    try {
      const r = await fetch(
        'https://project.feishu.cn/goapi/v1/project/trans_simple_name',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            'x-meego-csrf-token': csrf.value,
            Referer: 'https://project.feishu.cn/',
            Origin: 'https://project.feishu.cn',
          },
          body: JSON.stringify({ simple_name_list: [] }),
        },
      );
      if (!r.ok) return false;
      const j = await r.json();
      return j.code === 0;
    } catch {
      return false;
    }
  }

  const start = Date.now();
  let logged = false;
  while (Date.now() - start < TIMEOUT_MS) {
    if (await isLoggedIn()) {
      logged = true;
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  if (!logged) {
    console.error(`\n❌ ${TIMEOUT_MS / 60_000} 分钟内未检测到登录状态`);
    await browser.close();
    process.exit(1);
  }

  console.log('✅ 检测到登录状态，保存凭证...\n');
  const storage = await context.storageState();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(storage, null, 2));
  fs.chmodSync(OUT, 0o600);

  const feishuCookies = storage.cookies.filter((c) => c.domain.includes('feishu'));
  const csrf = feishuCookies.find((c) => c.name === REQUIRED_COOKIE);
  console.log(`📦 已写入: ${OUT}`);
  console.log(`   总 cookie     : ${storage.cookies.length}`);
  console.log(`   feishu 相关  : ${feishuCookies.length}`);
  console.log(`   ${REQUIRED_COOKIE} : ${csrf ? `✓ ${csrf.value.slice(0, 16)}…` : '✗ 缺失'}`);
  console.log('\n🎉 完成！');
  console.log('   现在可以回到 Settings 页点「重新检测」（无需重启 dev server）。\n');

  await browser.close();
}

main().catch((err) => {
  console.error('\n❌ 登录失败:', err.message);
  process.exit(1);
});
