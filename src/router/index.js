import { createRouter, createWebHistory } from 'vue-router'

import { hasStoredAuthSession } from '../services/auth'
import AdminLayout from '../layouts/AdminLayout.vue'
import DashboardPage from '../views/DashboardPage.vue'
import LoginPage from '../views/LoginPage.vue'
import NodesPage from '../views/NodesPage.vue'
import NoticesPage from '../views/NoticesPage.vue'
import OrdersPage from '../views/OrdersPage.vue'
import PlansPage from '../views/PlansPage.vue'
import PluginsPage from '../views/PluginsPage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import TicketsPage from '../views/TicketsPage.vue'
import UsersPage from '../views/UsersPage.vue'

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
}

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
      meta: {
        public: true,
        titleKey: ROUTE_META_KEYS.login.title,
        eyebrowKey: ROUTE_META_KEYS.login.eyebrow,
      },
    },
  {
    path: '/',
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
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(function authGuard(to) {
  const isAuthenticated = hasStoredAuthSession()

  if (to.meta.public && isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
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
