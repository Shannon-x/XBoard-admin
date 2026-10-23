<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * 数字滚动：传入已经格式化好的展示串（「¥1,234.56」「386」「12.4 TB」），
 * 只把其中第一个数字从 0（或上一次的值）滚到目标值，前后缀、小数位、千分位原样保留。
 * 首次出现从 0 起滚，之后每分钟自动刷新时从旧值滚到新值；系统开了「减少动态效果」直接显示终值。
 */
const props = defineProps({
  text: { type: [String, Number], default: '' },
  duration: { type: Number, default: 900 },
})

const NUMBER_RE = /-?\d[\d,]*(?:\.\d+)?/
const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function parse(text) {
  const m = NUMBER_RE.exec(text)
  if (!m) return null
  const raw = m[0]
  const dot = raw.indexOf('.')
  return {
    value: Number(raw.replace(/,/g, '')),
    decimals: dot === -1 ? 0 : raw.length - dot - 1,
    grouped: raw.includes(','),
    head: text.slice(0, m.index),
    tail: text.slice(m.index + raw.length),
  }
}

function render(p, n) {
  const body = p.grouped
    ? n.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals })
    : n.toFixed(p.decimals)
  return p.head + body + p.tail
}

const shown = ref(String(props.text))
let last = null
let frame = 0

function stop() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

watch(
  () => String(props.text),
  function play(text) {
    stop()
    const p = parse(text)
    if (!p || reduce || !Number.isFinite(p.value)) {
      shown.value = text
      last = p?.value ?? null
      return
    }
    const from = last ?? 0
    last = p.value
    if (from === p.value) {
      shown.value = text
      return
    }
    const start = performance.now()
    const step = function step(now) {
      const t = Math.min(1, (now - start) / props.duration)
      const eased = 1 - Math.pow(1 - t, 4)
      const current = from + (p.value - from) * eased
      shown.value = t < 1 ? render(p, current) : text
      if (t < 1) {
        frame = requestAnimationFrame(step)
      } else {
        frame = 0
      }
    }
    shown.value = render(p, from)
    frame = requestAnimationFrame(step)
  },
  { immediate: true },
)

onBeforeUnmount(stop)
</script>

<template>
  <span class="count-up-text"><span aria-hidden="true">{{ shown }}</span><span class="sr-only">{{ text }}</span></span>
</template>

<style scoped>
.count-up-text {
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
