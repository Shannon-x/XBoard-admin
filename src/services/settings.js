import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptySiteSettings() {
  return {
    logo: '',
    forceHttps: false,
    stopRegister: false,
    appName: '',
    appDescription: '',
    appUrl: '',
    subscribeUrl: '',
    tryOutPlanId: 0,
    tryOutHour: 0,
    tosUrl: '',
    currency: '',
    currencySymbol: '',
    emailVerify: false,
    safeModeEnable: false,
    banGmailAlias: true,
    securePath: 'change-me',
    emailWhitelistEnable: false,
    emailWhitelistSuffix: '',
    enableCaptcha: false,
    captchaType: 'recaptcha',
    recaptchaKey: '',
    recaptchaSiteKey: '',
    recaptchaV3SecretKey: '',
    recaptchaV3SiteKey: '',
    recaptchaV3ScoreThreshold: 0.5,
    turnstileSecretKey: '',
    turnstileSiteKey: '',
    ipRegisterLimit: true,
    registerLimitCount: 2,
    registerLimitDuration: 60,
    passwordLimit: true,
    passwordTryCount: 5,
    passwordLimitDuration: 60,
    recaptchaEnable: false,
    planChangeEnable: false,
    resetTrafficMethod: 1,
    surplusEnable: false,
    newOrderEventId: 0,
    renewOrderEventId: 0,
    changeOrderEventId: 0,
    showInfoToServerEnable: false,
    showProtocolToServerEnable: false,
    ticketReplyLimit: false,
    defaultRemindExpire: false,
    defaultRemindTraffic: false,
    subscribePath: '',
    inviteForce: false,
    inviteCommission: 0,
    inviteGenLimit: 0,
    inviteNeverExpire: false,
    commissionFirstTimeEnable: false,
    commissionAutoCheckEnable: false,
    commissionWithdrawLimit: 0,
    commissionWithdrawMethod: '',
    withdrawCloseEnable: false,
    commissionDistributionEnable: false,
    commissionDistributionL1: null,
    commissionDistributionL2: null,
    commissionDistributionL3: null,
    serverToken: '',
    serverPullInterval: 60,
    serverPushInterval: 60,
    deviceLimitMode: 1,
    websocketEnable: false,
    websocketUrl: '',
    emailTemplate: 'default',
    emailHost: '',
    emailPort: 25,
    emailUsername: '',
    emailPassword: '',
    emailEncryption: 'none',
    emailFromAddress: '',
    remindMailEnable: false,
    telegramBotEnable: false,
    telegramBotToken: '',
    telegramDiscussLink: '',
    windowsVersion: '',
    windowsDownloadUrl: '',
    macosVersion: '',
    macosDownloadUrl: '',
    androidVersion: '',
    androidDownloadUrl: '',
    subscribeTemplateSingbox: '',
    subscribeTemplateClash: '',
    subscribeTemplateClashmeta: '',
    subscribeTemplateStash: '',
    subscribeTemplateSurge: '',
    subscribeTemplateSurfboard: '',
  }
}

const SETTINGS_GROUP_CONFIG = {
  site: {
    fetchKey: 'site',
    normalize: normalizeSiteSettings,
    createPayload: createSiteSettingsPayload,
  },
  security: {
    fetchKey: 'safe',
    normalize: normalizeSafeSettings,
    createPayload: createSafeSettingsPayload,
  },
  subscription: {
    fetchKey: 'subscribe',
    normalize: normalizeSubscribeSettings,
    createPayload: createSubscribeSettingsPayload,
  },
  invite: {
    fetchKey: 'invite',
    normalize: normalizeInviteSettings,
    createPayload: createInviteSettingsPayload,
  },
  node: {
    fetchKey: 'server',
    normalize: normalizeServerSettings,
    createPayload: createServerSettingsPayload,
  },
  mail: {
    fetchKey: 'email',
    normalize: normalizeEmailSettings,
    createPayload: createEmailSettingsPayload,
  },
  telegram: {
    fetchKey: 'telegram',
    normalize: normalizeTelegramSettings,
    createPayload: createTelegramSettingsPayload,
  },
  app: {
    fetchKey: 'app',
    normalize: normalizeAppSettings,
    createPayload: createAppSettingsPayload,
  },
  subscribeTemplate: {
    fetchKey: 'subscribe_template',
    normalize: normalizeSubscribeTemplateSettings,
    createPayload: createSubscribeTemplateSettingsPayload,
  },
}

