<script setup>
import { useI18n } from 'vue-i18n'
defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  userInfo: {
    type: Object,
    required: true,
  },
})

const { t } = useI18n()

function statusTagType(tone) {
  const typeMap = {
    danger: 'danger',
    success: 'success',
  }

  return typeMap[tone] || 'info'
}

function booleanText(value) {
  return value ? t('userInfo.status.on') : t('userInfo.status.off')
}
</script>

<template>
  <el-card v-loading="loading" class="section-card user-info-card" shadow="never">
    <div class="section-head user-info-head">
      <div>
        <h3>{{ t('userInfo.title') }}</h3>
        <p>{{ t('userInfo.description') }}</p>
      </div>

      <el-tag :type="statusTagType(userInfo.statusTone)" effect="dark">
        {{ userInfo.statusText }}
      </el-tag>
    </div>

    <div class="user-info-profile">
      <img
        v-if="userInfo.avatarUrl"
        :src="userInfo.avatarUrl"
        :alt="t('userInfo.avatarAlt')"
        class="user-info-avatar"
      />
      <div v-else class="user-info-avatar user-info-avatar--fallback">
        {{ userInfo.email.slice(0, 1).toUpperCase() }}
      </div>

      <div class="user-info-copy">
        <strong>{{ userInfo.email }}</strong>
        <span>
          {{ t('userInfo.planMeta', { plan: userInfo.planId, rate: userInfo.commissionRate }) }}
        </span>
      </div>
    </div>

    <div class="user-info-metrics">
      <article>
        <span>{{ t('userInfo.balance') }}</span>
        <strong>{{ userInfo.balance }}</strong>
      </article>
      <article>
        <span>{{ t('userInfo.commissionBalance') }}</span>
        <strong>{{ userInfo.commissionBalance }}</strong>
      </article>
      <article>
        <span>{{ t('userInfo.totalTraffic') }}</span>
        <strong>{{ userInfo.transferEnable }}</strong>
      </article>
      <article>
        <span>{{ t('userInfo.expireAt') }}</span>
        <strong>{{ userInfo.expiredAt }}</strong>
      </article>
    </div>

    <div class="user-info-grid">
      <div class="user-info-item">
        <span>{{ t('userInfo.lastLogin') }}</span>
        <strong>{{ userInfo.lastLoginAt }}</strong>
      </div>
      <div class="user-info-item">
        <span>{{ t('userInfo.createdAt') }}</span>
        <strong>{{ userInfo.createdAt }}</strong>
      </div>
      <div class="user-info-item">
        <span>{{ t('userInfo.telegramId') }}</span>
        <strong>{{ userInfo.telegramId }}</strong>
      </div>
      <div class="user-info-item">
        <span>{{ t('userInfo.remindExpire') }}</span>
        <strong>{{ booleanText(userInfo.remindExpire) }}</strong>
      </div>
      <div class="user-info-item">
        <span>{{ t('userInfo.remindTraffic') }}</span>
        <strong>{{ booleanText(userInfo.remindTraffic) }}</strong>
      </div>
      <div class="user-info-item user-info-item--wide">
        <span>{{ t('userInfo.uuid') }}</span>
        <strong>{{ userInfo.uuid }}</strong>
      </div>
    </div>
  </el-card>
</template>
