<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, KeyRound, LogOut, RefreshCw, ShieldCheck } from 'lucide-vue-next'

import CopyButton from '../components/common/CopyButton.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { toSettings } from '../utils/crossLink'
import {
  beginRebind,
  confirmRebind,
  createEmptySecurityStatus,
  fetchLoginLog,
  fetchSecurityStatus,
  fetchSessions,
  regenerateRecoveryCodes,
  revokeOtherSessions,
  revokeSession,
} from '../services/security'
import { copyText } from '../utils/clipboard'
import { formatTimestamp } from '../utils/format'

// ===== 两步验证状态 =====
const status = ref(createEmptySecurityStatus())
const statusLoading = ref(false)
const statusError = ref('')

// ===== 会话 =====
const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)
const revokingOthers = ref(false)

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

const otherSessionCount = computed(function otherSessionCount() {
  return sessions.value.filter(function isOther(item) {
    return !item.current
  }).length
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
    sessions.value = await fetchSessions()
  } catch (error) {
    sessionsError.value = error instanceof Error ? error.message : '会话列表加载失败'
  } finally {
    sessionsLoading.value = false
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
  try {
    await ElMessageBox.confirm(
      `将注销除当前浏览器之外的全部 ${otherSessionCount.value} 个会话（包括用户面板的登录），其他设备需要重新登录并再次通过两步验证。`,
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

    <SectionCard title="登录会话" description="当前账号在各设备上的登录状态。怀疑泄露时先「注销其他会话」，再改密码并重新绑定验证器。">
      <template #actions>
        <el-button type="danger" plain :disabled="otherSessionCount === 0" :loading="revokingOthers" @click="handleRevokeOthers">
          <el-icon><LogOut /></el-icon>
          <span>注销其他会话</span>
        </el-button>
      </template>

      <el-alert v-if="sessionsError" type="error" :closable="false" :title="sessionsError" style="margin-bottom: 12px" />

      <el-table :data="sessions" v-loading="sessionsLoading" class="dashboard-table" empty-text="没有活动会话">
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
  </div>
</template>