export function createEmptySiteSettingsGroup(groupKey) {
  return pickSettingsGroupFields(createEmptySiteSettings(), groupKey)
}

export async function fetchSiteSettingsGroup(groupKey) {
  const groupConfig = SETTINGS_GROUP_CONFIG[groupKey]

  if (!groupConfig) {
    return {}
  }

  const payload = await requestDashboardApi(
    buildSecureV2ApiUrl('config/fetch', [['key', groupConfig.fetchKey]])
  )
  const rawGroupData = payload?.data?.[groupConfig.fetchKey]

  return groupConfig.normalize(rawGroupData)
}

export async function fetchSiteSettings() {
  const [sitePayload, safePayload, subscribePayload, invitePayload, serverPayload, emailPayload, telegramPayload, appPayload, subscribeTemplatePayload] = await Promise.all([
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'site']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'safe']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'subscribe']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'invite']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'server']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'email']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'telegram']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'app']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'subscribe_template']])),
  ])
  const site = sitePayload?.data?.site
  const safe = safePayload?.data?.safe
  const subscribe = subscribePayload?.data?.subscribe
  const invite = invitePayload?.data?.invite
  const server = serverPayload?.data?.server
  const email = emailPayload?.data?.email
  const telegram = telegramPayload?.data?.telegram
  const app = appPayload?.data?.app
  const subscribeTemplate = subscribeTemplatePayload?.data?.subscribe_template

  return {
    ...normalizeSiteSettings(site),
    ...normalizeSafeSettings(safe),
    ...normalizeSubscribeSettings(subscribe),
    ...normalizeInviteSettings(invite),
    ...normalizeServerSettings(server),
    ...normalizeEmailSettings(email),
    ...normalizeTelegramSettings(telegram),
    ...normalizeAppSettings(app),
    ...normalizeSubscribeTemplateSettings(subscribeTemplate),
  }
}

export async function saveSiteSettings(settings, originalSettings = {}, loadedGroupKeys = []) {
  const url = buildSecureV2ApiUrl('config/save')
  const payloadGroups = createSettingsPayloadGroups(settings, originalSettings, loadedGroupKeys)
  const changedPayloadGroups = payloadGroups.filter(function filterChangedGroup(group) {
    return Object.keys(group.changedPayload).length > 0
  })

  if (!changedPayloadGroups.length) {
    return normalizeSettingsCollection(payloadGroups.map(function mapGroup(group) {
      return {
        payload: group.payload,
        normalize: group.normalize,
      }
    }))
  }

  await Promise.all(changedPayloadGroups.map(function saveChangedGroup(group) {
    return requestDashboardMutation(url, group.changedPayload, 'POST')
  }))

  return normalizeSettingsCollection(payloadGroups.map(function mapGroup(group) {
    return {
      payload: group.payload,
      normalize: group.normalize,
    }
  }))
}

function createSettingsPayloadGroups(settings = {}, originalSettings = {}, loadedGroupKeys = []) {
  const groupKeys = loadedGroupKeys.length ? loadedGroupKeys : Object.keys(SETTINGS_GROUP_CONFIG)

  return groupKeys
    .map(function mapGroup(groupKey) {
      const groupConfig = SETTINGS_GROUP_CONFIG[groupKey]

      if (!groupConfig) {
        return null
      }

      const payload = groupConfig.createPayload(settings)
      const initialPayload = groupConfig.createPayload(originalSettings)

      return {
        payload,
        initialPayload,
        changedPayload: createChangedPayload(payload, initialPayload),
        normalize: groupConfig.normalize,
      }
    })
    .filter(Boolean)
}

