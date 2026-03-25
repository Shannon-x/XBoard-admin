import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  Bell,
  Coin,
  Connection,
  CreditCard,
  DataAnalysis,
  Document,
  Files,
  Goods,
  Grid,
  Guide,
  Iphone,
  Lock,
  Message,
  Monitor,
  Notebook,
  Operation,
  Picture,
  Promotion,
  Service,
  Setting,
  ShoppingCart,
  Tickets,
  User,
  Wallet,
} from "@element-plus/icons-vue";

import {
  createDefaultDashboardStats,
  createEmptyIncomeOverview,
  createEmptyQueueStats,
  createEmptySystemStatus,
  createEmptyTrafficRank,
  createEmptyUserInfo,
  fetchDashboardStats,
  fetchIncomeOverview,
  fetchQueueStats,
  fetchSystemStatus,
  fetchTrafficRank,
  fetchUserInfo,
} from "../services/dashboard";
import {
  createEmptyManagedNodesFilters,
  createEmptyManagedNodeGroups,
  createEmptyManagedNodeRoutes,
  createEmptyManagedNodes,
  createEmptyManagedNodesPagination,
  deleteManagedNode,
  copyManagedNode,
  updateManagedNodeShow,
  fetchManagedNodeGroups,
  fetchManagedNodeRoutes,
  fetchManagedNodes,
  saveManagedNode,
} from "../services/nodes";
import {
  createEmptyManagedNotices,
  fetchManagedNotices,
  saveManagedNotice,
  toggleManagedNoticeShow,
} from '../services/notices'
import {
  createEmptyPlugins,
  createEmptyPluginsFilters,
  createEmptyPluginsPagination,
  createEmptyPluginTypes,
  deletePlugin,
  disablePlugin,
  enablePlugin,
  fetchPlugins,
  fetchPluginTypes,
  installPlugin,
  savePluginConfig,
  uninstallPlugin,
  uploadPlugin,
} from "../services/plugins";
import {
  createEmptySiteSettingsGroup,
  createEmptySiteSettings,
  fetchEmailTemplateOptions,
  fetchSiteSettingsGroup,
  fetchSiteSettings,
  saveSiteSettings,
  setupTelegramWebhook,
  testSendMail,
} from "../services/settings";

