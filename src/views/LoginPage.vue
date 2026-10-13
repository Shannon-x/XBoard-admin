<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Sparkles, Mail, Lock, ArrowRight, ShieldCheck, KeyRound, ArrowLeft, Download } from 'lucide-vue-next'

import CopyButton from '../components/common/CopyButton.vue'
import { useAuthStore } from '../stores/auth'
import { TWO_FACTOR_STATE } from '../services/auth'
import { copyText } from '../utils/clipboard'

const loginForm = reactive({
  email: '',
  password: '',
})

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const formRef = ref()
const { t } = useI18n()

// 登录分四步：credentials（邮箱密码）→ setup（首次绑定验证器）→ recovery（抄恢复码）→ 进后台；
// 已绑定的账号则是 credentials → verify（输验证码 / 恢复码）→ 进后台。
const step = ref('credentials')
const otp = ref('')
const otpInputRef = ref()
const useRecoveryCode = ref(false)
const setupInfo = ref(null)
const setupLoading = ref(false)
const recoveryCodes = ref([])
const recoveryAcknowledged = ref(false)

const loginRules = {
  email: [
    { required: true, message: t('auth.loginRules.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('auth.loginRules.emailInvalid'), trigger: ['blur', 'change'] },
  ],
  password: [{ required: true, message: t('auth.loginRules.passwordRequired'), trigger: 'blur' }],
}

const otpPlaceholder = computed(function otpPlaceholder() {
  return useRecoveryCode.value ? t('auth.twoFactor.recoveryPlaceholder') : t('auth.twoFactor.codePlaceholder')
})

const otpReady = computed(function otpReady() {
  const value = otp.value.replace(/[\s-]/g, '')
  return useRecoveryCode.value ? value.length === 10 : /^\d{6}$/.test(value)
})

const recoveryText = computed(function recoveryText() {
  return recoveryCodes.value.join('\n')
})

function resolveRedirectPath() {
  // 防止 ?redirect= 跳到外站（//evil.com 之类的协议相对 URL）
  const raw = route.query.redirect
  if (typeof raw !== 'string') return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

async function focusOtp() {
  await nextTick()
  otpInputRef.value?.focus?.()
}

async function enterPanel(message) {
  ElMessage.success(message || t('auth.loginSuccess'))
  await router.push(resolveRedirectPath())
}

function backToPassword() {
  authStore.cancelPendingLogin()
  step.value = 'credentials'
  otp.value = ''
  useRecoveryCode.value = false
  setupInfo.value = null
  recoveryCodes.value = []
  recoveryAcknowledged.value = false
}

// 挑战过期 / 作废时 store 会清掉 pendingChallenge，这里跟着退回密码步骤
watch(
  () => authStore.pendingChallenge,
  function onChallengeChange(pending) {
    if (!pending && step.value !== 'credentials' && step.value !== 'recovery') {
      step.value = 'credentials'
      otp.value = ''
    }
  },
)

async function handleLogin() {
  if (!formRef.value) {
    return
  }

  const isValid = await formRef.value.validate().catch(function onValidateError() {
    return false
  })

  if (!isValid) {
    return
  }

  try {
    const pending = await authStore.login({
      email: loginForm.email,
      password: loginForm.password,
    })
    otp.value = ''
    useRecoveryCode.value = false
    if (pending.twoFactor === TWO_FACTOR_STATE.SETUP_REQUIRED) {
      await loadSetup()
    } else {
      step.value = 'verify'
      await focusOtp()
    }
  } catch {
    ElMessage.error(authStore.loginError || t('auth.loginFailed'))
  }
}

async function loadSetup() {
  setupLoading.value = true
  try {
    setupInfo.value = await authStore.beginTwoFactorSetup()
    step.value = 'setup'
    await focusOtp()
  } catch {
    ElMessage.error(authStore.loginError || t('auth.twoFactor.setupFailed'))
  } finally {
    setupLoading.value = false
  }
}

async function handleConfirmSetup() {
  if (!otpReady.value) {
    return
  }
  try {
    recoveryCodes.value = await authStore.confirmTwoFactorSetup(otp.value)
    recoveryAcknowledged.value = false
    step.value = 'recovery'
  } catch {
    ElMessage.error(authStore.loginError || t('auth.twoFactor.codeInvalid'))
    otp.value = ''
    await focusOtp()
  }
}

async function handleVerify() {
  if (!otpReady.value) {
    return
  }
  try {
    const result = await authStore.completeTwoFactor(otp.value)
    if (result.usedRecoveryCode) {
      await enterPanel(t('auth.twoFactor.recoveryUsed', { count: result.recoveryCodesRemaining }))
      return
    }
    await enterPanel()
  } catch {
    ElMessage.error(authStore.loginError || t('auth.twoFactor.codeInvalid'))
    otp.value = ''
    await focusOtp()
  }
}

function toggleRecoveryCode() {
  useRecoveryCode.value = !useRecoveryCode.value
  otp.value = ''
  focusOtp()
}

async function copyRecoveryCodes() {
  try {
    await copyText(recoveryText.value)
    ElMessage.success(t('auth.twoFactor.recoveryCopied'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('auth.twoFactor.recoveryCopyFailed'))
  }
}

function downloadRecoveryCodes() {
  const blob = new Blob([`${t('app.brand')} ${t('auth.twoFactor.recoveryFileTitle')}\n\n${recoveryText.value}\n`], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'recovery-codes.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function finishRecovery() {
  if (!recoveryAcknowledged.value) {
    return
  }
  await enterPanel(t('auth.twoFactor.enrolled'))
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__locale">
      <span class="login-page__flag">🇨🇳</span>
      <span>CN</span>
    </div>

    <div class="login-page__content">
      <header class="login-page__brand">
        <h1>{{ t('app.brand') }}</h1>
      </header>

      <el-card shadow="never" class="login-card" :class="{ 'login-card--wide': step === 'setup' || step === 'recovery' }">
        <!-- 第一步：邮箱 + 密码 -->
        <template v-if="step === 'credentials'">
          <div class="login-card__head">
            <h2>{{ t('auth.login') }}</h2>
            <p>{{ t('auth.loginSubtitle') }}</p>
          </div>

          <el-form
            ref="formRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            class="login-form"
            @submit.prevent="handleLogin"
          >
            <el-alert
              v-if="authStore.loginError"
              type="error"
              :closable="false"
              class="login-form__alert"
              show-icon
              :title="authStore.loginError"
            />

            <el-form-item :label="t('auth.email')" prop="email">
              <el-input
                v-model="loginForm.email"
                :placeholder="t('auth.emailPlaceholder')"
                size="large"
                autocomplete="username"
              >
                <template #prefix>
                  <el-icon><Mail /></el-icon>
                </template>
                <template #suffix>
                  <span class="login-form__suffix-badge">
                    <el-icon><Sparkles /></el-icon>
                  </span>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item :label="t('auth.password')" prop="password">
              <el-input
                v-model="loginForm.password"
                :placeholder="t('auth.passwordPlaceholder')"
                size="large"
                type="password"
                show-password
                autocomplete="current-password"
                @keyup.enter="handleLogin"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <div class="login-form__meta">
              <span class="login-form__hint">
                <el-icon><ShieldCheck /></el-icon>
                {{ t('auth.twoFactor.loginHint') }}
              </span>
            </div>

            <el-button
              type="primary"
              size="large"
              class="login-form__submit"
              :loading="authStore.loginLoading || setupLoading"
              @click="handleLogin"
            >
              <span>{{ t('auth.login') }}</span>
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-form>
        </template>

        <!-- 已绑定：输入验证码 / 恢复码 -->
        <template v-else-if="step === 'verify'">
          <div class="login-card__head">
            <h2>{{ t('auth.twoFactor.verifyTitle') }}</h2>
            <p>{{ useRecoveryCode ? t('auth.twoFactor.recoverySubtitle') : t('auth.twoFactor.verifySubtitle') }}</p>
          </div>

          <el-form label-position="top" class="login-form" @submit.prevent="handleVerify">
            <el-alert
              v-if="authStore.loginError"
              type="error"
              :closable="false"
              class="login-form__alert"
              show-icon
              :title="authStore.loginError"
            />

            <el-form-item :label="useRecoveryCode ? t('auth.twoFactor.recoveryLabel') : t('auth.twoFactor.codeLabel')">
              <el-input
                ref="otpInputRef"
                v-model="otp"
                class="login-form__otp"
                :class="{ 'login-form__otp--recovery': useRecoveryCode }"
                :placeholder="otpPlaceholder"
                size="large"
                :maxlength="useRecoveryCode ? 11 : 7"
                :inputmode="useRecoveryCode ? 'text' : 'numeric'"
                autocomplete="one-time-code"
                spellcheck="false"
                @keyup.enter="handleVerify"
              >
                <template #prefix>
                  <el-icon><KeyRound /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <div class="login-form__meta login-form__meta--split">
              <button class="login-form__link" type="button" @click="backToPassword">
                <el-icon><ArrowLeft /></el-icon>
                {{ t('auth.twoFactor.backToPassword') }}
              </button>
              <button class="login-form__link" type="button" @click="toggleRecoveryCode">
                {{ useRecoveryCode ? t('auth.twoFactor.useAuthenticator') : t('auth.twoFactor.useRecovery') }}
              </button>
            </div>

            <el-button
              type="primary"
              size="large"
              class="login-form__submit"
              :disabled="!otpReady"
              :loading="authStore.loginLoading"
              @click="handleVerify"
            >
              <span>{{ t('auth.twoFactor.verifyAction') }}</span>
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-form>
        </template>

        <!-- 首次登录：绑定验证器 -->
        <template v-else-if="step === 'setup'">
          <div class="login-card__head">
            <h2>{{ t('auth.twoFactor.setupTitle') }}</h2>
            <p>{{ t('auth.twoFactor.setupSubtitle') }}</p>
          </div>

          <el-alert
            v-if="authStore.loginError"
            type="error"
            :closable="false"
            class="login-form__alert"
            show-icon
            :title="authStore.loginError"
          />

          <div v-if="setupInfo" class="totp-setup">
            <div class="totp-setup__qr">
              <img :src="setupInfo.qrSvg" :alt="t('auth.twoFactor.qrAlt')" />
            </div>
            <div class="totp-setup__steps">
              <ol class="totp-setup__list">
                <li>{{ t('auth.twoFactor.setupStep1') }}</li>
                <li>
                  {{ t('auth.twoFactor.setupStep2') }}
                  <div class="totp-setup__secret">
                    <code>{{ setupInfo.secretGrouped }}</code>
                    <CopyButton :value="setupInfo.secret" :label="t('auth.twoFactor.copySecret')" />
                  </div>
                </li>
                <li>{{ t('auth.twoFactor.setupStep3') }}</li>
              </ol>

              <el-form label-position="top" class="login-form login-form--inline" @submit.prevent="handleConfirmSetup">
                <el-form-item :label="t('auth.twoFactor.codeLabel')">
                  <el-input
                    ref="otpInputRef"
                    v-model="otp"
                    class="login-form__otp"
                    :placeholder="t('auth.twoFactor.codePlaceholder')"
                    size="large"
                    maxlength="7"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    @keyup.enter="handleConfirmSetup"
                  >
                    <template #prefix>
                      <el-icon><KeyRound /></el-icon>
                    </template>
                  </el-input>
                </el-form-item>
                <div class="login-form__meta login-form__meta--split">
                  <button class="login-form__link" type="button" @click="backToPassword">
                    <el-icon><ArrowLeft /></el-icon>
                    {{ t('auth.twoFactor.backToPassword') }}
                  </button>
                </div>
                <el-button
                  type="primary"
                  size="large"
                  class="login-form__submit"
                  :disabled="!otpReady"
                  :loading="authStore.loginLoading"
                  @click="handleConfirmSetup"
                >
                  <span>{{ t('auth.twoFactor.setupAction') }}</span>
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </el-form>
            </div>
          </div>
        </template>

        <!-- 首次绑定完成：一次性展示恢复码 -->
        <template v-else-if="step === 'recovery'">
          <div class="login-card__head">
            <h2>{{ t('auth.twoFactor.recoveryTitle') }}</h2>
            <p>{{ t('auth.twoFactor.recoveryIntro') }}</p>
          </div>

          <ul class="recovery-codes">
            <li v-for="code in recoveryCodes" :key="code"><code>{{ code }}</code></li>
          </ul>

          <div class="recovery-codes__actions">
            <el-button @click="copyRecoveryCodes">{{ t('auth.twoFactor.copyAll') }}</el-button>
            <el-button @click="downloadRecoveryCodes">
              <el-icon><Download /></el-icon>
              <span>{{ t('auth.twoFactor.download') }}</span>
            </el-button>
          </div>

          <el-alert type="warning" :closable="false" show-icon class="recovery-codes__warning" :title="t('auth.twoFactor.recoveryWarning')" />

          <el-checkbox v-model="recoveryAcknowledged" class="recovery-codes__ack">{{ t('auth.twoFactor.recoveryAck') }}</el-checkbox>

          <el-button
            type="primary"
            size="large"
            class="login-form__submit"
            :disabled="!recoveryAcknowledged"
            @click="finishRecovery"
          >
            <span>{{ t('auth.twoFactor.enterPanel') }}</span>
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </template>
      </el-card>
    </div>
  </div>
</template>
