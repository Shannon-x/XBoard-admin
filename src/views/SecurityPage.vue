<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bot, Download, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-vue-next'

import CopyButton from '../components/common/CopyButton.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { toSettings } from '../utils/crossLink'
import { buildDashboardApiUrl } from '../services/api'
import {
  beginRebind,
  confirmRebind,
  createApiToken,
  createEmptySecurityStatus,
  createEmptyUserSessionSummary,
  fetchApiTokens,
  fetchLoginLog,
  fetchSecurityStatus,
  fetchSessions,
  regenerateRecoveryCodes,
  revokeApiToken,
  revokeOtherSessions,
  revokeSession,
  revokeUserSessions,
} from '../services/security'
import { copyText } from '../utils/clipboard'
import { formatTimestamp } from '../utils/format'

// ===== 两步验证状态 =====
const status = ref(createEmptySecurityStatus())
const statusLoading = ref(false)
const statusError = ref('')

// ===== 会话 =====
// sessions 只有后台登录；用户面板 / 客户端里的登录只有一行汇总（userSessions）
const sessions = ref([])
const userSessions = ref(createEmptyUserSessionSummary())
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)
const revokingOthers = ref(false)
const revokingUser = ref(false)

// 用户面板会话多到这个数，多半是某个程序在用密码反复登录，提示改用接口令牌
const USER_SESSION_FLOOD = 20

// ===== 接口令牌 =====
const apiTokens = ref([])
const apiTokensLoading = ref(false)
const apiTokensError = ref('')
const revokingTokenId = ref(0)

// 新建令牌弹窗：stage 'form' → 'done'（明文只展示这一次）
const tokenDialogVisible = ref(false)
const tokenDialogStage = ref('form')
const tokenDialogLoading = ref(false)
const tokenDialogError = ref('')
const tokenForm = ref({ name: '', scope: 'read', otp: '' })
const createdToken = ref(null)

// ===== 登录记录 =====
const loginLog = ref([])
const loginLogLoading = ref(false)
const loginLogError = ref('')

// ===== 弹窗：重新绑定 / 重新生成恢复码 =====
// mode: 'rebind' | 'recovery'；stage: 'otp'（验当前码）→ 'scan'（仅 rebind：扫新码）→ 'codes'（展示恢复码）
const dialogVisible = ref(false)
const dialogMode = ref('rebind')
const dialogStage = ref('otp')
const dialogLoading = ref(false)
const dialogError = ref('')
const otp = ref('')
const rebindInfo = ref(null)
const newRecoveryCodes = ref([])

const otherAdminSessionCount = computed(function otherAdminSessionCount() {
  return sessions.value.filter(function isOther(item) {
    return !item.current
  }).length
})

const otherSessionCount = computed(function otherSessionCount() {
  return otherAdminSessionCount.value + userSessions.value.count
})

const tokenFormReady = computed(function tokenFormReady() {
  const value = tokenForm.value.otp.replace(/[\s-]/g, '')
  return tokenForm.value.name.trim() !== '' && (/^\d{6}$/.test(value) || value.length === 10)
})

// 程序调用时的接口前缀（与后台同一个地址），去掉 cache-buster
const apiBaseUrl = computed(function apiBaseUrl() {
  try {
    const url = new URL(buildDashboardApiUrl(''))
    url.search = ''
    return url.toString()
  } catch {
    return ''
  }
})

const recoveryTone = computed(function recoveryTone() {
  if (status.value.recoveryCodesRemaining === 0) return 'danger'
  if (status.value.recoveryCodesRemaining <= 2) return 'warning'
  return 'success'
})

const dialogTitle = computed(function dialogTitle() {
  if (dialogStage.value === 'codes') return '新的恢复码'
  if (dialogMode.value === 'rebind') return dialogStage.value === 'scan' ? '扫描新的二维码' : '重新绑定验证器'
  return '重新生成恢复码'
})

const otpReady = computed(function otpReady() {
  const value = otp.value.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(value) || value.length === 10
})

const newCodesText = computed(function newCodesText() {
  return newRecoveryCodes.value.join('\n')
})