function normalizeSettingsCollection(groups) {
  return groups.reduce(function mergeSettings(result, group) {
    return {
      ...result,
      ...group.normalize(group.payload),
    }
  }, {})
}

function arePayloadsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function createChangedPayload(payload, initialPayload) {
  return Object.keys(payload).reduce(function collectChanges(result, key) {
    if (!arePayloadsEqual(payload[key], initialPayload[key])) {
      result[key] = payload[key]
    }

  return result
  }, {})
}

function pickSettingsGroupFields(settings, groupKey) {
  const groupConfig = SETTINGS_GROUP_CONFIG[groupKey]

  if (!groupConfig) {
    return {}
  }

  return groupConfig.normalize(groupConfig.createPayload(settings))
}

export async function fetchEmailTemplateOptions() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('config/getEmailTemplate'))
  const list = Array.isArray(payload?.data) ? payload.data : []

  return list.map(function mapTemplate(template) {
    return String(template)
  })
}

export async function testSendMail() {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('config/testSendMail'), null, 'POST')

  return payload?.data || {}
}

export async function setupTelegramWebhook() {
  const payload = await requestDashboardMutation(
    buildSecureV2ApiUrl('config/setTelegramWebhook'),
    null,
    'POST'
  )

  return payload?.data
}

function normalizeSiteSettings(site) {
  const fallback = createEmptySiteSettings()

  if (!site || typeof site !== 'object') {
    return fallback
  }

  return {
    logo: String(site.logo || ''),
    forceHttps: Boolean(Number(site.force_https ?? site.forceHttps ?? 0)),
    stopRegister: Boolean(Number(site.stop_register ?? site.stopRegister ?? 0)),
    appName: String(site.app_name ?? site.appName ?? ''),
    appDescription: String(site.app_description ?? site.appDescription ?? ''),
    appUrl: String(site.app_url ?? site.appUrl ?? ''),
    subscribeUrl: String(site.subscribe_url ?? site.subscribeUrl ?? ''),
    tryOutPlanId: Number(site.try_out_plan_id ?? site.tryOutPlanId ?? 0) || 0,
    tryOutHour: Number(site.try_out_hour ?? site.tryOutHour ?? 0) || 0,
    tosUrl: String(site.tos_url ?? site.tosUrl ?? ''),
    currency: String(site.currency ?? ''),
    currencySymbol: String(site.currency_symbol ?? site.currencySymbol ?? ''),
  }
}

function createSiteSettingsPayload(settings = {}) {
  return {
    app_name: String(settings.appName || '').trim(),
    app_description: String(settings.appDescription || '').trim(),
    app_url: String(settings.appUrl || '').trim(),
    force_https: settings.forceHttps ? 1 : 0,
    logo: String(settings.logo || '').trim(),
    subscribe_url: String(settings.subscribeUrl || '').trim(),
    tos_url: String(settings.tosUrl || '').trim(),
    stop_register: settings.stopRegister ? 1 : 0,
    try_out_plan_id: Number(settings.tryOutPlanId || 0),
    currency: String(settings.currency || '').trim(),
    currency_symbol: String(settings.currencySymbol || '').trim(),
    try_out_hour: Number(settings.tryOutHour || 0),
  }
}

