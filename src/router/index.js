import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import AdminLayout from '../layouts/AdminLayout.vue'

// 所有业务页改 lazy import：首屏不再加载 Monaco/marked/md-editor，
// 每个 view 走独立 chunk，按需下载。
const LoginPage = () => import('../views/LoginPage.vue')
const DashboardPage = () => import('../views/DashboardPage.vue')
const CouponsPage = () => import('../views/CouponsPage.vue')
const GiftCardsPage = () => import('../views/GiftCardsPage.vue')
const KnowledgePage = () => import('../views/KnowledgePage.vue')
const NodeGroupsPage = () => import('../views/NodeGroupsPage.vue')
const NodeRoutesPage = () => import('../views/NodeRoutesPage.vue')
const NodesPage = () => import('../views/NodesPage.vue')
const NoticesPage = () => import('../views/NoticesPage.vue')
const OrdersPage = () => import('../views/OrdersPage.vue')
const PaymentPage = () => import('../views/PaymentPage.vue')
const PlansPage = () => import('../views/PlansPage.vue')
const PluginsPage = () => import('../views/PluginsPage.vue')
const SettingsPage = () => import('../views/SettingsPage.vue')
const SystemLogsPage = () => import('../views/SystemLogsPage.vue')
const ThemeConfigPage = () => import('../views/ThemeConfigPage.vue')
const TicketsPage = () => import('../views/TicketsPage.vue')
const UsersPage = () => import('../views/UsersPage.vue')

const ROUTE_META_KEYS = {
  login: {
    title: 'routes.login.title',
    eyebrow: 'routes.login.eyebrow',
  },
  dashboard: {
    title: 'routes.dashboard.title',
    eyebrow: 'routes.dashboard.eyebrow',
  },
  plans: {
    title: 'routes.plans.title',
    eyebrow: 'routes.plans.eyebrow',
  },
  orders: {
    title: 'routes.orders.title',
    eyebrow: 'routes.orders.eyebrow',
  },
  users: {
    title: 'routes.users.title',
    eyebrow: 'routes.users.eyebrow',
  },
  nodes: {
    title: 'routes.nodes.title',
    eyebrow: 'routes.nodes.eyebrow',
  },
  nodeGroups: {
    title: 'routes.nodeGroups.title',
    eyebrow: 'routes.nodeGroups.eyebrow',
  },
  nodeRoutes: {
    title: 'routes.nodeRoutes.title',
    eyebrow: 'routes.nodeRoutes.eyebrow',
  },
  plugins: {
    title: 'routes.plugins.title',
    eyebrow: 'routes.plugins.eyebrow',
  },
  tickets: {
    title: 'routes.tickets.title',
    eyebrow: 'routes.tickets.eyebrow',
  },
  notices: {
    title: 'routes.notices.title',
    eyebrow: 'routes.notices.eyebrow',
  },
  settings: {
    title: 'routes.settings.title',
    eyebrow: 'routes.settings.eyebrow',
  },
  coupons: {
    title: 'routes.coupons.title',
    eyebrow: 'routes.coupons.eyebrow',
  },
  giftcards: {
    title: 'routes.giftcards.title',
    eyebrow: 'routes.giftcards.eyebrow',
  },
  knowledge: {
    title: 'routes.knowledge.title',
    eyebrow: 'routes.knowledge.eyebrow',
  },
  payment: {
    title: 'routes.payment.title',
    eyebrow: 'routes.payment.eyebrow',
  },
  logs: {
    title: 'routes.logs.title',
    eyebrow: 'routes.logs.eyebrow',
  },
  themeConfig: {
    title: 'routes.themeConfig.title',
    eyebrow: 'routes.themeConfig.eyebrow',
  },
}

const frontendSecurePath = import.meta.env.VITE_FRONTEND_SECURE_PATH || import.meta.env.VITE_DASHBOARD_SECURE_PATH || 'admin'
const basePath = frontendSecurePath ? `/${frontendSecurePath.replace(/^\//, '')}` : ''