async function loadStatus() {
  statusLoading.value = true
  statusError.value = ''
  try {
    status.value = await fetchSecurityStatus()
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '两步验证状态加载失败'
  } finally {
    statusLoading.value = false
  }
}

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const result = await fetchSessions()
    sessions.value = result.sessions
    userSessions.value = result.userSessions
  } catch (error) {
    sessionsError.value = error instanceof Error ? error.message : '会话列表加载失败'
  } finally {
    sessionsLoading.value = false
  }
}

async function loadApiTokens() {
  apiTokensLoading.value = true
  apiTokensError.value = ''
  try {
    apiTokens.value = await fetchApiTokens()
  } catch (error) {
    apiTokensError.value = error instanceof Error ? error.message : '接口令牌加载失败'
  } finally {
    apiTokensLoading.value = false
  }
}

async function loadLoginLog() {
  loginLogLoading.value = true
  loginLogError.value = ''
  try {
    loginLog.value = await fetchLoginLog(20)
  } catch (error) {
    loginLogError.value = error instanceof Error ? error.message : '登录记录加载失败'
  } finally {
    loginLogLoading.value = false
  }
}

function refreshAll() {
  loadStatus()
  loadSessions()
  loadApiTokens()
  loadLoginLog()
}

function openDialog(mode) {
  dialogMode.value = mode
  dialogStage.value = 'otp'
  dialogError.value = ''
  otp.value = ''
  rebindInfo.value = null
  newRecoveryCodes.value = []
  dialogVisible.value = true
}

async function submitOtp() {
  if (!otpReady.value || dialogLoading.value) return
  dialogLoading.value = true
  dialogError.value = ''
  try {
    if (dialogMode.value === 'recovery') {
      newRecoveryCodes.value = await regenerateRecoveryCodes(otp.value)
      dialogStage.value = 'codes'
      ElMessage.success('恢复码已重新生成，旧的恢复码全部失效')
    } else if (dialogStage.value === 'otp') {
      rebindInfo.value = await beginRebind(otp.value)
      dialogStage.value = 'scan'
    } else {
      newRecoveryCodes.value = await confirmRebind(otp.value)
      dialogStage.value = 'codes'
      ElMessage.success('验证器已更换，旧的条目与恢复码全部失效')
    }
    otp.value = ''
  } catch (error) {
    dialogError.value = error instanceof Error ? error.message : '操作失败'
    otp.value = ''
  } finally {
    dialogLoading.value = false
  }
}

function closeDialog() {
  dialogVisible.value = false
  if (dialogStage.value === 'codes') {
    loadStatus()
    loadLoginLog()
  }
}

async function copyNewCodes() {
  try {
    await copyText(newCodesText.value)
    ElMessage.success('恢复码已复制')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '复制失败')
  }
}

