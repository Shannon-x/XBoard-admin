<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import DailyNewUsersDialog from "../components/dashboard/DailyNewUsersDialog.vue";
import DashboardKpiGrid from "../components/dashboard/DashboardKpiGrid.vue";
import DashboardTodoBar from "../components/dashboard/DashboardTodoBar.vue";
import IncomeTrendCard from "../components/dashboard/IncomeTrendCard.vue";
import MailRelayCard from "../components/dashboard/MailRelayCard.vue";
import MonitorPanel from "../components/dashboard/MonitorPanel.vue";
import NodeStatusCard from "../components/dashboard/NodeStatusCard.vue";
import SubscriptionCard from "../components/dashboard/SubscriptionCard.vue";
import SystemStatusStrip from "../components/dashboard/SystemStatusStrip.vue";
import TrafficRankCard from "../components/dashboard/TrafficRankCard.vue";
import { formatMinutesWindow } from "../components/dashboard/dashboardFormat";
import {
    createEmptyDashboardOverview,
    createEmptyMailRelayStatus,
    createEmptyMonitorReport,
    createEmptySystemHealth,
    fetchDashboardOverview,
    fetchMailRelayStatus,
    fetchMonitorReport,
    fetchSystemHealth,
} from "../services/dashboardOverview";
import { useAdminStore } from "../stores/admin";

const adminStore = useAdminStore();
const { t } = useI18n();

const AUTO_REFRESH_MS = 60000;

const dailyUsersDialogVisible = ref(false);

const overview = ref(createEmptyDashboardOverview());
const overviewLoading = ref(false);
const overviewError = ref("");

const health = ref(createEmptySystemHealth());
const healthLoading = ref(false);
const healthError = ref("");

const monitor = ref(createEmptyMonitorReport());
const monitorLoading = ref(false);
const monitorError = ref("");

const mailRelay = ref(createEmptyMailRelayStatus());
const mailRelayLoading = ref(false);
const mailRelayError = ref("");

const incomeRefreshKey = ref(0);
const updatedAt = ref(null);
let autoRefreshTimer = null;

async function loadOverview() {
    overviewLoading.value = true;
    overviewError.value = "";
    try {
        overview.value = await fetchDashboardOverview();
        updatedAt.value = new Date();
    } catch (err) {
        overviewError.value = err?.message || "仪表盘数据加载失败";
    } finally {
        overviewLoading.value = false;
    }
}

async function loadHealth() {
    healthLoading.value = true;
    healthError.value = "";
    try {
        health.value = await fetchSystemHealth();
    } catch (err) {
        healthError.value = err?.message || "系统状态加载失败";
    } finally {
        healthLoading.value = false;
    }
}

async function loadMonitor() {
    monitorLoading.value = true;
    monitorError.value = "";
    try {
        monitor.value = await fetchMonitorReport();
    } catch (err) {
        monitorError.value = err?.message || "队列与定时任务状态加载失败";
    } finally {
        monitorLoading.value = false;
    }
}

/** 队列面板的「刷新」：巡检报告和失败任务统计一起刷 */
function refreshMonitor() {
    loadMonitor();
    loadHealth();
}

async function loadMailRelay() {
    mailRelayLoading.value = true;
    mailRelayError.value = "";
    try {
        mailRelay.value = await fetchMailRelayStatus();
    } catch (err) {
        mailRelayError.value = err?.message || "邮件投递状态加载失败";
    } finally {
        mailRelayLoading.value = false;
    }
}

function refreshAll() {
    loadOverview();
    loadHealth();
    loadMonitor();
    loadMailRelay();
    incomeRefreshKey.value += 1;
    adminStore.loadNodeTrafficRank();
    adminStore.loadUserTrafficRank();
}

const updatedAtText = computed(function updatedAtText() {
    if (!updatedAt.value) return "";
    const d = updatedAt.value;
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(function pad(n) { return String(n).padStart(2, "0"); })
        .join(":");
});

const failedWindowText = computed(function failedWindowText() {
    return formatMinutesWindow(health.value.failedWindowMinutes);
});

const anyLoading = computed(function anyLoading() {
    return overviewLoading.value || monitorLoading.value || mailRelayLoading.value || healthLoading.value;
});

/** 顶部状态条点一下，滚到对应的详情区块 */
function jumpTo(id) {
    const el = typeof document === "undefined" ? null : document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function refreshNodeTraffic() {
    adminStore.loadNodeTrafficRank();
}

function refreshUserTraffic() {
    adminStore.loadUserTrafficRank();
}

function handleNodeTrafficRange(rangeKey) {
    adminStore.loadNodeTrafficRank({ rangeKey });
}

function handleUserTrafficRange(rangeKey) {
    adminStore.loadUserTrafficRank({ rangeKey });
}

onMounted(function loadOnMount() {
    // AdminLayout 已经在 mount 时加载 userInfo，这里不再重复触发。
    loadOverview();
    loadHealth();
    loadMonitor();
    loadMailRelay();
    adminStore.loadNodeTrafficRank();
    adminStore.loadUserTrafficRank();

    // 概况与运行状态每分钟静默刷新一次（和后端巡检同频）；标签页不可见时跳过
    autoRefreshTimer = setInterval(function tick() {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        if (!overviewLoading.value) loadOverview();
        if (!healthLoading.value) loadHealth();
        if (!monitorLoading.value) loadMonitor();
        if (!mailRelayLoading.value) loadMailRelay();
    }, AUTO_REFRESH_MS);
});

onBeforeUnmount(function stopAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
});
</script>

