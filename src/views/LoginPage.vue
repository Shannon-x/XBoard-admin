<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { MagicStick, Message, Lock, Right } from '@element-plus/icons-vue'

import { useAuthStore } from '../stores/auth'

const loginForm = reactive({
  email: '',
  password: '',
})

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const formRef = ref()
const { t } = useI18n()

const loginRules = {
  email: [
    { required: true, message: t('auth.loginRules.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('auth.loginRules.emailInvalid'), trigger: ['blur', 'change'] },
  ],
  password: [{ required: true, message: t('auth.loginRules.passwordRequired'), trigger: 'blur' }],
}

function resolveRedirectPath() {
  if (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')) {
    return route.query.redirect
  }

  return '/'
}

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
    await authStore.login({
      email: loginForm.email,
      password: loginForm.password,
    })

    ElMessage.success(t('auth.loginSuccess'))
    await router.push(resolveRedirectPath())
  } catch {
    ElMessage.error(authStore.loginError || t('auth.loginFailed'))
  }
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

      <el-card shadow="never" class="login-card">
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
                <el-icon><Message /></el-icon>
              </template>
              <template #suffix>
                <span class="login-form__suffix-badge">
                  <el-icon><MagicStick /></el-icon>
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
            <button class="login-form__link" type="button">{{ t('auth.forgotPassword') }}</button>
          </div>

          <el-button
            type="primary"
            size="large"
            class="login-form__submit"
            :loading="authStore.loginLoading"
            @click="handleLogin"
          >
            <span>{{ t('auth.login') }}</span>
            <el-icon><Right /></el-icon>
          </el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>
