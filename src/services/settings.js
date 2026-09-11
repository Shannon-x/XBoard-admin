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
    googleLoginEnable: false,
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: '',
    googleCallbackUrl: '',
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
    ticketActiveSubscriptionRequired: false,
    defaultRemindExpire: false,
    defaultRemindTraffic: false,
    subscribePath: '',
    addonGroupLabel: '',
    // 流量加购包站点默认：单价（元/GB，0 = 不开放）、单次 GB 上下限、快捷档位
    trafficTopupPricePerGb: 0,
    trafficTopupMinGb: 1,
    trafficTopupMaxGb: 1000,
    trafficTopupPresets: '10,50,100,200',
    // 续费助手：自动续费开关 / 提前小时 / 宽限小时；仪表盘快捷续费提醒提前天数
    autoRenewEnable: true,
    autoRenewLeadHours: 24,
    autoRenewGraceHours: 72,
    renewPromptDays: 7,
    inviteForce: false,
    inviteCommission: 0,
    inviteGenLimit: 0,
    inviteNeverExpire: false,
    commissionFirstTimeEnable: false,
    commissionAutoCheckEnable: false,
    commissionWithdrawLimit: 0,
    commissionWithdrawMethod: '',
    // 提现工作流（链列表 / 单笔上限 / USDT 参考汇率 / 是否必须二维码 / 结算感谢语）
    commissionWithdrawChains: [],
    commissionWithdrawMax: 0,
    commissionWithdrawRateSource: 'auto',
    commissionWithdrawUsdtRate: 0,
    commissionWithdrawRequireQrcode: false,
    commissionWithdrawThanks: '',
    // 只读：后端提供的地址格式预设
    commissionWithdrawPresets: [],
    commissionWithdrawNetworks: [],
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
    ticketAttachmentEnable: false,
    ticketAttachmentDriver: 'local',
    ticketAttachmentMaxSizeMb: 5,
    ticketAttachmentMaxCount: 5,
    ticketAttachmentAllowedExtensions: 'jpg,jpeg,png,gif,webp,pdf,txt,log,zip',
    ticketAttachmentDailyQuotaMb: 30,
    ticketAttachmentRetentionDays: 365,
    ticketAttachmentS3Endpoint: '',
    ticketAttachmentS3Region: 'auto',
    ticketAttachmentS3Bucket: '',
    ticketAttachmentS3AccessKey: '',
    ticketAttachmentS3SecretKey: '',
    ticketAttachmentS3PathStyle: true,
    ticketAttachmentS3Prefix: 'ticket-attachments',
    ticketAttachmentS3PublicUrl: '',
    // 只读：后端硬上限，表单用来限制输入范围
    ticketAttachmentHardMaxSizeMb: 20,
    ticketAttachmentHardMaxCount: 10,
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
  ticketAttachment: {
    fetchKey: 'ticket',
    normalize: normalizeTicketAttachmentSettings,
    createPayload: createTicketAttachmentSettingsPayload,
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
  const [sitePayload, safePayload, subscribePayload, invitePayload, serverPayload, emailPayload, telegramPayload, appPayload, subscribeTemplatePayload, ticketPayload] = await Promise.all([
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'site']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'safe']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'subscribe']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'invite']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'server']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'email']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'telegram']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'app']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'subscribe_template']])),
    requestDashboardApi(buildSecureV2ApiUrl('config/fetch', [['key', 'ticket']])),
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
  const ticket = ticketPayload?.data?.ticket

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
    ...normalizeTicketAttachmentSettings(ticket),
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

/**
 * 工单附件「测试存储连接」：把表单里当前的附件配置（可能尚未保存）一起发过去，
 * 后端用它们覆盖已保存的值做写入 → 读回 → 删除探针。
 */