export const useAdminStore = defineStore("admin", () => {
  const defaultDashboardStats = createDefaultDashboardStats();
  const incomeRangePresets = {
    "7d": { days: 7, labelKey: "income.range.last7Days" },
    "30d": { days: 30, labelKey: "income.range.last30Days" },
    "90d": { days: 90, labelKey: "income.range.last90Days" },
    "180d": { days: 180, labelKey: "income.range.last180Days" },
    "365d": { days: 365, labelKey: "income.range.lastYear" },
  };
  const searchKeyword = ref("");
  const dashboardSummary = ref(defaultDashboardStats.summary);
  const dashboardMetrics = ref(defaultDashboardStats.metrics);
  const dashboardStatsLoading = ref(false);
  const dashboardStatsError = ref("");
  const incomeOverview = ref(createEmptyIncomeOverview());
  const incomeOverviewRange = ref(createIncomeRangeSelection("30d"));
  const incomeOverviewLoading = ref(false);
  const incomeOverviewError = ref("");
  const nodeTrafficRank = ref(createEmptyTrafficRank());
  const nodeTrafficRankLoading = ref(false);
  const nodeTrafficRankError = ref("");
  const userTrafficRank = ref(createEmptyTrafficRank());
  const userTrafficRankLoading = ref(false);
  const userTrafficRankError = ref("");
  const queueStats = ref(createEmptyQueueStats());
  const queueStatsLoading = ref(false);
  const queueStatsError = ref("");
  const managedNodes = ref(createEmptyManagedNodes());
  const managedNodesFilters = ref(createEmptyManagedNodesFilters());
  const managedNodesPagination = ref(createEmptyManagedNodesPagination());
  const managedNodesLoading = ref(false);
  const managedNodesError = ref("");
  const managedNodeGroups = ref(createEmptyManagedNodeGroups());
  const managedNodeGroupsLoading = ref(false);
  const managedNodeGroupsError = ref("");
  const managedNodeRoutes = ref(createEmptyManagedNodeRoutes());
  const managedNodeRoutesLoading = ref(false);
  const managedNodeRoutesError = ref("");
  const managedNotices = ref(createEmptyManagedNotices())
  const managedNoticesLoading = ref(false)
  const managedNoticesError = ref('')
  const systemStatus = ref(createEmptySystemStatus());
  const systemStatusLoading = ref(false);
  const systemStatusError = ref("");
  const plugins = ref(createEmptyPlugins());
  const pluginsFilters = ref(createEmptyPluginsFilters());
  const pluginsPagination = ref(createEmptyPluginsPagination());
  const pluginsLoading = ref(false);
  const pluginsError = ref("");
  const pluginTypes = ref(createEmptyPluginTypes());
  const pluginTypesLoading = ref(false);
  const pluginTypesError = ref("");
  const userInfo = ref(createEmptyUserInfo());
  const userInfoLoading = ref(false);
  const userInfoError = ref("");
  const siteSettings = ref(createEmptySiteSettings());
  const siteSettingsInitial = ref(createEmptySiteSettings());
  const loadedSiteSettingsGroups = ref([]);
  const siteSettingsLoading = ref(false);
  const siteSettingsSaving = ref(false);
  const siteSettingsError = ref("");
  const mailTestSending = ref(false);
  const telegramWebhookSetting = ref(false);
  const emailTemplateOptions = ref([]);

  const navigationGroups = [
    {
      title: "仪表盘",
      items: [
        {
          labelKey: "nav.dashboard",
          icon: DataAnalysis,
          routeName: "dashboard",
        },
      ],
    },
    {
      title: "系统管理",
      items: [
        { labelKey: "nav.settings", icon: Setting, routeName: "settings" },
        { labelKey: "nav.plugins", icon: Operation, routeName: "plugins" },
        { label: "主题配置", icon: Picture, routeName: "themeConfig" },
        { labelKey: "nav.notices", icon: Bell, routeName: "notices" },
        { labelKey: "nav.payment", icon: Wallet, routeName: "payment" },
        { labelKey: "nav.knowledge", icon: Notebook, routeName: "knowledge" },
      ],
    },
    {
      title: "节点管理",
      items: [
        { labelKey: "nav.nodes", icon: Monitor, routeName: "nodes" },
        { label: "权限组管理", icon: Grid, routeName: "nodeGroups" },
        { label: "路由管理", icon: Guide, routeName: "nodeRoutes" },
      ],
    },
    {
      title: "订阅管理",
      items: [
        { labelKey: "nav.plans", icon: Files, routeName: "plans" },
        { labelKey: "nav.orders", icon: ShoppingCart, routeName: "orders" },
        { labelKey: "nav.coupons", icon: Promotion, routeName: "coupons" },
        { labelKey: "nav.giftcards", icon: CreditCard, routeName: "giftcards" },
      ],
    },
    {
      title: "用户管理",
      items: [
        { labelKey: "nav.users", icon: User, routeName: "users" },
        { labelKey: "nav.tickets", icon: Service, routeName: "tickets" },
      ],
    },
  ];

  const plans = [];
  const users = [];
  const orders = [];
  const nodes = [];
  const tickets = [];
  const notices = [];

  const activities = [
    {
      title: "支付网关已同步",
      description: "Stripe 与本地订单回调已完成校验，同步延迟控制在 120ms。",
      tone: "success",
    },
    {
      title: "香港节点负载升高",
      description: "节点 HK-03 瞬时流量超过 78%，建议调整路由优先级。",
      tone: "warning",
    },
    {
      title: "新主题配置已发布",
      description: "登录页品牌文案与页脚链接已推送到所有站点前台。",
      tone: "info",
    },
    {
      title: "系统日志归档完成",
      description: "7 天前的面板日志已打包到冷存储，查询性能恢复正常。",
      tone: "neutral",
    },
  ];

  const systemSettingsGroups = [
    {
      key: "site",
      icon: Setting,
      titleKey: "systemSettings.groups.site.title",
      descriptionKey: "systemSettings.groups.site.description",
      fields: [
        {
          key: "appName",
          labelKey: "systemSettings.fields.appName.label",
          descriptionKey: "systemSettings.fields.appName.description",
          placeholderKey: "systemSettings.fields.appName.placeholder",
          type: "text",
        },
        {
          key: "appDescription",
          labelKey: "systemSettings.fields.appDescription.label",
          descriptionKey: "systemSettings.fields.appDescription.description",
          placeholderKey: "systemSettings.fields.appDescription.placeholder",
          type: "text",
        },
        {
          key: "appUrl",
          labelKey: "systemSettings.fields.appUrl.label",
          descriptionKey: "systemSettings.fields.appUrl.description",
          placeholderKey: "systemSettings.fields.appUrl.placeholder",
          type: "text",
        },
        {
          key: "forceHttps",
          labelKey: "systemSettings.fields.forceHttps.label",
          descriptionKey: "systemSettings.fields.forceHttps.description",
          type: "switch",
        },
        {
          key: "logo",
          labelKey: "systemSettings.fields.logo.label",
          descriptionKey: "systemSettings.fields.logo.description",
          placeholderKey: "systemSettings.fields.logo.placeholder",
          type: "text",
        },
        {
          key: "subscribeUrl",
          labelKey: "systemSettings.fields.subscribeUrl.label",
          descriptionKey: "systemSettings.fields.subscribeUrl.description",
          placeholderKey: "systemSettings.fields.subscribeUrl.placeholder",
          type: "textarea",
          autosize: {
            minRows: 2,
            maxRows: 4,
          },
        },
        {
          key: "tosUrl",
          labelKey: "systemSettings.fields.tosUrl.label",
          descriptionKey: "systemSettings.fields.tosUrl.description",
          placeholderKey: "systemSettings.fields.tosUrl.placeholder",
          type: "text",
        },
        {
          key: "stopRegister",
          labelKey: "systemSettings.fields.stopRegister.label",
          descriptionKey: "systemSettings.fields.stopRegister.description",
          type: "switch",
        },
        {
          key: "tryOutPlanId",
          labelKey: "systemSettings.fields.tryOutPlanId.label",
          descriptionKey: "systemSettings.fields.tryOutPlanId.description",
          placeholderKey: "systemSettings.fields.tryOutPlanId.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "tryOutHour",
          labelKey: "systemSettings.fields.tryOutHour.label",
          descriptionKey: "systemSettings.fields.tryOutHour.description",
          placeholderKey: "systemSettings.fields.tryOutHour.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "currency",
          labelKey: "systemSettings.fields.currency.label",
          descriptionKey: "systemSettings.fields.currency.description",
          placeholderKey: "systemSettings.fields.currency.placeholder",
          type: "text",
        },
        {
          key: "currencySymbol",
          labelKey: "systemSettings.fields.currencySymbol.label",
          descriptionKey: "systemSettings.fields.currencySymbol.description",
          placeholderKey: "systemSettings.fields.currencySymbol.placeholder",
          type: "text",
        },
      ],
    },
    {
      key: "security",
      icon: Lock,
      titleKey: "systemSettings.groups.security.title",
      descriptionKey: "systemSettings.groups.security.description",
      fields: [
        {
          key: "emailVerify",
          labelKey: "systemSettings.fields.emailVerify.label",
          descriptionKey: "systemSettings.fields.emailVerify.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "safeModeEnable",
          labelKey: "systemSettings.fields.safeModeEnable.label",
          descriptionKey: "systemSettings.fields.safeModeEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "banGmailAlias",
          labelKey: "systemSettings.fields.banGmailAlias.label",
          descriptionKey: "systemSettings.fields.banGmailAlias.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "securePath",
          labelKey: "systemSettings.fields.securePath.label",
          descriptionKey: "systemSettings.fields.securePath.description",
          placeholderKey: "systemSettings.fields.securePath.placeholder",
          type: "text",
        },
        {
          key: "emailWhitelistEnable",
          labelKey: "systemSettings.fields.emailWhitelistEnable.label",
          descriptionKey: "systemSettings.fields.emailWhitelistEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "emailWhitelistSuffix",
          labelKey: "systemSettings.fields.emailWhitelistSuffix.label",
          descriptionKey: "systemSettings.fields.emailWhitelistSuffix.description",
          placeholderKey: "systemSettings.fields.emailWhitelistSuffix.placeholder",
          type: "textarea",
          autosize: {
            minRows: 2,
            maxRows: 4,
          },
          visibleWhen: {
            key: "emailWhitelistEnable",
            equals: true,
          },
        },
        {
          key: "enableCaptcha",
          labelKey: "systemSettings.fields.enableCaptcha.label",
          descriptionKey: "systemSettings.fields.enableCaptcha.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "captchaType",
          labelKey: "systemSettings.fields.captchaType.label",
          descriptionKey: "systemSettings.fields.captchaType.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.captchaType",
          visibleWhen: {
            key: "enableCaptcha",
            equals: true,
          },
        },
        {
          key: "recaptchaSiteKey",
          labelKey: "systemSettings.fields.recaptchaSiteKey.label",
          descriptionKey: "systemSettings.fields.recaptchaSiteKey.description",
          placeholderKey: "systemSettings.fields.recaptchaSiteKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "recaptcha",
              },
            ],
          },
        },
        {
          key: "recaptchaKey",
          labelKey: "systemSettings.fields.recaptchaKey.label",
          descriptionKey: "systemSettings.fields.recaptchaKey.description",
          placeholderKey: "systemSettings.fields.recaptchaKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "recaptcha",
              },
            ],
          },
        },
        {
          key: "recaptchaV3SiteKey",
          labelKey: "systemSettings.fields.recaptchaV3SiteKey.label",
          descriptionKey: "systemSettings.fields.recaptchaV3SiteKey.description",
          placeholderKey: "systemSettings.fields.recaptchaV3SiteKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "recaptcha-v3",
              },
            ],
          },
        },
        {
          key: "recaptchaV3SecretKey",
          labelKey: "systemSettings.fields.recaptchaV3SecretKey.label",
          descriptionKey: "systemSettings.fields.recaptchaV3SecretKey.description",
          placeholderKey: "systemSettings.fields.recaptchaV3SecretKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "recaptcha-v3",
              },
            ],
          },
        },
        {
          key: "recaptchaV3ScoreThreshold",
          labelKey: "systemSettings.fields.recaptchaV3ScoreThreshold.label",
          descriptionKey: "systemSettings.fields.recaptchaV3ScoreThreshold.description",
          type: "number",
          min: 0,
          max: 1,
          step: 0.1,
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "recaptcha-v3",
              },
            ],
          },
        },
        {
          key: "turnstileSiteKey",
          labelKey: "systemSettings.fields.turnstileSiteKey.label",
          descriptionKey: "systemSettings.fields.turnstileSiteKey.description",
          placeholderKey: "systemSettings.fields.turnstileSiteKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "turnstile",
              },
            ],
          },
        },
        {
          key: "turnstileSecretKey",
          labelKey: "systemSettings.fields.turnstileSecretKey.label",
          descriptionKey: "systemSettings.fields.turnstileSecretKey.description",
          placeholderKey: "systemSettings.fields.turnstileSecretKey.placeholder",
          type: "text",
          visibleWhen: {
            all: [
              {
                key: "enableCaptcha",
                equals: true,
              },
              {
                key: "captchaType",
                equals: "turnstile",
              },
            ],
          },
        },
        {
          key: "ipRegisterLimit",
          labelKey: "systemSettings.fields.ipRegisterLimit.label",
          descriptionKey: "systemSettings.fields.ipRegisterLimit.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "registerLimitCount",
          labelKey: "systemSettings.fields.registerLimitCount.label",
          descriptionKey: "systemSettings.fields.registerLimitCount.description",
          placeholderKey: "systemSettings.fields.registerLimitCount.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "ipRegisterLimit",
            equals: true,
          },
        },
        {
          key: "registerLimitDuration",
          labelKey: "systemSettings.fields.registerLimitDuration.label",
          descriptionKey: "systemSettings.fields.registerLimitDuration.description",
          placeholderKey: "systemSettings.fields.registerLimitDuration.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "ipRegisterLimit",
            equals: true,
          },
        },
        {
          key: "passwordLimit",
          labelKey: "systemSettings.fields.passwordLimit.label",
          descriptionKey: "systemSettings.fields.passwordLimit.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "passwordTryCount",
          labelKey: "systemSettings.fields.passwordTryCount.label",
          descriptionKey: "systemSettings.fields.passwordTryCount.description",
          placeholderKey: "systemSettings.fields.passwordTryCount.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "passwordLimit",
            equals: true,
          },
        },
        {
          key: "passwordLimitDuration",
          labelKey: "systemSettings.fields.passwordLimitDuration.label",
          descriptionKey: "systemSettings.fields.passwordLimitDuration.description",
          placeholderKey: "systemSettings.fields.passwordLimitDuration.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "passwordLimit",
            equals: true,
          },
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "subscription",
      icon: Tickets,
      titleKey: "systemSettings.groups.subscription.title",
      descriptionKey: "systemSettings.groups.subscription.description",
      fields: [
        {
          key: "planChangeEnable",
          labelKey: "systemSettings.fields.planChangeEnable.label",
          descriptionKey: "systemSettings.fields.planChangeEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "resetTrafficMethod",
          labelKey: "systemSettings.fields.resetTrafficMethod.label",
          descriptionKey: "systemSettings.fields.resetTrafficMethod.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.resetTrafficMethod",
          valueType: "number",
        },
        {
          key: "surplusEnable",
          labelKey: "systemSettings.fields.surplusEnable.label",
          descriptionKey: "systemSettings.fields.surplusEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "newOrderEventId",
          labelKey: "systemSettings.fields.newOrderEventId.label",
          descriptionKey: "systemSettings.fields.newOrderEventId.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.orderEventId",
          valueType: "number",
        },
        {
          key: "renewOrderEventId",
          labelKey: "systemSettings.fields.renewOrderEventId.label",
          descriptionKey: "systemSettings.fields.renewOrderEventId.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.orderEventId",
          valueType: "number",
        },
        {
          key: "changeOrderEventId",
          labelKey: "systemSettings.fields.changeOrderEventId.label",
          descriptionKey: "systemSettings.fields.changeOrderEventId.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.orderEventId",
          valueType: "number",
        },
        {
          key: "subscribePath",
          labelKey: "systemSettings.fields.subscribePath.label",
          descriptionKey: "systemSettings.fields.subscribePath.description",
          placeholderKey: "systemSettings.fields.subscribePath.placeholder",
          type: "text",
        },
        {
          key: "showInfoToServerEnable",
          labelKey: "systemSettings.fields.showInfoToServerEnable.label",
          descriptionKey: "systemSettings.fields.showInfoToServerEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "showProtocolToServerEnable",
          labelKey: "systemSettings.fields.showProtocolToServerEnable.label",
          descriptionKey: "systemSettings.fields.showProtocolToServerEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "ticketReplyLimit",
          labelKey: "systemSettings.fields.ticketReplyLimit.label",
          descriptionKey: "systemSettings.fields.ticketReplyLimit.description",
          type: "switch",
          tone: "compact",
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "invite",
      icon: Coin,
      titleKey: "systemSettings.groups.invite.title",
      descriptionKey: "systemSettings.groups.invite.description",
      fields: [
        {
          key: "inviteForce",
          labelKey: "systemSettings.fields.inviteForce.label",
          descriptionKey: "systemSettings.fields.inviteForce.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "inviteCommission",
          labelKey: "systemSettings.fields.inviteCommission.label",
          descriptionKey: "systemSettings.fields.inviteCommission.description",
          placeholderKey: "systemSettings.fields.inviteCommission.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "inviteGenLimit",
          labelKey: "systemSettings.fields.inviteGenLimit.label",
          descriptionKey: "systemSettings.fields.inviteGenLimit.description",
          placeholderKey: "systemSettings.fields.inviteGenLimit.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "inviteNeverExpire",
          labelKey: "systemSettings.fields.inviteNeverExpire.label",
          descriptionKey: "systemSettings.fields.inviteNeverExpire.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "commissionFirstTimeEnable",
          labelKey: "systemSettings.fields.commissionFirstTimeEnable.label",
          descriptionKey: "systemSettings.fields.commissionFirstTimeEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "commissionAutoCheckEnable",
          labelKey: "systemSettings.fields.commissionAutoCheckEnable.label",
          descriptionKey: "systemSettings.fields.commissionAutoCheckEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "commissionWithdrawLimit",
          labelKey: "systemSettings.fields.commissionWithdrawLimit.label",
          descriptionKey: "systemSettings.fields.commissionWithdrawLimit.description",
          placeholderKey: "systemSettings.fields.commissionWithdrawLimit.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "commissionWithdrawMethod",
          labelKey: "systemSettings.fields.commissionWithdrawMethod.label",
          descriptionKey: "systemSettings.fields.commissionWithdrawMethod.description",
          placeholderKey: "systemSettings.fields.commissionWithdrawMethod.placeholder",
          type: "textarea",
          autosize: {
            minRows: 3,
            maxRows: 6,
          },
        },
        {
          key: "withdrawCloseEnable",
          labelKey: "systemSettings.fields.withdrawCloseEnable.label",
          descriptionKey: "systemSettings.fields.withdrawCloseEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "commissionDistributionEnable",
          labelKey: "systemSettings.fields.commissionDistributionEnable.label",
          descriptionKey: "systemSettings.fields.commissionDistributionEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "commissionDistributionL1",
          labelKey: "systemSettings.fields.commissionDistributionL1.label",
          descriptionKey: "systemSettings.fields.commissionDistributionL1.description",
          placeholderKey: "systemSettings.fields.commissionDistributionL1.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "commissionDistributionEnable",
            equals: true,
          },
        },
        {
          key: "commissionDistributionL2",
          labelKey: "systemSettings.fields.commissionDistributionL2.label",
          descriptionKey: "systemSettings.fields.commissionDistributionL2.description",
          placeholderKey: "systemSettings.fields.commissionDistributionL2.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "commissionDistributionEnable",
            equals: true,
          },
        },
        {
          key: "commissionDistributionL3",
          labelKey: "systemSettings.fields.commissionDistributionL3.label",
          descriptionKey: "systemSettings.fields.commissionDistributionL3.description",
          placeholderKey: "systemSettings.fields.commissionDistributionL3.placeholder",
          type: "number",
          min: 0,
          visibleWhen: {
            key: "commissionDistributionEnable",
            equals: true,
          },
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "node",
      icon: Monitor,
      titleKey: "systemSettings.groups.node.title",
      descriptionKey: "systemSettings.groups.node.description",
      fields: [
        {
          key: "serverToken",
          labelKey: "systemSettings.fields.serverToken.label",
          descriptionKey: "systemSettings.fields.serverToken.description",
          placeholderKey: "systemSettings.fields.serverToken.placeholder",
          type: "text",
        },
        {
          key: "serverPullInterval",
          labelKey: "systemSettings.fields.serverPullInterval.label",
          descriptionKey: "systemSettings.fields.serverPullInterval.description",
          placeholderKey: "systemSettings.fields.serverPullInterval.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "serverPushInterval",
          labelKey: "systemSettings.fields.serverPushInterval.label",
          descriptionKey: "systemSettings.fields.serverPushInterval.description",
          placeholderKey: "systemSettings.fields.serverPushInterval.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "deviceLimitMode",
          labelKey: "systemSettings.fields.deviceLimitMode.label",
          descriptionKey: "systemSettings.fields.deviceLimitMode.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.deviceLimitMode",
          valueType: "number",
        },
        {
          key: "websocketEnable",
          labelKey: "systemSettings.fields.websocketEnable.label",
          descriptionKey: "systemSettings.fields.websocketEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "websocketUrl",
          labelKey: "systemSettings.fields.websocketUrl.label",
          descriptionKey: "systemSettings.fields.websocketUrl.description",
          placeholderKey: "systemSettings.fields.websocketUrl.placeholder",
          type: "text",
          visibleWhen: {
            key: "websocketEnable",
            equals: true,
          },
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "mail",
      icon: Message,
      titleKey: "systemSettings.groups.mail.title",
      descriptionKey: "systemSettings.groups.mail.description",
      fields: [
        {
          key: "emailHost",
          labelKey: "systemSettings.fields.emailHost.label",
          descriptionKey: "systemSettings.fields.emailHost.description",
          placeholderKey: "systemSettings.fields.emailHost.placeholder",
          type: "text",
        },
        {
          key: "emailPort",
          labelKey: "systemSettings.fields.emailPort.label",
          descriptionKey: "systemSettings.fields.emailPort.description",
          placeholderKey: "systemSettings.fields.emailPort.placeholder",
          type: "number",
          min: 0,
        },
        {
          key: "emailEncryption",
          labelKey: "systemSettings.fields.emailEncryption.label",
          descriptionKey: "systemSettings.fields.emailEncryption.description",
          type: "select",
          optionsKey: "systemSettings.selectOptions.emailEncryption",
        },
        {
          key: "emailUsername",
          labelKey: "systemSettings.fields.emailUsername.label",
          descriptionKey: "systemSettings.fields.emailUsername.description",
          placeholderKey: "systemSettings.fields.emailUsername.placeholder",
          type: "text",
        },
        {
          key: "emailPassword",
          labelKey: "systemSettings.fields.emailPassword.label",
          descriptionKey: "systemSettings.fields.emailPassword.description",
          placeholderKey: "systemSettings.fields.emailPassword.placeholder",
          type: "text",
        },
        {
          key: "emailFromAddress",
          labelKey: "systemSettings.fields.emailFromAddress.label",
          descriptionKey: "systemSettings.fields.emailFromAddress.description",
          placeholderKey: "systemSettings.fields.emailFromAddress.placeholder",
          type: "text",
        },
        {
          key: "emailTemplate",
          labelKey: "systemSettings.fields.emailTemplate.label",
          descriptionKey: "systemSettings.fields.emailTemplate.description",
          type: "select",
          optionsKey: "systemSettings.dynamicOptions.emailTemplate",
        },
        {
          key: "remindMailEnable",
          labelKey: "systemSettings.fields.remindMailEnable.label",
          descriptionKey: "systemSettings.fields.remindMailEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "mailTestAction",
          labelKey: "systemSettings.fields.mailTestAction.label",
          descriptionKey: "systemSettings.fields.mailTestAction.description",
          type: "action",
          actionKey: "testMail",
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "telegram",
      icon: Promotion,
      titleKey: "systemSettings.groups.telegram.title",
      descriptionKey: "systemSettings.groups.telegram.description",
      fields: [
        {
          key: "telegramBotToken",
          labelKey: "systemSettings.fields.telegramBotToken.label",
          descriptionKey: "systemSettings.fields.telegramBotToken.description",
          placeholderKey: "systemSettings.fields.telegramBotToken.placeholder",
          type: "text",
        },
        {
          key: "telegramWebhookAction",
          labelKey: "systemSettings.fields.telegramWebhookAction.label",
          descriptionKey: "systemSettings.fields.telegramWebhookAction.description",
          type: "action",
          actionKey: "setupTelegramWebhook",
        },
        {
          key: "telegramBotEnable",
          labelKey: "systemSettings.fields.telegramBotEnable.label",
          descriptionKey: "systemSettings.fields.telegramBotEnable.description",
          type: "switch",
          tone: "compact",
        },
        {
          key: "telegramDiscussLink",
          labelKey: "systemSettings.fields.telegramDiscussLink.label",
          descriptionKey: "systemSettings.fields.telegramDiscussLink.description",
          placeholderKey: "systemSettings.fields.telegramDiscussLink.placeholder",
          type: "text",
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "app",
      icon: Iphone,
      titleKey: "systemSettings.groups.app.title",
      descriptionKey: "systemSettings.groups.app.description",
      fields: [
        {
          key: "windowsVersion",
          labelKey: "systemSettings.fields.windowsVersion.label",
          descriptionKey: "systemSettings.fields.windowsVersion.description",
          placeholderKey: "systemSettings.fields.windowsVersion.placeholder",
          type: "text",
        },
        {
          key: "windowsDownloadUrl",
          labelKey: "systemSettings.fields.windowsDownloadUrl.label",
          descriptionKey: "systemSettings.fields.windowsDownloadUrl.description",
          placeholderKey: "systemSettings.fields.windowsDownloadUrl.placeholder",
          type: "text",
        },
        {
          key: "macosVersion",
          labelKey: "systemSettings.fields.macosVersion.label",
          descriptionKey: "systemSettings.fields.macosVersion.description",
          placeholderKey: "systemSettings.fields.macosVersion.placeholder",
          type: "text",
        },
        {
          key: "macosDownloadUrl",
          labelKey: "systemSettings.fields.macosDownloadUrl.label",
          descriptionKey: "systemSettings.fields.macosDownloadUrl.description",
          placeholderKey: "systemSettings.fields.macosDownloadUrl.placeholder",
          type: "text",
        },
        {
          key: "androidVersion",
          labelKey: "systemSettings.fields.androidVersion.label",
          descriptionKey: "systemSettings.fields.androidVersion.description",
          placeholderKey: "systemSettings.fields.androidVersion.placeholder",
          type: "text",
        },
        {
          key: "androidDownloadUrl",
          labelKey: "systemSettings.fields.androidDownloadUrl.label",
          descriptionKey: "systemSettings.fields.androidDownloadUrl.description",
          placeholderKey: "systemSettings.fields.androidDownloadUrl.placeholder",
          type: "text",
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
    {
      key: "subscribeTemplate",
      icon: Document,
      titleKey: "systemSettings.groups.subscribeTemplate.title",
      descriptionKey: "systemSettings.groups.subscribeTemplate.description",
      fields: [
        {
          key: "subscribeTemplateSingbox",
          labelKey: "systemSettings.fields.subscribeTemplateSingbox.label",
          descriptionKey: "systemSettings.fields.subscribeTemplateSingbox.description",
          type: "codeTabs",
          tabs: [
            {
              key: "subscribeTemplateSingbox",
              labelKey: "systemSettings.templateTabs.singbox",
            },
            {
              key: "subscribeTemplateClash",
              labelKey: "systemSettings.templateTabs.clash",
            },
            {
              key: "subscribeTemplateClashmeta",
              labelKey: "systemSettings.templateTabs.clashmeta",
            },
            {
              key: "subscribeTemplateStash",
              labelKey: "systemSettings.templateTabs.stash",
            },
            {
              key: "subscribeTemplateSurge",
              labelKey: "systemSettings.templateTabs.surge",
            },
            {
              key: "subscribeTemplateSurfboard",
              labelKey: "systemSettings.templateTabs.surfboard",
            },
          ],
        },
      ],
      badgeKey: "systemSettings.badges.live",
    },
  ];

  const filteredNavigationGroups = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase();

    if (!keyword) {
      return navigationGroups;
    }

    return navigationGroups
      .map(function mapGroup(group) {
        const items = group.items.filter(function filterItem(item) {
          const label = String(item.label || item.labelKey || "");
          return label.toLowerCase().includes(keyword);
        });

        return {
          ...group,
          items,
        };
      })
      .filter(function filterGroup(group) {
        return group.items.length > 0;
      });
  });

  function badgeType(status) {
    if (
      status === "推荐" ||
      status === "高价值" ||
      status === "已支付" ||
      status === "已完成"
    ) {
      return "primary";
    }

    if (
      status === "待续费" ||
      status === "待支付" ||
      status === "高负载" ||
      status === "高优先级"
    ) {
      return "warning";
    }

    if (status === "维护中" || status === "草稿" || status === "待回复") {
      return "info";
    }

    if (status === "VIP" || status === "已发布") {
      return "success";
    }

    return "success";
  }

  function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function buildRecentIncomeRange(days) {
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(endDate.getDate() - days);

    return {
      startDate: formatDateValue(startDate),
      endDate: formatDateValue(endDate),
    };
  }

  function createIncomeRangeSelection(key, customRange = {}) {
    if (key === "custom") {
      const hasCustomRange = customRange.startDate && customRange.endDate;

    return {
      key: "custom",
      label: hasCustomRange
        ? `${customRange.startDate} 至 ${customRange.endDate}`
        : "自定义范围",
      labelKey: "income.range.custom",
      startDate: customRange.startDate || "",
      endDate: customRange.endDate || "",
    };
  }

    const preset = incomeRangePresets[key] || incomeRangePresets["30d"];
    const resolvedKey = incomeRangePresets[key] ? key : "30d";
    const range = buildRecentIncomeRange(preset.days);

    return {
      key: resolvedKey,
      labelKey: preset.labelKey,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }

  function normalizeIncomeRangeSelection(selection = {}) {
    if (selection.key === "custom") {
      return createIncomeRangeSelection("custom", selection);
    }

    return createIncomeRangeSelection(selection.key || "30d");
  }

  async function loadDashboardStats() {
    dashboardStatsLoading.value = true;
    dashboardStatsError.value = "";

    try {
      const stats = await fetchDashboardStats();

      dashboardSummary.value = stats.summary;
      dashboardMetrics.value = stats.metrics;
    } catch (error) {
      dashboardSummary.value = defaultDashboardStats.summary;
      dashboardMetrics.value = defaultDashboardStats.metrics;
      dashboardStatsError.value =
        error instanceof Error ? error.message : "仪表盘统计加载失败";
    } finally {
      dashboardStatsLoading.value = false;
    }
  }

  async function loadIncomeOverview(range) {
    const nextRange = normalizeIncomeRangeSelection(
      range || incomeOverviewRange.value,
    );

    incomeOverviewLoading.value = true;
    incomeOverviewError.value = "";
    incomeOverviewRange.value = nextRange;

    try {
      const nextOverview = await fetchIncomeOverview({
        startDate: nextRange.startDate,
        endDate: nextRange.endDate,
      });
      incomeOverview.value = nextOverview;
    } catch (error) {
      incomeOverview.value = createEmptyIncomeOverview();
      incomeOverviewError.value =
        error instanceof Error ? error.message : "收入概览加载失败";
    } finally {
      incomeOverviewLoading.value = false;
    }
  }

  async function loadNodeTrafficRank(options) {
    nodeTrafficRankLoading.value = true;
    nodeTrafficRankError.value = "";

    try {
      const nextRankData = await fetchTrafficRank({
        type: "node",
        ...options,
      });

      nodeTrafficRank.value = nextRankData;
    } catch (error) {
      nodeTrafficRank.value = createEmptyTrafficRank();
      nodeTrafficRankError.value =
        error instanceof Error ? error.message : "节点流量排行加载失败";
    } finally {
      nodeTrafficRankLoading.value = false;
    }
  }

  async function loadUserTrafficRank(options) {
    userTrafficRankLoading.value = true;
    userTrafficRankError.value = "";

    try {
      const nextRankData = await fetchTrafficRank({
        type: "user",
        ...options,
      });

      userTrafficRank.value = nextRankData;
    } catch (error) {
      userTrafficRank.value = createEmptyTrafficRank();
      userTrafficRankError.value =
        error instanceof Error ? error.message : "用户流量排行加载失败";
    } finally {
      userTrafficRankLoading.value = false;
    }
  }

  async function loadUserInfo() {
    userInfoLoading.value = true;
    userInfoError.value = "";

    try {
      userInfo.value = await fetchUserInfo();
    } catch (error) {
      userInfo.value = createEmptyUserInfo();
      userInfoError.value =
        error instanceof Error ? error.message : "用户信息加载失败";
    } finally {
      userInfoLoading.value = false;
    }
  }

  async function loadSiteSettings(groupKey) {
    siteSettingsLoading.value = true;
    siteSettingsError.value = "";

    try {
      const normalizedGroupKey = String(groupKey || '').trim()

      if (!normalizedGroupKey) {
        const [settings, templateOptions] = await Promise.all([
          fetchSiteSettings(),
          fetchEmailTemplateOptions(),
        ]);
        siteSettings.value = settings;
        siteSettingsInitial.value = { ...settings };
        loadedSiteSettingsGroups.value = systemSettingsGroups.map(function mapGroup(group) {
          return group.key
        });
        emailTemplateOptions.value = templateOptions;
        return settings;
      }

      const tasks = [fetchSiteSettingsGroup(normalizedGroupKey)]

      if (normalizedGroupKey === 'mail' && !emailTemplateOptions.value.length) {
        tasks.push(fetchEmailTemplateOptions())
      }

      const [groupSettings, templateOptions] = await Promise.all(tasks)

      siteSettings.value = {
        ...siteSettings.value,
        ...groupSettings,
      };
      siteSettingsInitial.value = {
        ...siteSettingsInitial.value,
        ...groupSettings,
      };

      if (!loadedSiteSettingsGroups.value.includes(normalizedGroupKey)) {
        loadedSiteSettingsGroups.value = [
          ...loadedSiteSettingsGroups.value,
          normalizedGroupKey,
        ];
      }

      if (Array.isArray(templateOptions)) {
        emailTemplateOptions.value = templateOptions;
      }

      return groupSettings;
    } catch (error) {
      if (groupKey) {
        const emptyGroupSettings = createEmptySiteSettingsGroup(groupKey)

        siteSettings.value = {
          ...siteSettings.value,
          ...emptyGroupSettings,
        };
        siteSettingsInitial.value = {
          ...siteSettingsInitial.value,
          ...emptyGroupSettings,
        };
      } else {
        siteSettings.value = createEmptySiteSettings();
        siteSettingsInitial.value = createEmptySiteSettings();
        loadedSiteSettingsGroups.value = [];
        emailTemplateOptions.value = [];
      }

      siteSettingsError.value =
        error instanceof Error ? error.message : "系统设置加载失败";
      throw error;
    } finally {
      siteSettingsLoading.value = false;
    }
  }

  async function saveSiteSettingsItem() {
    siteSettingsSaving.value = true;
    siteSettingsError.value = "";

    try {
      const savedSettings = await saveSiteSettings(
        siteSettings.value,
        siteSettingsInitial.value,
        loadedSiteSettingsGroups.value,
      );
      siteSettings.value = {
        ...siteSettings.value,
        ...savedSettings,
      };
      siteSettingsInitial.value = {
        ...siteSettingsInitial.value,
        ...savedSettings,
      };
      return savedSettings;
    } catch (error) {
      siteSettingsError.value =
        error instanceof Error ? error.message : "系统设置保存失败";
      throw error;
    } finally {
      siteSettingsSaving.value = false;
    }
  }

  async function testSendMailItem() {
    mailTestSending.value = true;

    try {
      return await testSendMail();
    } finally {
      mailTestSending.value = false;
    }
  }

  async function setupTelegramWebhookItem() {
    telegramWebhookSetting.value = true;

    try {
      return await setupTelegramWebhook();
    } finally {
      telegramWebhookSetting.value = false;
    }
  }

  async function loadQueueStats() {
    queueStatsLoading.value = true;
    queueStatsError.value = "";

    try {
      queueStats.value = await fetchQueueStats();
    } catch (error) {
      queueStats.value = createEmptyQueueStats();
      queueStatsError.value =
        error instanceof Error ? error.message : "队列状态加载失败";
    } finally {
      queueStatsLoading.value = false;
    }
  }

  async function loadManagedNodes(options = {}) {
    const isSilent = Boolean(options.silent);
    if (!isSilent) managedNodesLoading.value = true;
    managedNodesError.value = "";
    const nextFilters = {
      ...managedNodesFilters.value,
      ...(options.filters || {}),
    };
    const nextPagination = {
      ...managedNodesPagination.value,
      ...options,
    };

    try {
      const response = await fetchManagedNodes({
        page: nextPagination.page,
        limit: nextPagination.limit,
        type: nextFilters.type,
        word: nextFilters.word,
        status: nextFilters.status,
      });

      managedNodes.value = response.list;
      managedNodesFilters.value = nextFilters;
      managedNodesPagination.value = response.pagination;
    } catch (error) {
      managedNodes.value = createEmptyManagedNodes();
      managedNodesFilters.value = nextFilters;
      managedNodesPagination.value = {
        page: Number(nextPagination.page || 1),
        limit: Number(
          nextPagination.limit || managedNodesPagination.value.limit || 10,
        ),
        total: 0,
      };
      managedNodesError.value =
        error instanceof Error ? error.message : "节点列表加载失败";
    } finally {
      if (!isSilent) managedNodesLoading.value = false;
    }
  }

  async function loadManagedNodeGroups() {
    managedNodeGroupsLoading.value = true;
    managedNodeGroupsError.value = "";

    try {
      managedNodeGroups.value = await fetchManagedNodeGroups();
    } catch (error) {
      managedNodeGroups.value = createEmptyManagedNodeGroups();
      managedNodeGroupsError.value =
        error instanceof Error ? error.message : "权限组列表加载失败";
    } finally {
      managedNodeGroupsLoading.value = false;
    }
  }

  async function loadManagedNodeRoutes() {
    managedNodeRoutesLoading.value = true;
    managedNodeRoutesError.value = "";

    try {
      managedNodeRoutes.value = await fetchManagedNodeRoutes();
    } catch (error) {
      managedNodeRoutes.value = createEmptyManagedNodeRoutes();
      managedNodeRoutesError.value =
        error instanceof Error ? error.message : "路由组列表加载失败";
    } finally {
      managedNodeRoutesLoading.value = false;
    }
  }

  async function loadManagedNotices() {
    managedNoticesLoading.value = true
    managedNoticesError.value = ''

    try {
      managedNotices.value = await fetchManagedNotices()
    } catch (error) {
      managedNotices.value = createEmptyManagedNotices()
      managedNoticesError.value =
        error instanceof Error ? error.message : '公告列表加载失败'
    } finally {
      managedNoticesLoading.value = false
    }
  }

  async function toggleManagedNoticeShowItem(id) {
    managedNoticesError.value = ''

    try {
      return await toggleManagedNoticeShow(id)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '更新公告显示状态失败'
      managedNoticesError.value = message
      throw error
    }
  }

  async function saveManagedNoticeItem(payload) {
    managedNoticesError.value = ''

    try {
      return await saveManagedNotice(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '保存公告失败'
      managedNoticesError.value = message
      throw error
    }
  }

  async function saveManagedNodeItem(payload) {
    managedNodesError.value = "";

    try {
      return await saveManagedNode(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "保存节点失败";
      managedNodesError.value = message;
      throw error;
    }
  }

  async function deleteManagedNodeItem(id) {
    managedNodesError.value = "";

    try {
      return await deleteManagedNode(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "删除节点失败";
      managedNodesError.value = message;
      throw error;
    }
  }

  async function copyManagedNodeItem(id) {
    managedNodesError.value = "";

    try {
      return await copyManagedNode(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "复制节点失败";
      managedNodesError.value = message;
      throw error;
    }
  }

  async function updateManagedNodeShowItem(id, show) {
    managedNodesError.value = "";

    try {
      return await updateManagedNodeShow(id, show);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新节点显示状态失败";
      managedNodesError.value = message;
      throw error;
    }
  }

  async function loadSystemStatus() {
    systemStatusLoading.value = true;
    systemStatusError.value = "";

    try {
      systemStatus.value = await fetchSystemStatus();
    } catch (error) {
      systemStatus.value = createEmptySystemStatus();
      systemStatusError.value =
        error instanceof Error ? error.message : "系统状态加载失败";
    } finally {
      systemStatusLoading.value = false;
    }
  }

  async function loadPlugins(options = {}) {
    pluginsLoading.value = true;
    pluginsError.value = "";
    const nextFilters = {
      ...pluginsFilters.value,
      ...(options.filters || {}),
    };
    const nextPagination = {
      ...pluginsPagination.value,
      ...options,
    };

    try {
      const response = await fetchPlugins({
        type: nextFilters.type,
        status: nextFilters.status,
      });

      plugins.value = response.list;
      pluginsFilters.value = nextFilters;
      pluginsPagination.value = response.pagination;
    } catch (error) {
      plugins.value = createEmptyPlugins();
      pluginsFilters.value = nextFilters;
      pluginsPagination.value = {
        page: Number(nextPagination.page || 1),
        limit: Number(nextPagination.limit || pluginsPagination.value.limit || 50),
        total: 0,
      };
      pluginsError.value =
        error instanceof Error ? error.message : "插件列表加载失败";
    } finally {
      pluginsLoading.value = false;
    }
  }

  async function togglePlugin(code, enabled) {
    const pluginCode = String(code || "").trim();

    if (!pluginCode) {
      throw new Error("缺少插件标识");
    }

    if (enabled) {
      await enablePlugin(pluginCode);
    } else {
      await disablePlugin(pluginCode);
    }
  }

  async function installPluginItem(code) {
    const pluginCode = String(code || "").trim();

    if (!pluginCode) {
      throw new Error("缺少插件标识");
    }

    await installPlugin(pluginCode);
  }

  async function uninstallPluginItem(code) {
    const pluginCode = String(code || "").trim();

    if (!pluginCode) {
      throw new Error("缺少插件标识");
    }

    await uninstallPlugin(pluginCode);
  }

  async function deletePluginItem(code) {
    const pluginCode = String(code || "").trim();

    if (!pluginCode) {
      throw new Error("缺少插件标识");
    }

    await deletePlugin(pluginCode);
  }

  async function uploadPluginItem(file) {
    if (!file) {
      throw new Error("缺少插件文件");
    }

    await uploadPlugin(file);
  }

  async function loadPluginTypes() {
    pluginTypesLoading.value = true;
    pluginTypesError.value = "";

    try {
      const list = await fetchPluginTypes();
      pluginTypes.value = list;
      return list;
    } catch (error) {
      pluginTypesError.value = error?.message || "插件类型加载失败";
      pluginTypes.value = createEmptyPluginTypes();
      throw error;
    } finally {
      pluginTypesLoading.value = false;
    }
  }

  async function savePluginConfigItem(code, config) {
    const pluginCode = String(code || "").trim();

    if (!pluginCode) {
      throw new Error("缺少插件标识");
    }

    await savePluginConfig(pluginCode, config);
  }

  return {
    activities,
    badgeType,
    dashboardMetrics,
    dashboardStatsError,
    dashboardStatsLoading,
    dashboardSummary,
    filteredNavigationGroups,
    incomeOverview,
    incomeOverviewRange,
    incomeOverviewError,
    incomeOverviewLoading,
    loadIncomeOverview,
    loadManagedNodeGroups,
    loadManagedNodeRoutes,
    loadManagedNotices,
    loadManagedNodes,
    saveManagedNode: saveManagedNodeItem,
    saveManagedNodeItem,
    deleteManagedNodeItem,
    copyManagedNodeItem,
    updateManagedNodeShowItem,
    loadNodeTrafficRank,
    loadQueueStats,
    loadSiteSettings,
    loadSystemStatus,
    loadUserInfo,
    loadUserTrafficRank,
    loadDashboardStats,
    managedNodeGroups,
    managedNodeGroupsError,
    managedNodeGroupsLoading,
    managedNodeRoutes,
    managedNodeRoutesError,
    managedNodeRoutesLoading,
    managedNotices,
    managedNoticesError,
    managedNoticesLoading,
    saveManagedNotice: saveManagedNoticeItem,
    toggleManagedNoticeShow: toggleManagedNoticeShowItem,
    managedNodes,
    managedNodesError,
    managedNodesFilters,
    managedNodesLoading,
    managedNodesPagination,
    plugins,
    pluginsError,
    pluginsFilters,
    pluginsLoading,
    pluginsPagination,
    emailTemplateOptions,
    pluginTypes,
    pluginTypesLoading,
    pluginTypesError,
    loadPlugins,
    loadPluginTypes,
    togglePlugin,
    installPlugin: installPluginItem,
    uninstallPlugin: uninstallPluginItem,
    deletePlugin: deletePluginItem,
    uploadPlugin: uploadPluginItem,
    savePluginConfig: savePluginConfigItem,
    navigationGroups,
    nodeTrafficRank,
    nodeTrafficRankError,
    nodeTrafficRankLoading,
    nodes,
    notices,
    orders,
    plans,
    queueStats,
    queueStatsError,
    queueStatsLoading,
    searchKeyword,
    mailTestSending,
    telegramWebhookSetting,
    siteSettings,
    siteSettingsError,
    siteSettingsLoading,
    siteSettingsSaving,
    saveSiteSettings: saveSiteSettingsItem,
    setupTelegramWebhook: setupTelegramWebhookItem,
    testSendMail: testSendMailItem,
    systemStatus,
    systemStatusError,
    systemStatusLoading,
    systemSettingsGroups,
    tickets,
    userTrafficRank,
    userTrafficRankError,
    userTrafficRankLoading,
    userInfo,
    userInfoError,
    userInfoLoading,
    users,
  };
});