function normalizeSafeSettings(safe) {
  const fallback = createEmptySiteSettings()

  if (!safe || typeof safe !== 'object') {
    return {
      emailVerify: fallback.emailVerify,
      safeModeEnable: fallback.safeModeEnable,
      securePath: fallback.securePath,
      emailWhitelistEnable: fallback.emailWhitelistEnable,
      emailWhitelistSuffix: fallback.emailWhitelistSuffix,
      banGmailAlias: fallback.banGmailAlias,
      enableCaptcha: fallback.enableCaptcha,
      captchaType: fallback.captchaType,
      recaptchaKey: fallback.recaptchaKey,
      recaptchaSiteKey: fallback.recaptchaSiteKey,
      recaptchaV3SecretKey: fallback.recaptchaV3SecretKey,
      recaptchaV3SiteKey: fallback.recaptchaV3SiteKey,
      recaptchaV3ScoreThreshold: fallback.recaptchaV3ScoreThreshold,
      turnstileSecretKey: fallback.turnstileSecretKey,
      turnstileSiteKey: fallback.turnstileSiteKey,
      ipRegisterLimit: fallback.ipRegisterLimit,
      registerLimitCount: fallback.registerLimitCount,
      registerLimitDuration: fallback.registerLimitDuration,
      passwordLimit: fallback.passwordLimit,
      passwordTryCount: fallback.passwordTryCount,
      passwordLimitDuration: fallback.passwordLimitDuration,
      recaptchaEnable: fallback.recaptchaEnable,
    }
  }

  return {
    emailVerify: Boolean(safe.email_verify),
    safeModeEnable: Boolean(safe.safe_mode_enable),
    securePath: String(safe.secure_path ?? fallback.securePath),
    emailWhitelistEnable: Boolean(safe.email_whitelist_enable),
    emailWhitelistSuffix: Array.isArray(safe.email_whitelist_suffix)
      ? safe.email_whitelist_suffix.join(',')
      : String(safe.email_whitelist_suffix || ''),
    banGmailAlias: Boolean(safe.email_gmail_limit_enable),
    enableCaptcha: Boolean(safe.captcha_enable),
    captchaType: normalizeCaptchaType(safe.captcha_type ?? fallback.captchaType),
    recaptchaKey: String(safe.recaptcha_key ?? ''),
    recaptchaSiteKey: String(safe.recaptcha_site_key ?? ''),
    recaptchaV3SecretKey: String(safe.recaptcha_v3_secret_key ?? ''),
    recaptchaV3SiteKey: String(safe.recaptcha_v3_site_key ?? ''),
    recaptchaV3ScoreThreshold:
      Number(safe.recaptcha_v3_score_threshold ?? fallback.recaptchaV3ScoreThreshold) ||
      fallback.recaptchaV3ScoreThreshold,
    turnstileSecretKey: String(safe.turnstile_secret_key ?? ''),
    turnstileSiteKey: String(safe.turnstile_site_key ?? ''),
    ipRegisterLimit: Boolean(safe.register_limit_by_ip_enable),
    registerLimitCount: Number(safe.register_limit_count ?? fallback.registerLimitCount) || 0,
    registerLimitDuration:
      Number(safe.register_limit_expire ?? fallback.registerLimitDuration) || 0,
    passwordLimit: Boolean(safe.password_limit_enable),
    passwordTryCount: Number(safe.password_limit_count ?? fallback.passwordTryCount) || 0,
    passwordLimitDuration:
      Number(safe.password_limit_expire ?? fallback.passwordLimitDuration) || 0,
    recaptchaEnable: Boolean(safe.recaptcha_enable),
  }
}

function createSafeSettingsPayload(settings = {}) {
  return {
    email_verify: settings.emailVerify ? 1 : 0,
    safe_mode_enable: settings.safeModeEnable ? 1 : 0,
    secure_path: String(settings.securePath || '').trim(),
    email_whitelist_enable: settings.emailWhitelistEnable ? 1 : 0,
    email_whitelist_suffix: String(settings.emailWhitelistSuffix || '')
      .split(',')
      .map(function trimSuffix(item) {
        return item.trim()
      })
      .filter(Boolean),
    email_gmail_limit_enable: settings.banGmailAlias ? 1 : 0,
    captcha_enable: settings.enableCaptcha ? 1 : 0,
    captcha_type: normalizeCaptchaType(settings.captchaType || 'recaptcha'),
    recaptcha_key: String(settings.recaptchaKey || '').trim(),
    recaptcha_site_key: String(settings.recaptchaSiteKey || '').trim(),
    recaptcha_v3_secret_key: String(settings.recaptchaV3SecretKey || '').trim(),
    recaptcha_v3_site_key: String(settings.recaptchaV3SiteKey || '').trim(),
    recaptcha_v3_score_threshold: Number(settings.recaptchaV3ScoreThreshold || 0.5),
    turnstile_secret_key: String(settings.turnstileSecretKey || '').trim(),
    turnstile_site_key: String(settings.turnstileSiteKey || '').trim(),
    register_limit_by_ip_enable: settings.ipRegisterLimit ? 1 : 0,
    register_limit_count: Number(settings.registerLimitCount || 0),
    register_limit_expire: Number(settings.registerLimitDuration || 0),
    password_limit_enable: settings.passwordLimit ? 1 : 0,
    password_limit_count: Number(settings.passwordTryCount || 0),
    password_limit_expire: Number(settings.passwordLimitDuration || 0),
    recaptcha_enable: settings.recaptchaEnable ? 1 : 0,
  }
}