export async function testTicketAttachmentStorage(settings = {}) {
  const payload = await requestDashboardMutation(
    buildSecureV2ApiUrl('config/testTicketAttachmentStorage'),
    createTicketAttachmentSettingsPayload(settings),
    'POST'
  )

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
      googleLoginEnable: fallback.googleLoginEnable,
      googleClientId: fallback.googleClientId,
      googleClientSecret: fallback.googleClientSecret,
      googleRedirectUri: fallback.googleRedirectUri,
      googleCallbackUrl: fallback.googleCallbackUrl,
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
    googleLoginEnable: Boolean(safe.google_login_enable),
    googleClientId: String(safe.google_client_id ?? ''),
    googleClientSecret: String(safe.google_client_secret ?? ''),
    googleRedirectUri: String(safe.google_redirect_uri ?? ''),
    googleCallbackUrl: String(safe.google_callback_url ?? ''),
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
    // 秘钥字段不 trim：用户偶尔会粘贴带前后空格的 secret，trim 后实际发出去的
    // 值与显示出来的不一致，下一次读回时也再次 trim，难以发现"为什么生效不了"。
    // 让后端自己决定是否容忍空格，这里保持原值。
    recaptcha_key: String(settings.recaptchaKey ?? ''),
    recaptcha_site_key: String(settings.recaptchaSiteKey ?? ''),
    recaptcha_v3_secret_key: String(settings.recaptchaV3SecretKey ?? ''),
    recaptcha_v3_site_key: String(settings.recaptchaV3SiteKey ?? ''),
    recaptcha_v3_score_threshold: Number(settings.recaptchaV3ScoreThreshold || 0.5),
    turnstile_secret_key: String(settings.turnstileSecretKey ?? ''),
    turnstile_site_key: String(settings.turnstileSiteKey ?? ''),
    google_login_enable: settings.googleLoginEnable ? 1 : 0,
    google_client_id: String(settings.googleClientId ?? ''),
    google_client_secret: String(settings.googleClientSecret ?? ''),
    google_redirect_uri: String(settings.googleRedirectUri ?? '').trim(),
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
      ticketActiveSubscriptionRequired: fallback.ticketActiveSubscriptionRequired,
      defaultRemindExpire: fallback.defaultRemindExpire,
      defaultRemindTraffic: fallback.defaultRemindTraffic,
      subscribePath: fallback.subscribePath,
      addonGroupLabel: fallback.addonGroupLabel,
      trafficTopupPricePerGb: fallback.trafficTopupPricePerGb,
      trafficTopupMinGb: fallback.trafficTopupMinGb,
      trafficTopupMaxGb: fallback.trafficTopupMaxGb,
      trafficTopupPresets: fallback.trafficTopupPresets,
      autoRenewEnable: fallback.autoRenewEnable,
      autoRenewLeadHours: fallback.autoRenewLeadHours,
      autoRenewGraceHours: fallback.autoRenewGraceHours,
      renewPromptDays: fallback.renewPromptDays,
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
    ticketActiveSubscriptionRequired: Boolean(subscribe.ticket_active_subscription_required),
    defaultRemindExpire: Boolean(subscribe.default_remind_expire),
    defaultRemindTraffic: Boolean(subscribe.default_remind_traffic),
    subscribePath: String(subscribe.subscribe_path ?? ''),
    // 增值节点组在用户端的区块标题；空 = 前端回落 i18n 默认
    addonGroupLabel: String(subscribe.addon_group_label ?? ''),
    // 后端存「分/GB」，界面按「元/GB」编辑
    trafficTopupPricePerGb: (Number(subscribe.traffic_topup_price_per_gb) || 0) / 100,
    trafficTopupMinGb: Number(subscribe.traffic_topup_min_gb) || 1,
    trafficTopupMaxGb: Number(subscribe.traffic_topup_max_gb) || 1000,
    trafficTopupPresets: String(subscribe.traffic_topup_presets ?? fallback.trafficTopupPresets),
    autoRenewEnable: subscribe.auto_renew_enable === undefined ? fallback.autoRenewEnable : Boolean(subscribe.auto_renew_enable),
    autoRenewLeadHours: Number(subscribe.auto_renew_lead_hours) || fallback.autoRenewLeadHours,
    autoRenewGraceHours: subscribe.auto_renew_grace_hours === undefined || subscribe.auto_renew_grace_hours === null
      ? fallback.autoRenewGraceHours : Math.max(0, Number(subscribe.auto_renew_grace_hours) || 0),
    renewPromptDays: subscribe.renew_prompt_days === undefined || subscribe.renew_prompt_days === null
      ? fallback.renewPromptDays : Math.max(0, Number(subscribe.renew_prompt_days) || 0),
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
    ticket_active_subscription_required: settings.ticketActiveSubscriptionRequired ? 1 : 0,
    default_remind_expire: settings.defaultRemindExpire ? 1 : 0,
    default_remind_traffic: settings.defaultRemindTraffic ? 1 : 0,
    subscribe_path: String(settings.subscribePath || '').trim(),
    addon_group_label: String(settings.addonGroupLabel || '').trim().slice(0, 32),
    traffic_topup_price_per_gb: Math.max(0, Math.round((Number(settings.trafficTopupPricePerGb) || 0) * 100)),
    traffic_topup_min_gb: Math.max(1, Math.round(Number(settings.trafficTopupMinGb) || 1)),
    traffic_topup_max_gb: Math.max(1, Math.round(Number(settings.trafficTopupMaxGb) || 1000)),
    // 只保留数字与逗号，后端按 ^\d+(,\d+)*$ 校验
    traffic_topup_presets: String(settings.trafficTopupPresets || '').replace(/[^\d,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, ''),
    auto_renew_enable: settings.autoRenewEnable ? 1 : 0,
    auto_renew_lead_hours: Math.min(168, Math.max(1, Math.round(Number(settings.autoRenewLeadHours) || 24))),
    auto_renew_grace_hours: Math.min(720, Math.max(0, Math.round(Number(settings.autoRenewGraceHours) || 0))),
    renew_prompt_days: Math.min(60, Math.max(0, Math.round(Number(settings.renewPromptDays) || 0))),
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
      commissionWithdrawChains: fallback.commissionWithdrawChains,
      commissionWithdrawMax: fallback.commissionWithdrawMax,
      commissionWithdrawRateSource: fallback.commissionWithdrawRateSource,
      commissionWithdrawUsdtRate: fallback.commissionWithdrawUsdtRate,
      commissionWithdrawRequireQrcode: fallback.commissionWithdrawRequireQrcode,
      commissionWithdrawThanks: fallback.commissionWithdrawThanks,
      commissionWithdrawPresets: fallback.commissionWithdrawPresets,
      commissionWithdrawNetworks: fallback.commissionWithdrawNetworks,
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
    commissionWithdrawChains: normalizeWithdrawChains(invite.commission_withdraw_chains),
    commissionWithdrawMax: Number(invite.commission_withdraw_max ?? 0) || 0,
    commissionWithdrawRateSource:
      invite.commission_withdraw_rate_source === 'manual' ? 'manual' : 'auto',
    commissionWithdrawUsdtRate: Number(invite.commission_withdraw_usdt_rate ?? fallback.commissionWithdrawUsdtRate) || 0,
    commissionWithdrawRequireQrcode: Boolean(Number(invite.commission_withdraw_require_qrcode ?? 0)),
    commissionWithdrawThanks: String(invite.commission_withdraw_thanks ?? ''),
    commissionWithdrawNetworks: Array.isArray(invite.commission_withdraw_networks)
      ? invite.commission_withdraw_networks
      : fallback.commissionWithdrawNetworks,
    commissionWithdrawPresets: Array.isArray(invite.commission_withdraw_presets)
      ? invite.commission_withdraw_presets
      : fallback.commissionWithdrawPresets,
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
    // 预设列表是只读的，不回传；链列表只发有效行
    commission_withdraw_chains: normalizeWithdrawChains(settings.commissionWithdrawChains).map(function toPayload(chain) {
      return {
        code: chain.code,
        name: chain.name,
        network_key: chain.networkKey,
        network: chain.network,
        preset: chain.preset,
        explorer_tx: chain.explorerTx,
        fee: chain.fee,
      }
    }),
    commission_withdraw_max: Number(settings.commissionWithdrawMax || 0),
    commission_withdraw_rate_source:
      settings.commissionWithdrawRateSource === 'manual' ? 'manual' : 'auto',
    commission_withdraw_usdt_rate: Number(settings.commissionWithdrawUsdtRate || 0),
    commission_withdraw_require_qrcode: settings.commissionWithdrawRequireQrcode ? 1 : 0,
    commission_withdraw_thanks: String(settings.commissionWithdrawThanks || '').trim(),
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

function normalizeTicketAttachmentSettings(ticket) {
  const fallback = createEmptySiteSettings()
  const pick = function pick(key) {
    return fallback[key]
  }

  if (!ticket || typeof ticket !== 'object') {
    return {
      ticketAttachmentEnable: pick('ticketAttachmentEnable'),
      ticketAttachmentDriver: pick('ticketAttachmentDriver'),
      ticketAttachmentMaxSizeMb: pick('ticketAttachmentMaxSizeMb'),
      ticketAttachmentMaxCount: pick('ticketAttachmentMaxCount'),
      ticketAttachmentAllowedExtensions: pick('ticketAttachmentAllowedExtensions'),
      ticketAttachmentDailyQuotaMb: pick('ticketAttachmentDailyQuotaMb'),
      ticketAttachmentRetentionDays: pick('ticketAttachmentRetentionDays'),
      ticketAttachmentS3Endpoint: pick('ticketAttachmentS3Endpoint'),
      ticketAttachmentS3Region: pick('ticketAttachmentS3Region'),
      ticketAttachmentS3Bucket: pick('ticketAttachmentS3Bucket'),
      ticketAttachmentS3AccessKey: pick('ticketAttachmentS3AccessKey'),
      ticketAttachmentS3SecretKey: pick('ticketAttachmentS3SecretKey'),
      ticketAttachmentS3PathStyle: pick('ticketAttachmentS3PathStyle'),
      ticketAttachmentS3Prefix: pick('ticketAttachmentS3Prefix'),
      ticketAttachmentS3PublicUrl: pick('ticketAttachmentS3PublicUrl'),
      ticketAttachmentHardMaxSizeMb: pick('ticketAttachmentHardMaxSizeMb'),
      ticketAttachmentHardMaxCount: pick('ticketAttachmentHardMaxCount'),
    }
  }

  const numberOr = function numberOr(value, defaultValue) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  return {
    ticketAttachmentEnable: Boolean(Number(ticket.ticket_attachment_enable ?? 0)),
    ticketAttachmentDriver: ticket.ticket_attachment_driver === 's3' ? 's3' : 'local',
    ticketAttachmentMaxSizeMb: numberOr(ticket.ticket_attachment_max_size_mb, pick('ticketAttachmentMaxSizeMb')),
    ticketAttachmentMaxCount: numberOr(ticket.ticket_attachment_max_count, pick('ticketAttachmentMaxCount')),
    ticketAttachmentAllowedExtensions: String(ticket.ticket_attachment_allowed_extensions ?? pick('ticketAttachmentAllowedExtensions')),
    ticketAttachmentDailyQuotaMb: numberOr(ticket.ticket_attachment_daily_quota_mb, pick('ticketAttachmentDailyQuotaMb')),
    ticketAttachmentRetentionDays: numberOr(ticket.ticket_attachment_retention_days, pick('ticketAttachmentRetentionDays')),
    ticketAttachmentS3Endpoint: String(ticket.ticket_attachment_s3_endpoint ?? ''),
    ticketAttachmentS3Region: String(ticket.ticket_attachment_s3_region ?? 'auto'),
    ticketAttachmentS3Bucket: String(ticket.ticket_attachment_s3_bucket ?? ''),
    ticketAttachmentS3AccessKey: String(ticket.ticket_attachment_s3_access_key ?? ''),
    ticketAttachmentS3SecretKey: String(ticket.ticket_attachment_s3_secret_key ?? ''),
    ticketAttachmentS3PathStyle: Boolean(Number(ticket.ticket_attachment_s3_path_style ?? 1)),
    ticketAttachmentS3Prefix: String(ticket.ticket_attachment_s3_prefix ?? 'ticket-attachments'),
    ticketAttachmentS3PublicUrl: String(ticket.ticket_attachment_s3_public_url ?? ''),
    ticketAttachmentHardMaxSizeMb: numberOr(ticket.ticket_attachment_hard_max_size_mb, pick('ticketAttachmentHardMaxSizeMb')),
    ticketAttachmentHardMaxCount: numberOr(ticket.ticket_attachment_hard_max_count, pick('ticketAttachmentHardMaxCount')),
  }
}

function createTicketAttachmentSettingsPayload(settings = {}) {
  // hard max 两个键是只读的，不回传
  return {
    ticket_attachment_enable: settings.ticketAttachmentEnable ? 1 : 0,
    ticket_attachment_driver: settings.ticketAttachmentDriver === 's3' ? 's3' : 'local',
    ticket_attachment_max_size_mb: Number(settings.ticketAttachmentMaxSizeMb || 1),
    ticket_attachment_max_count: Number(settings.ticketAttachmentMaxCount || 1),
    ticket_attachment_allowed_extensions: String(settings.ticketAttachmentAllowedExtensions || '').trim(),
    ticket_attachment_daily_quota_mb: Number(settings.ticketAttachmentDailyQuotaMb || 0),
    ticket_attachment_retention_days: Number(settings.ticketAttachmentRetentionDays || 0),
    ticket_attachment_s3_endpoint: String(settings.ticketAttachmentS3Endpoint || '').trim(),
    ticket_attachment_s3_region: String(settings.ticketAttachmentS3Region || '').trim(),
    ticket_attachment_s3_bucket: String(settings.ticketAttachmentS3Bucket || '').trim(),
    ticket_attachment_s3_access_key: String(settings.ticketAttachmentS3AccessKey || '').trim(),
    ticket_attachment_s3_secret_key: String(settings.ticketAttachmentS3SecretKey || '').trim(),
    ticket_attachment_s3_path_style: settings.ticketAttachmentS3PathStyle ? 1 : 0,
    ticket_attachment_s3_prefix: String(settings.ticketAttachmentS3Prefix || '').trim(),
    ticket_attachment_s3_public_url: String(settings.ticketAttachmentS3PublicUrl || '').trim(),
  }
}

/**
 * 提现链列表归一化：后端 / 表单两种形态都收（explorer_tx ↔ explorerTx），
 * 丢掉没有名称的空行；code 为空时按名称+网络自动生成，与后端 WithdrawalConfig::slug 一致。
 */
export function normalizeWithdrawChains(raw) {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set()

  return list
    .map(function mapChain(item) {
      if (!item || typeof item !== 'object') {
        return null
      }
      const name = String(item.name || '').trim()
      const network = String(item.network || '').trim()
      const networkKey = String(item.network_key ?? item.networkKey ?? '').trim() || 'custom'
      // code 跟随网络 key 而不是展示名：展示名随时可能改，而 code 写进了每条提现记录
      const auto =
        networkKey && networkKey !== 'custom' ? `${name}_${networkKey}` : `${name} ${network}`
      const code = slugifyChainCode(String(item.code || '').trim() || auto)
      if (!name || !code || seen.has(code)) {
        return null
      }
      seen.add(code)
      return {
        code,
        name,
        networkKey,
        network,
        preset: String(item.preset || 'none'),
        explorerTx: String(item.explorer_tx ?? item.explorerTx ?? '').trim(),
        fee: Number(item.fee ?? 0) || 0,
      }
    })
    .filter(Boolean)
}

export function slugifyChainCode(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}