<template>
    <section class="page-stack dash-page">
        <el-alert
            v-if="overviewError"
            :closable="false"
            class="dashboard-alert"
            show-icon
            :title="t('dashboard.statsError')"
            type="warning"
        >
            <template #default>
                {{ overviewError }}
            </template>
        </el-alert>

        <SystemStatusStrip
            :monitor="monitor"
            :mail-relay="mailRelay"
            :nodes="overview.nodes"
            :nodes-loaded="overview.loaded"
            @jump="jumpTo"
        >
            <div class="dash-page__updated">
                <span v-if="updatedAtText" title="每分钟自动刷新一次">{{ updatedAtText }} 更新</span>
                <el-button size="small" plain :loading="anyLoading" @click="refreshAll">全部刷新</el-button>
            </div>
        </SystemStatusStrip>

        <DashboardTodoBar
            :todo="overview.todo"
            :nodes="overview.nodes"
            :failed-jobs="health.failedJobs"
            :failed-window-text="failedWindowText"
            :loaded="overview.loaded && health.loaded"
        />

        <h2 class="dash-page__section">经营概况</h2>

        <DashboardKpiGrid
            :overview="overview"
            :loading="overviewLoading && !overview.loaded"
            @open-new-users="dailyUsersDialogVisible = true"
        />

        <IncomeTrendCard :refresh-key="incomeRefreshKey" />

        <div class="dash-page__two-col">
            <SubscriptionCard
                :subscriptions="overview.subscriptions"
                :loading="overviewLoading && !overview.loaded"
            />
            <NodeStatusCard
                id="dash-nodes"
                class="dash-page__anchor"
                :nodes="overview.nodes"
                :loading="overviewLoading && !overview.loaded"
            />
        </div>

        <h2 class="dash-page__section">运行状态</h2>

        <MonitorPanel
            id="dash-monitor"
            class="dash-page__anchor"
            :report="monitor"
            :failed-by-job="health.failedByJob"
            :loading="monitorLoading"
            :error="monitorError"
            @refresh="refreshMonitor"
        />

        <MailRelayCard
            id="dash-mail"
            class="dash-page__anchor"
            :status="mailRelay"
            :loading="mailRelayLoading"
            :error="mailRelayError"
            @refresh="loadMailRelay"
        />

        <h2 class="dash-page__section">流量排行</h2>

        <div class="traffic-rank-grid">
            <div class="page-stack compact-stack">
                <el-alert
                    v-if="adminStore.nodeTrafficRankError"
                    :closable="false"
                    class="dashboard-alert"
                    show-icon
                    :title="t('dashboard.nodeTrafficError')"
                    type="warning"
                >
                    <template #default>
                        {{ adminStore.nodeTrafficRankError }}
                    </template>
                </el-alert>
                <TrafficRankCard
                    :loading="adminStore.nodeTrafficRankLoading"
                    :rank-data="adminStore.nodeTrafficRank"
                    :empty-text="t('traffic.emptyNode')"
                    :title="t('traffic.nodeTitle')"
                    @refresh="refreshNodeTraffic"
                    @change-range="handleNodeTrafficRange"
                />
            </div>

            <div class="page-stack compact-stack">
                <el-alert
                    v-if="adminStore.userTrafficRankError"
                    :closable="false"
                    class="dashboard-alert"
                    show-icon
                    :title="t('dashboard.userTrafficError')"
                    type="warning"
                >
                    <template #default>
                        {{ adminStore.userTrafficRankError }}
                    </template>
                </el-alert>
                <TrafficRankCard
                    :loading="adminStore.userTrafficRankLoading"
                    :rank-data="adminStore.userTrafficRank"
                    :empty-text="t('traffic.emptyUser')"
                    :title="t('traffic.userTitle')"
                    @refresh="refreshUserTraffic"
                    @change-range="handleUserTrafficRange"
                />
            </div>
        </div>

        <DailyNewUsersDialog v-model="dailyUsersDialogVisible" />
    </section>
</template>

<style scoped>
.dash-page {
    gap: 16px;
}

/* 进仪表盘时各区块自上而下依次浮现（只在挂载时播一次，每分钟的自动刷新不会重播） */
.dash-page > * {
    animation: dashSectionIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.dash-page > :nth-child(2) { animation-delay: 0.05s; }
.dash-page > :nth-child(3) { animation-delay: 0.1s; }
.dash-page > :nth-child(4) { animation-delay: 0.15s; }
.dash-page > :nth-child(5) { animation-delay: 0.2s; }
.dash-page > :nth-child(n + 6) { animation-delay: 0.25s; }

@keyframes dashSectionIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
}

/* 区块标题：把页面分成「经营概况 / 运行状态 / 流量排行」三段，不加卡片，只是一行小标题 */
.dash-page__section {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 10px 0 -4px;
    color: var(--muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
}

.dash-page__section::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--line);
}

/* 从顶部状态条跳过来时，别让区块顶到浏览器边缘 */
.dash-page__anchor {
    scroll-margin-top: 16px;
}

.dash-page__updated {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    color: var(--muted);
    font-size: 12px;
}

.dash-page__two-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
}

@media (max-width: 1100px) {
    .dash-page__two-col {
        grid-template-columns: 1fr;
    }
}
</style>
