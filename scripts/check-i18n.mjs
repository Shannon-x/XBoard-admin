#!/usr/bin/env node
/**
 * i18n 文案体检 —— 在 `npm run build` 之前跑（package.json 的 prebuild 钩子）。
 *
 * 为什么需要它：vue-i18n 的消息是**运行时按需编译**的，而且 dev 与生产的失败行为完全不同：
 *   · dev：编译失败只往控制台打一条 "Message compilation error"，页面照常渲染；
 *   · 生产：`createCompileError` 走 `new SyntaxError(String(错误码))` 并抛出，
 *     冒泡到 App.vue 的全局错误边界 —— 整张页面变成「页面遇到了错误 / 2」，用户进不去。
 *
 * 也就是说：本地开发一切正常，构建产物上线即崩，且报错只剩一个数字。2026-09 就因为
 * 一句设置项描述里写了 `{地址}`（花括号里是中文标识符，vue-i18n 当占位符解析 → 错误码 2）
 * 导致工单附件设置页无法打开。所以这道检查放在构建前，让它在 CI 里就失败。
 *
 * 两条规则：
 *   1. 每条消息都必须能通过 @intlify 编译器（onError 直接抛，等同生产行为）。
 *   2. `systemSettings.*` 下不允许出现 `{...}` 占位符 —— SystemSettingsPanel 一律以
 *      无参 `t(key)` 渲染 label/description/placeholder，占位符不会被替换，轻则渲染成
 *      空字符串（静默的文案缺失），重则像上面那样直接崩。
 *
 * 另有一条只提示不失败的规则：消息里出现 `<xxx>` 会触发 vue-i18n 的 HTML 检测告警。
 */

import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { baseCompile } from '@intlify/message-compiler'

const LOCALES_DIR = new URL('../src/i18n/locales/', import.meta.url)

/** 这些前缀下的文案由数据驱动地无参渲染，出现占位符一定是笔误 */
const PARAMLESS_PREFIXES = ['systemSettings.']

/** vue-i18n 占位符：`{name}` / `{0}`。这里只做存在性检测，合法性交给编译器 */
const PLACEHOLDER = /\{[^}]*\}/g
const HTML_LIKE = /<[a-zA-Z/][^>]*>/

function* leaves(node, prefix = '') {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      yield* leaves(value, path)
      continue
    }

    yield [path, value]
  }
}

async function localeFiles() {
  const entries = await readdir(LOCALES_DIR)

  return entries.filter(function isLocale(name) {
    return name.endsWith('.js') || name.endsWith('.json')
  })
}

async function main() {
  const errors = []
  const warnings = []
  let checked = 0

  for (const file of await localeFiles()) {
    const url = new URL(file, LOCALES_DIR)
    const imported = await import(url.href)
    const messages = imported.default ?? imported

    for (const [key, value] of leaves(messages)) {
      if (typeof value !== 'string') {
        continue
      }

      checked += 1

      // 规则 1：必须编译得过。onError 抛出 —— 默认实现只是收集错误，静默通过。
      try {
        baseCompile(value, {
          onError(error) {
            throw error
          },
        })
      } catch (error) {
        errors.push(
          `${file} → ${key}\n    编译失败：${error.message}\n    原文：${JSON.stringify(value)}`,
        )
        continue
      }

      // 规则 2：无参渲染的命名空间里不许有占位符
      const isParamless = PARAMLESS_PREFIXES.some(function hasPrefix(prefix) {
        return key.startsWith(prefix)
      })

      if (isParamless) {
        const found = value.match(PLACEHOLDER)

        if (found) {
          errors.push(
            `${file} → ${key}\n    含占位符 ${found.join(' ')}，但该文案由无参 t(key) 渲染，` +
              `会被替换成空字符串。改成字面文字，或改用会传参的调用点。\n    原文：${JSON.stringify(value)}`,
          )
        }
      }

      if (HTML_LIKE.test(value)) {
        warnings.push(`${file} → ${key}：含类 HTML 片段，vue-i18n 会打 XSS 告警。原文：${JSON.stringify(value)}`)
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`⚠ ${warning}`)
  }

  if (errors.length) {
    console.error(`\n✗ i18n 体检未通过（${errors.length} 处）：\n`)

    for (const error of errors) {
      console.error(`  ${error}\n`)
    }

    process.exit(1)
  }

  console.log(`✓ i18n 体检通过：${checked} 条文案，${warnings.length} 条告警`)
}

main().catch(function onFatal(error) {
  console.error(`i18n 体检脚本自身出错（${fileURLToPath(import.meta.url)}）：`, error)
  process.exit(1)
})