function normalizeSubscribeSettings(subscribe) {
  const fallback = createEmptySiteSettings()

  if (!subscribe || typeof subscribe !== 'object') {
    return {
      planChangeEnable: fallback.planChangeEnable,
      resetTrafficMethod: fallback.resetTrafficMethod,
      surplusEnable: fallback.surplusEnable,
      newOrderEventId: fallback.newOrderEventId,
      renewOrderEventId: fallback.renewOrderEventId,
      changeOrderEventId: fallback.changeOrderEventId,
      showInfoToServerEnable: fallback.showInfoToServerEnable,
      showProtocolToServerEnable: fallback.showProtocolToServerEnable,
      ticketReplyLimit: fallback.ticketReplyLimit,
      defaultRemindExpire: fallback.defaultRemindExpire,
      defaultRemindTraffic: fallback.defaultRemindTraffic,
      subscribePath: fallback.subscribePath,
    }
  }

  return {
    planChangeEnable: Boolean(subscribe.plan_change_enable),
    resetTrafficMethod: Number(subscribe.reset_traffic_method ?? fallback.resetTrafficMethod) || 0,
    surplusEnable: Boolean(subscribe.surplus_enable),
    newOrderEventId: Number(subscribe.new_order_event_id ?? fallback.newOrderEventId) || 0,
    renewOrderEventId: Number(subscribe.renew_order_event_id ?? fallback.renewOrderEventId) || 0,
    changeOrderEventId: Number(subscribe.change_order_event_id ?? fallback.changeOrderEventId) || 0,
    showInfoToServerEnable: Boolean(subscribe.show_info_to_server_enable),
    showProtocolToServerEnable: Boolean(subscribe.show_protocol_to_server_enable),
    ticketReplyLimit: Boolean(subscribe.ticket_reply_limit),
    defaultRemindExpire: Boolean(subscribe.default_remind_expire),
    defaultRemindTraffic: Boolean(subscribe.default_remind_traffic),
    subscribePath: String(subscribe.subscribe_path ?? ''),
  }
}

function createSubscribeSettingsPayload(settings = {}) {
  return {
    plan_change_enable: settings.planChangeEnable ? 1 : 0,
    reset_traffic_method: Number(settings.resetTrafficMethod || 0),
    surplus_enable: settings.surplusEnable ? 1 : 0,
    new_order_event_id: Number(settings.newOrderEventId || 0),
    renew_order_event_id: Number(settings.renewOrderEventId || 0),
    change_order_event_id: Number(settings.changeOrderEventId || 0),
    show_info_to_server_enable: settings.showInfoToServerEnable ? 1 : 0,
    show_protocol_to_server_enable: settings.showProtocolToServerEnable ? 1 : 0,
    ticket_reply_limit: settings.ticketReplyLimit ? 1 : 0,
    default_remind_expire: settings.defaultRemindExpire ? 1 : 0,
    default_remind_traffic: settings.defaultRemindTraffic ? 1 : 0,
    subscribe_path: String(settings.subscribePath || '').trim(),
  }
}