function downloadNewCodes() {
  const blob = new Blob([`管理后台两步验证恢复码\n\n${newCodesText.value}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'recovery-codes.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleRevoke(session) {
  if (session.current) {
    ElMessage.warning('当前会话请用右上角的「退出登录」')
    return
  }
  revokingId.value = session.id
  try {
    await revokeSession(session.id)
    ElMessage.success('该会话已注销')
    await loadSessions()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注销失败')
  } finally {
    revokingId.value = 0
  }
}

async function handleRevokeOthers() {
  const parts = []
  if (otherAdminSessionCount.value > 0) parts.push(`其他 ${otherAdminSessionCount.value} 个后台登录`)
  if (userSessions.value.count > 0) parts.push(`用户面板 / 客户端里的 ${userSessions.value.count} 个登录`)
  try {
    await ElMessageBox.confirm(
      `将注销${parts.join('和')}，其他设备需要重新登录（后台还要再次通过两步验证）。接口令牌不受影响，需要的话在「接口令牌」里单独吊销。`,
      '注销其他会话',
      { type: 'warning', confirmButtonText: '注销', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  revokingOthers.value = true
  try {
    const count = await revokeOtherSessions()
    ElMessage.success(`已注销 ${count} 个会话`)
    await Promise.all([loadSessions(), loadLoginLog()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注销失败')
  } finally {
    revokingOthers.value = false
  }
}

async function handleRevokeUser() {
  try {
    await ElMessageBox.confirm(
      `将清除用户面板 / 客户端里的 ${userSessions.value.count} 个登录，这些地方需要重新登录。后台登录和接口令牌不受影响。`,
      '清除用户面板登录',
      { type: 'warning', confirmButtonText: '清除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  revokingUser.value = true
  try {
    const count = await revokeUserSessions()
    ElMessage.success(`已清除 ${count} 个用户面板登录`)
    await Promise.all([loadSessions(), loadLoginLog()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清除失败')
  } finally {
    revokingUser.value = false
  }
}

function openTokenDialog() {
  tokenDialogStage.value = 'form'
  tokenDialogError.value = ''
  tokenForm.value = { name: '', scope: 'read', otp: '' }
  createdToken.value = null
  tokenDialogVisible.value = true
}

async function submitToken() {
  if (!tokenFormReady.value || tokenDialogLoading.value) return
  tokenDialogLoading.value = true
  tokenDialogError.value = ''
  try {
    createdToken.value = await createApiToken(tokenForm.value.name.trim(), tokenForm.value.scope, tokenForm.value.otp)
    tokenDialogStage.value = 'done'
  } catch (error) {
    tokenDialogError.value = error instanceof Error ? error.message : '创建失败'
  } finally {
    tokenForm.value.otp = ''
    tokenDialogLoading.value = false
  }
}

function closeTokenDialog() {
  tokenDialogVisible.value = false
  if (tokenDialogStage.value === 'done') {
    createdToken.value = null
    loadApiTokens()
    loadLoginLog()
  }
}

async function handleRevokeToken(token) {
  try {
    await ElMessageBox.confirm(
      `吊销后，用「${token.name}」这个令牌的程序会立刻失去后台权限。`,
      '吊销接口令牌',
      { type: 'warning', confirmButtonText: '吊销', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  revokingTokenId.value = token.id
  try {
    await revokeApiToken(token.id)
    ElMessage.success('令牌已吊销')
    await Promise.all([loadApiTokens(), loadLoginLog()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '吊销失败')
  } finally {
    revokingTokenId.value = 0
  }
}

function describeUserAgent(ua) {
  if (!ua) return ''
  if (/^(Go-http-client|curl|python-requests|python-httpx|axios|node-fetch|okhttp)\b/i.test(ua) || /^Python|^Java\//.test(ua)) return '程序'
  if (/Mozilla\//.test(ua)) return '浏览器'
  return '客户端'
}

function describeClient(session) {
  if (!session.admin) return '用户面板 / 其他客户端'
  const ua = session.userAgent || ''
  if (!ua) return '管理后台'
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    '浏览器'
  const os =
    (/iPhone|iPad/.test(ua) && 'iOS') ||
    (/Android/.test(ua) && 'Android') ||
    (/Mac OS X/.test(ua) && 'macOS') ||
    (/Windows/.test(ua) && 'Windows') ||
    (/Linux/.test(ua) && 'Linux') ||
    ''
  return `管理后台 · ${browser}${os ? ` / ${os}` : ''}`
}

onMounted(refreshAll)
</script>

<template>
  <div class="page-stack security-page">
    <SectionCard title="两步验证" description="后台登录必须通过验证器（TOTP）。拿到密码的人没有你的手机进不了后台；换手机前先在这里重新绑定。">
      <template #actions>
        <el-button :loading="statusLoading" @click="refreshAll">
          <el-icon><RefreshCw /></el-icon>
          <span>刷新</span>
        </el-button>
      </template>

      <el-alert v-if="statusError" type="error" :closable="false" :title="statusError" style="margin-bottom: 12px" />

      <div v-loading="statusLoading" class="security-status">
        <div class="security-status__item">
          <span class="security-status__label">状态</span>
          <el-tag :type="status.enabled ? 'success' : 'danger'" effect="light" round>
            <el-icon><ShieldCheck /></el-icon>
            <span>{{ status.enabled ? '已启用' : '未绑定' }}</span>
          </el-tag>
        </div>
        <div class="security-status__item">
          <span class="security-status__label">绑定时间</span>
          <strong>{{ formatTimestamp(status.confirmedAt) }}</strong>
        </div>
        <div class="security-status__item">
          <span class="security-status__label">剩余恢复码</span>
          <el-tag :type="recoveryTone" effect="plain" round>{{ status.recoveryCodesRemaining }} / 8</el-tag>
        </div>
        <div class="security-status__item">
          <span class="security-status__label">后台登录有效期</span>
          <strong>{{ status.sessionDays }} 天</strong>
          <router-link class="x-link" :to="toSettings('security')">去修改</router-link>
        </div>
      </div>

      <el-alert
        v-if="status.enabled && status.recoveryCodesRemaining <= 2"
        type="warning"
        :closable="false"
        show-icon
        class="security-status__warning"
        :title="status.recoveryCodesRemaining === 0 ? '恢复码已用完：手机丢失将无法登录，请立即重新生成' : '恢复码只剩 ' + status.recoveryCodesRemaining + ' 个，建议重新生成一组并妥善保存'"
      />

      <div class="security-actions">
        <el-button type="primary" plain :disabled="!status.enabled" @click="openDialog('rebind')">
          <el-icon><KeyRound /></el-icon>
          <span>重新绑定验证器</span>
        </el-button>
        <el-button plain :disabled="!status.enabled" @click="openDialog('recovery')">
          <el-icon><RefreshCw /></el-icon>
          <span>重新生成恢复码</span>
        </el-button>
      </div>
      <p class="security-note">
        手机丢失又没有恢复码时，只能在服务器上执行
        <code>php artisan admin:two-factor-reset 管理员邮箱</code>
        解除绑定（不提供任何网页入口，这是有意为之）。
      </p>
    </SectionCard>

    <SectionCard title="登录会话" description="后台登录逐条列出，用户面板和客户端里的登录合成一行。怀疑泄露时先「注销其他会话」，再改密码并重新绑定验证器。">
      <template #actions>
        <el-button type="danger" plain :disabled="otherSessionCount === 0" :loading="revokingOthers" @click="handleRevokeOthers">
          <el-icon><LogOut /></el-icon>
          <span>注销其他会话</span>
        </el-button>
      </template>

      <el-alert v-if="sessionsError" type="error" :closable="false" :title="sessionsError" style="margin-bottom: 12px" />

      <el-table :data="sessions" v-loading="sessionsLoading" class="dashboard-table" empty-text="没有后台登录">
        <el-table-column label="设备" min-width="220">
          <template #default="{ row }">
            <div class="session-cell">
              <strong>{{ describeClient(row) }}</strong>
              <el-tag v-if="row.current" size="small" type="success" effect="light" round>当前</el-tag>
            </div>
            <span v-if="row.userAgent" class="session-cell__ua" :title="row.userAgent">{{ row.userAgent }}</span>
          </template>
        </el-table-column>
        <el-table-column label="IP" prop="ip" min-width="140">
          <template #default="{ row }">{{ row.ip || '--' }}</template>
        </el-table-column>
        <el-table-column label="登录时间" min-width="150">
          <template #default="{ row }">{{ formatTimestamp(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="最近活动" min-width="150">
          <template #default="{ row }">{{ formatTimestamp(row.lastUsedAt) }}</template>
        </el-table-column>
        <el-table-column label="到期" min-width="150">
          <template #default="{ row }">{{ formatTimestamp(row.expiresAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.current"
              link
              type="danger"
              size="small"
              :loading="revokingId === row.id"
              @click="handleRevoke(row)"
            >
              注销
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="user-sessions" :class="{ 'user-sessions--flood': userSessions.count >= USER_SESSION_FLOOD }">
        <div class="user-sessions__icon">
          <el-icon><Users /></el-icon>
        </div>
        <div class="user-sessions__body">
          <strong>用户面板 / 客户端登录：{{ userSessions.count }} 个</strong>
          <span v-if="userSessions.count > 0" class="user-sessions__meta">
            最近一次登录 {{ formatTimestamp(userSessions.lastCreatedAt) }}
            <template v-if="userSessions.latestIp"> · {{ userSessions.latestIp }}</template>
            <template v-if="userSessions.latestUserAgent">
              · <span :title="userSessions.latestUserAgent">{{ describeUserAgent(userSessions.latestUserAgent) }}（{{ userSessions.latestUserAgent }}）</span>
            </template>
          </span>
          <span v-else class="user-sessions__meta">这个账号没有在用户面板或客户端里登录。</span>
          <span v-if="userSessions.count >= USER_SESSION_FLOOD" class="user-sessions__hint">
            数量这么多，通常是某个程序在用邮箱密码反复登录。给它在下面新建一个「接口令牌」，改用令牌后就不会再增加。
          </span>
        </div>
        <el-button plain :disabled="userSessions.count === 0" :loading="revokingUser" @click="handleRevokeUser">全部清除</el-button>
      </div>
    </SectionCard>

    <SectionCard title="接口令牌" description="给通知机器人、对账脚本等程序用，代替邮箱密码登录。只读令牌只能查询订单、工单、用户等数据，改不了任何东西；所有令牌都打不开本页、签不出新令牌。令牌不会过期，不用了请吊销。">
      <template #actions>
        <el-button type="primary" plain :disabled="!status.enabled" @click="openTokenDialog">
          <el-icon><Plus /></el-icon>
          <span>新建令牌</span>
        </el-button>
      </template>

      <el-alert v-if="apiTokensError" type="error" :closable="false" :title="apiTokensError" style="margin-bottom: 12px" />

      <el-table :data="apiTokens" v-loading="apiTokensLoading" class="dashboard-table" empty-text="还没有接口令牌">
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <div class="session-cell">
              <el-icon class="api-token__icon"><Bot /></el-icon>
              <strong>{{ row.name }}</strong>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="权限" min-width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.scope === 'full' ? 'warning' : 'info'" effect="light" round>
              {{ row.scope === 'full' ? '完整权限' : '只读' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="150">
          <template #default="{ row }">{{ formatTimestamp(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="最近使用" min-width="150">
          <template #default="{ row }">{{ row.lastUsedAt ? formatTimestamp(row.lastUsedAt) : '从未使用' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" :loading="revokingTokenId === row.id" @click="handleRevokeToken(row)">吊销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <SectionCard title="最近登录记录" description="所有管理员账号的登录、密码错误与验证码错误。密码连续错误导致锁定、验证码错满作废时，还会推送到绑定了 Telegram 的管理员。">
      <el-alert v-if="loginLogError" type="error" :closable="false" :title="loginLogError" style="margin-bottom: 12px" />

      <el-table :data="loginLog" v-loading="loginLogLoading" class="dashboard-table" empty-text="暂无记录">
        <el-table-column label="时间" min-width="150">
          <template #default="{ row }">{{ formatTimestamp(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="事件" min-width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="row.actionType" effect="light">{{ row.actionText }}</el-tag>
            <span v-if="row.recoveryCode" class="login-log__note">恢复码</span>
          </template>
        </el-table-column>
        <el-table-column label="账号" prop="email" min-width="200" />
        <el-table-column label="IP" prop="ip" min-width="140">
          <template #default="{ row }">{{ row.ip || '--' }}</template>
        </el-table-column>
        <el-table-column label="客户端" min-width="240">
          <template #default="{ row }">
            <span class="session-cell__ua" :title="row.userAgent">{{ row.userAgent || '--' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="min(520px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      @closed="closeDialog"
    >
      <el-alert v-if="dialogError" type="error" :closable="false" show-icon :title="dialogError" style="margin-bottom: 12px" />

      <!-- 验当前验证码 -->
      <template v-if="dialogStage === 'otp'">
        <p class="dialog-copy">
          {{ dialogMode === 'rebind' ? '更换验证器前先确认是本人：输入当前验证器里的 6 位码（或一个恢复码）。' : '输入当前验证器里的 6 位码（或一个恢复码）后生成新的一组恢复码，旧的全部作废。' }}
        </p>
        <el-input
          v-model="otp"
          size="large"
          placeholder="6 位验证码或恢复码"
          maxlength="11"
          autocomplete="one-time-code"
          spellcheck="false"
          @keyup.enter="submitOtp"
        >
          <template #prefix>
            <el-icon><KeyRound /></el-icon>
          </template>
        </el-input>
      </template>

      <!-- 扫新二维码 -->
      <template v-else-if="dialogStage === 'scan' && rebindInfo">
        <div class="totp-setup totp-setup--dialog">
          <div class="totp-setup__qr">
            <img :src="rebindInfo.qrSvg" alt="两步验证二维码" />
          </div>
          <div class="totp-setup__steps">
            <ol class="totp-setup__list">
              <li>用新手机的验证器扫码，或手动输入密钥：</li>
              <li>
                <div class="totp-setup__secret">
                  <code>{{ rebindInfo.secretGrouped }}</code>
                  <CopyButton :value="rebindInfo.secret" label="复制" />
                </div>
              </li>
              <li>输入新条目显示的 6 位码确认。确认之前旧验证器仍然有效。</li>
            </ol>
            <el-input
              v-model="otp"
              size="large"
              placeholder="新条目的 6 位验证码"
              maxlength="7"
              inputmode="numeric"
              autocomplete="one-time-code"
              @keyup.enter="submitOtp"
            >
              <template #prefix>
                <el-icon><KeyRound /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <!-- 展示新恢复码 -->
      <template v-else-if="dialogStage === 'codes'">
        <p class="dialog-copy">这组恢复码只显示这一次。每个只能用一次，请保存到密码管理器或打印收好。</p>
        <ul class="recovery-codes recovery-codes--dialog">
          <li v-for="code in newRecoveryCodes" :key="code"><code>{{ code }}</code></li>
        </ul>
        <div class="recovery-codes__actions">
          <el-button @click="copyNewCodes">复制全部</el-button>
          <el-button @click="downloadNewCodes">
            <el-icon><Download /></el-icon>
            <span>下载 txt</span>
          </el-button>
        </div>
      </template>

      <template #footer>
        <template v-if="dialogStage === 'codes'">
          <el-button type="primary" @click="dialogVisible = false">我已保存</el-button>
        </template>
        <template v-else>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!otpReady" :loading="dialogLoading" @click="submitOtp">
            {{ dialogStage === 'scan' ? '确认更换' : '下一步' }}
          </el-button>
        </template>
      </template>
    </el-dialog>

    <el-dialog
      v-model="tokenDialogVisible"
      :title="tokenDialogStage === 'done' ? '令牌已创建' : '新建接口令牌'"
      width="min(560px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      @closed="closeTokenDialog"
    >
      <el-alert v-if="tokenDialogError" type="error" :closable="false" show-icon :title="tokenDialogError" style="margin-bottom: 12px" />

      <el-form v-if="tokenDialogStage === 'form'" label-position="top" class="api-token-form" @submit.prevent="submitToken">
        <el-form-item label="名称">
          <el-input v-model="tokenForm.name" maxlength="40" show-word-limit placeholder="例如：订单通知机器人" />
        </el-form-item>
        <el-form-item label="权限">
          <el-radio-group v-model="tokenForm.scope" class="api-token-scope">
            <el-radio value="read" border>
              <strong>只读（推荐）</strong>
              <span>只能查询订单、工单、用户、支付等数据，适合通知机器人。</span>
            </el-radio>
            <el-radio value="full" border>
              <strong>完整权限</strong>
              <span>能做后台里的一切操作（账号安全页除外）。只给确实要改数据的程序。</span>
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="验证码">
          <el-input
            v-model="tokenForm.otp"
            placeholder="当前验证器里的 6 位码（或一个恢复码）"
            maxlength="11"
            autocomplete="one-time-code"
            spellcheck="false"
            @keyup.enter="submitToken"
          >
            <template #prefix>
              <el-icon><KeyRound /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <template v-else-if="tokenDialogStage === 'done' && createdToken">
        <p class="dialog-copy">令牌只显示这一次，关掉后无法再查看，请现在复制并填进程序。</p>
        <div class="api-token-secret">
          <code>{{ createdToken.token }}</code>
          <CopyButton :value="createdToken.token" label="复制令牌" variant="plain" success-message="令牌已复制" />
        </div>
        <ul class="api-token-usage">
          <li>请求头：<code>Authorization: Bearer 令牌</code></li>
          <li v-if="apiBaseUrl">接口地址：<code class="api-token-usage__url">{{ apiBaseUrl }}</code>（后面接 <code>order/fetch</code>、<code>ticket/fetch</code> 等，与后台页面调用的一致）</li>
          <li>不需要再调用登录接口，也不需要验证码。{{ createdToken.scope === 'read' ? '这是只读令牌，任何修改请求都会被拒绝。' : '这是完整权限令牌，请只放在可信的服务器上。' }}</li>
        </ul>
      </template>

      <template #footer>
        <template v-if="tokenDialogStage === 'done'">
          <el-button type="primary" @click="tokenDialogVisible = false">我已保存</el-button>
        </template>
        <template v-else>
          <el-button @click="tokenDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!tokenFormReady" :loading="tokenDialogLoading" @click="submitToken">创建</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>