const routes = [
  {
    path: `${basePath}/login`,
    name: 'login',
    component: LoginPage,
      meta: {
        public: true,
        titleKey: ROUTE_META_KEYS.login.title,
        eyebrowKey: ROUTE_META_KEYS.login.eyebrow,
      },
    },
  {
    path: `${basePath}/`,
    component: AdminLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: DashboardPage,
        meta: {
          titleKey: ROUTE_META_KEYS.dashboard.title,
          eyebrowKey: ROUTE_META_KEYS.dashboard.eyebrow,
        },
      },
      {
        path: 'plans',
        name: 'plans',
        component: PlansPage,
        meta: {
          titleKey: ROUTE_META_KEYS.plans.title,
          eyebrowKey: ROUTE_META_KEYS.plans.eyebrow,
        },
      },
      {
        path: 'orders',
        name: 'orders',
        component: OrdersPage,
        meta: {
          titleKey: ROUTE_META_KEYS.orders.title,
          eyebrowKey: ROUTE_META_KEYS.orders.eyebrow,
        },
      },
      {
        path: 'users',
        name: 'users',
        component: UsersPage,
        meta: {
          titleKey: ROUTE_META_KEYS.users.title,
          eyebrowKey: ROUTE_META_KEYS.users.eyebrow,
        },
      },
      {
        path: 'nodes',
        name: 'nodes',
        component: NodesPage,
        meta: {
          titleKey: ROUTE_META_KEYS.nodes.title,
          eyebrowKey: ROUTE_META_KEYS.nodes.eyebrow,
        },
      },
      {
        path: 'node-groups',
        name: 'nodeGroups',
        component: NodeGroupsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.nodeGroups.title,
          eyebrowKey: ROUTE_META_KEYS.nodeGroups.eyebrow,
        },
      },
      {
        path: 'node-routes',
        name: 'nodeRoutes',
        component: NodeRoutesPage,
        meta: {
          titleKey: ROUTE_META_KEYS.nodeRoutes.title,
          eyebrowKey: ROUTE_META_KEYS.nodeRoutes.eyebrow,
        },
      },
      {
        path: 'plugins',
        name: 'plugins',
        component: PluginsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.plugins.title,
          eyebrowKey: ROUTE_META_KEYS.plugins.eyebrow,
        },
      },
      {
        path: 'tickets',
        name: 'tickets',
        component: TicketsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.tickets.title,
          eyebrowKey: ROUTE_META_KEYS.tickets.eyebrow,
        },
      },
      {
        path: 'notices',
        name: 'notices',
        component: NoticesPage,
        meta: {
          titleKey: ROUTE_META_KEYS.notices.title,
          eyebrowKey: ROUTE_META_KEYS.notices.eyebrow,
        },
      },
      {
        path: 'settings/:category?',
        name: 'settings',
        component: SettingsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.settings.title,
          eyebrowKey: ROUTE_META_KEYS.settings.eyebrow,
        },
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: CouponsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.coupons.title,
          eyebrowKey: ROUTE_META_KEYS.coupons.eyebrow,
        },
      },
      {
        path: 'giftcards',
        name: 'giftcards',
        component: GiftCardsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.giftcards.title,
          eyebrowKey: ROUTE_META_KEYS.giftcards.eyebrow,
        },
      },
      {
        path: 'knowledge',
        name: 'knowledge',
        component: KnowledgePage,
        meta: {
          titleKey: ROUTE_META_KEYS.knowledge.title,
          eyebrowKey: ROUTE_META_KEYS.knowledge.eyebrow,
        },
      },
      {
        path: 'payment',
        name: 'payment',
        component: PaymentPage,
        meta: {
          titleKey: ROUTE_META_KEYS.payment.title,
          eyebrowKey: ROUTE_META_KEYS.payment.eyebrow,
        },
      },
      {
        path: 'logs',
        name: 'logs',
        component: SystemLogsPage,
        meta: {
          titleKey: ROUTE_META_KEYS.logs.title,
          eyebrowKey: ROUTE_META_KEYS.logs.eyebrow,
        },
      },
      {
        path: 'theme',
        name: 'themeConfig',
        component: ThemeConfigPage,
        meta: {
          titleKey: ROUTE_META_KEYS.themeConfig.title,
          eyebrowKey: ROUTE_META_KEYS.themeConfig.eyebrow,
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundPage.vue'),
    meta: { public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

function isSafeInternalRedirect(target) {
  // 防止 ?redirect= 被用来跳到外站（open redirect）。只允许同站绝对路径。
  if (typeof target !== 'string') return false
  if (!target.startsWith('/')) return false
  if (target.startsWith('//')) return false   // 协议相对 URL
  if (target.startsWith('/\\')) return false
  return true
}

router.beforeEach(function authGuard(to) {
  // 从响应式 store 取认证状态 —— 当 401 触发 logout() 后，
  // 整个 SPA 的守卫立刻感知，老的"只看 localStorage 有没有 key"是死循环根因。
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  // 权限实体是后端 Admin 中间件（非管理员一律 403）；这里是 UI 层纵深防御：
  // 非管理员 token 不进入后台壳，直接清会话回登录页
  if (isAuthenticated && !authStore.session?.isAdmin) {
    authStore.logout()
    if (to.meta.public) return true
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.public && isAuthenticated) {
    const raw = typeof to.query.redirect === 'string' ? to.query.redirect : ''
    const redirect = isSafeInternalRedirect(raw) ? raw : `${basePath}/`
    return redirect
  }

  if (!to.meta.public && !isAuthenticated) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  return true
})

export default router