function normalizeInviteSettings(invite) {
  const fallback = createEmptySiteSettings()

  if (!invite || typeof invite !== 'object') {
    return {
      inviteForce: fallback.inviteForce,
      inviteCommission: fallback.inviteCommission,
      inviteGenLimit: fallback.inviteGenLimit,
      inviteNeverExpire: fallback.inviteNeverExpire,
      commissionFirstTimeEnable: fallback.commissionFirstTimeEnable,
      commissionAutoCheckEnable: fallback.commissionAutoCheckEnable,
      commissionWithdrawLimit: fallback.commissionWithdrawLimit,
      commissionWithdrawMethod: fallback.commissionWithdrawMethod,
      withdrawCloseEnable: fallback.withdrawCloseEnable,
      commissionDistributionEnable: fallback.commissionDistributionEnable,
      commissionDistributionL1: fallback.commissionDistributionL1,
      commissionDistributionL2: fallback.commissionDistributionL2,
      commissionDistributionL3: fallback.commissionDistributionL3,
    }
  }

  return {
    inviteForce: Boolean(invite.invite_force),
    inviteCommission: Number(invite.invite_commission ?? fallback.inviteCommission) || 0,
    inviteGenLimit: Number(invite.invite_gen_limit ?? fallback.inviteGenLimit) || 0,
    inviteNeverExpire: Boolean(invite.invite_never_expire),
    commissionFirstTimeEnable: Boolean(invite.commission_first_time_enable),
    commissionAutoCheckEnable: Boolean(invite.commission_auto_check_enable),
    commissionWithdrawLimit:
      Number(invite.commission_withdraw_limit ?? fallback.commissionWithdrawLimit) || 0,
    commissionWithdrawMethod: Array.isArray(invite.commission_withdraw_method)
      ? invite.commission_withdraw_method.join(',')
      : String(invite.commission_withdraw_method || ''),
    withdrawCloseEnable: Boolean(invite.withdraw_close_enable),
    commissionDistributionEnable: Boolean(invite.commission_distribution_enable),
    commissionDistributionL1:
      invite.commission_distribution_l1 === null
        ? null
        : Number(invite.commission_distribution_l1 || 0),
    commissionDistributionL2:
      invite.commission_distribution_l2 === null
        ? null
        : Number(invite.commission_distribution_l2 || 0),
    commissionDistributionL3:
      invite.commission_distribution_l3 === null
        ? null
        : Number(invite.commission_distribution_l3 || 0),
  }
}

function createInviteSettingsPayload(settings = {}) {
  return {
    invite_force: settings.inviteForce ? 1 : 0,
    invite_commission: Number(settings.inviteCommission || 0),
    invite_gen_limit: Number(settings.inviteGenLimit || 0),
    invite_never_expire: settings.inviteNeverExpire ? 1 : 0,
    commission_first_time_enable: settings.commissionFirstTimeEnable ? 1 : 0,
    commission_auto_check_enable: settings.commissionAutoCheckEnable ? 1 : 0,
    commission_withdraw_limit: Number(settings.commissionWithdrawLimit || 0),
    commission_withdraw_method: String(settings.commissionWithdrawMethod || '')
      .split(',')
      .map(function trimMethod(item) {
        return item.trim()
      })
      .filter(Boolean),
    withdraw_close_enable: settings.withdrawCloseEnable ? 1 : 0,
    commission_distribution_enable: settings.commissionDistributionEnable ? 1 : 0,
    commission_distribution_l1:
      settings.commissionDistributionL1 === null || settings.commissionDistributionL1 === ''
        ? null
        : Number(settings.commissionDistributionL1 || 0),
    commission_distribution_l2:
      settings.commissionDistributionL2 === null || settings.commissionDistributionL2 === ''
        ? null
        : Number(settings.commissionDistributionL2 || 0),
    commission_distribution_l3:
      settings.commissionDistributionL3 === null || settings.commissionDistributionL3 === ''
        ? null
        : Number(settings.commissionDistributionL3 || 0),
  }
}

function normalizeServerSettings(server) {
  const fallback = createEmptySiteSettings()

  if (!server || typeof server !== 'object') {
    return {
      serverToken: fallback.serverToken,
      serverPullInterval: fallback.serverPullInterval,
      serverPushInterval: fallback.serverPushInterval,
      deviceLimitMode: fallback.deviceLimitMode,
      websocketEnable: fallback.websocketEnable,
      websocketUrl: fallback.websocketUrl,
    }
  }

  return {
    serverToken: String(server.server_token ?? ''),
    serverPullInterval: Number(server.server_pull_interval ?? fallback.serverPullInterval) || 0,
    serverPushInterval: Number(server.server_push_interval ?? fallback.serverPushInterval) || 0,
    deviceLimitMode: Number(server.device_limit_mode ?? fallback.deviceLimitMode) || 0,
    websocketEnable: Boolean(server.websocket_enable),
    websocketUrl: String(server.websocket_url ?? ''),
  }
}

function createServerSettingsPayload(settings = {}) {
  return {
    server_token: String(settings.serverToken || '').trim(),
    server_pull_interval: Number(settings.serverPullInterval || 0),
    server_push_interval: Number(settings.serverPushInterval || 0),
    device_limit_mode: Number(settings.deviceLimitMode || 0),
    websocket_enable: settings.websocketEnable ? 1 : 0,
    websocket_url: String(settings.websocketUrl || '').trim(),
  }
}

function normalizeEmailSettings(email) {
  const fallback = createEmptySiteSettings()

  if (!email || typeof email !== 'object') {
    return {
      emailTemplate: fallback.emailTemplate,
      emailHost: fallback.emailHost,
      emailPort: fallback.emailPort,
      emailUsername: fallback.emailUsername,
      emailPassword: fallback.emailPassword,
      emailEncryption: fallback.emailEncryption,
      emailFromAddress: fallback.emailFromAddress,
      remindMailEnable: fallback.remindMailEnable,
    }
  }

  return {
    emailTemplate: String(email.email_template ?? fallback.emailTemplate),
    emailHost: String(email.email_host ?? ''),
    emailPort: Number(email.email_port ?? fallback.emailPort) || 0,
    emailUsername: String(email.email_username ?? ''),
    emailPassword: String(email.email_password ?? ''),
    emailEncryption: normalizeEmailEncryption(email.email_encryption ?? fallback.emailEncryption),
    emailFromAddress: String(email.email_from_address ?? ''),
    remindMailEnable: Boolean(email.remind_mail_enable),
  }
}

function createEmailSettingsPayload(settings = {}) {
  return {
    email_template: String(settings.emailTemplate || 'default').trim(),
    email_host: String(settings.emailHost || '').trim(),
    email_port: Number(settings.emailPort || 0),
    email_username: String(settings.emailUsername || '').trim(),
    email_password: String(settings.emailPassword || '').trim(),
    email_encryption: normalizeEmailEncryption(settings.emailEncryption || 'none'),
    email_from_address: String(settings.emailFromAddress || '').trim(),
    remind_mail_enable: settings.remindMailEnable ? 1 : 0,
  }
}

function normalizeTelegramSettings(telegram) {
  const fallback = createEmptySiteSettings()

  if (!telegram || typeof telegram !== 'object') {
    return {
      telegramBotEnable: fallback.telegramBotEnable,
      telegramBotToken: fallback.telegramBotToken,
      telegramDiscussLink: fallback.telegramDiscussLink,
    }
  }

  return {
    telegramBotEnable: Boolean(telegram.telegram_bot_enable),
    telegramBotToken: String(telegram.telegram_bot_token ?? ''),
    telegramDiscussLink: String(telegram.telegram_discuss_link ?? ''),
  }
}

function createTelegramSettingsPayload(settings = {}) {
  return {
    telegram_bot_enable: settings.telegramBotEnable ? 1 : 0,
    telegram_bot_token: String(settings.telegramBotToken || '').trim(),
    telegram_discuss_link: String(settings.telegramDiscussLink || '').trim(),
  }
}

function normalizeAppSettings(app) {
  const fallback = createEmptySiteSettings()

  if (!app || typeof app !== 'object') {
    return {
      windowsVersion: fallback.windowsVersion,
      windowsDownloadUrl: fallback.windowsDownloadUrl,
      macosVersion: fallback.macosVersion,
      macosDownloadUrl: fallback.macosDownloadUrl,
      androidVersion: fallback.androidVersion,
      androidDownloadUrl: fallback.androidDownloadUrl,
    }
  }

  return {
    windowsVersion: String(app.windows_version ?? ''),
    windowsDownloadUrl: String(app.windows_download_url ?? ''),
    macosVersion: String(app.macos_version ?? ''),
    macosDownloadUrl: String(app.macos_download_url ?? ''),
    androidVersion: String(app.android_version ?? ''),
    androidDownloadUrl: String(app.android_download_url ?? ''),
  }
}

function createAppSettingsPayload(settings = {}) {
  return {
    windows_version: String(settings.windowsVersion || '').trim(),
    windows_download_url: String(settings.windowsDownloadUrl || '').trim(),
    macos_version: String(settings.macosVersion || '').trim(),
    macos_download_url: String(settings.macosDownloadUrl || '').trim(),
    android_version: String(settings.androidVersion || '').trim(),
    android_download_url: String(settings.androidDownloadUrl || '').trim(),
  }
}

function normalizeSubscribeTemplateSettings(subscribeTemplate) {
  const fallback = createEmptySiteSettings()

  if (!subscribeTemplate || typeof subscribeTemplate !== 'object') {
    return {
      subscribeTemplateSingbox: fallback.subscribeTemplateSingbox,
      subscribeTemplateClash: fallback.subscribeTemplateClash,
      subscribeTemplateClashmeta: fallback.subscribeTemplateClashmeta,
      subscribeTemplateStash: fallback.subscribeTemplateStash,
      subscribeTemplateSurge: fallback.subscribeTemplateSurge,
      subscribeTemplateSurfboard: fallback.subscribeTemplateSurfboard,
    }
  }

  return {
    subscribeTemplateSingbox: String(subscribeTemplate.subscribe_template_singbox ?? ''),
    subscribeTemplateClash: String(subscribeTemplate.subscribe_template_clash ?? ''),
    subscribeTemplateClashmeta: String(subscribeTemplate.subscribe_template_clashmeta ?? ''),
    subscribeTemplateStash: String(subscribeTemplate.subscribe_template_stash ?? ''),
    subscribeTemplateSurge: String(subscribeTemplate.subscribe_template_surge ?? ''),
    subscribeTemplateSurfboard: String(subscribeTemplate.subscribe_template_surfboard ?? ''),
  }
}

function createSubscribeTemplateSettingsPayload(settings = {}) {
  return {
    subscribe_template_singbox: String(settings.subscribeTemplateSingbox || ''),
    subscribe_template_clash: String(settings.subscribeTemplateClash || ''),
    subscribe_template_clashmeta: String(settings.subscribeTemplateClashmeta || ''),
    subscribe_template_stash: String(settings.subscribeTemplateStash || ''),
    subscribe_template_surge: String(settings.subscribeTemplateSurge || ''),
    subscribe_template_surfboard: String(settings.subscribeTemplateSurfboard || ''),
  }
}

function normalizeCaptchaType(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (normalizedValue === 'recaptcha-v3' || normalizedValue === 'recaptcha_v3') {
    return 'recaptcha-v3'
  }

  if (normalizedValue === 'turnstile') {
    return 'turnstile'
  }

  return 'recaptcha'
}

function normalizeEmailEncryption(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (normalizedValue === 'ssl') {
    return 'ssl'
  }

  if (normalizedValue === 'tls') {
    return 'tls'
  }

  return 'none'
}
