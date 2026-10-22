<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import DailyNewUsersDialog from "../components/dashboard/DailyNewUsersDialog.vue";
import DashboardKpiGrid from "../components/dashboard/DashboardKpiGrid.vue";
import DashboardTodoBar from "../components/dashboard/DashboardTodoBar.vue";
import IncomeTrendCard from "../components/dashboard/IncomeTrendCard.vue";
import SubscriptionCard from "../components/dashboard/SubscriptionCard.vue";
import SystemHealthCard from "../components/dashboard/SystemHealthCard.vue";
import TrafficRankCard from "../components/dashboard/TrafficRankCard.vue";
import { formatMinutesWindow } from "../components/dashboard/dashboardFormat";
import {
    createEmptyDashboardOverview,
    createEmptySystemHealth,
    fetchDashboardOverview,
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

function refreshAll() {
    loadOverview();
    loadHealth();
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
    adminStore.loadNodeTrafficRank();
    adminStore.loadUserTrafficRank();

    // 概况与系统状态每分钟静默刷新一次；标签页不可见时跳过
    autoRefreshTimer = setInterval(function tick() {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        if (!overviewLoading.value) loadOverview();
        if (!healthLoading.value) loadHealth();
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

        <div class="dash-page__top">
            <DashboardTodoBar
                class="dash-page__todo"
                :todo="overview.todo"
                :nodes="overview.nodes"
                :failed-jobs="health.failedJobs"
                :failed-window-text="failedWindowText"
                :loaded="overview.loaded && health.loaded"
            />
            <div class="dash-page__updated">
                <span v-if="updatedAtText">数据更新于 {{ updatedAtText }}，每分钟自动刷新</span>
                <el-button size="small" plain :loading="overviewLoading" @click="refreshAll">全部刷新</el-button>
            </div>
        </div>

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
            <SystemHealthCard
                :health="health"
                :nodes="overview.nodes"
                :loading="healthLoading"
                :error="healthError"
                @refresh="loadHealth"
            />
        </div>

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

.dash-page__top {
    display: flex;
    align-items: stretch;
    gap: 12px;
    flex-wrap: wrap;
}

.dash-page__todo {
    flex: 1 1 520px;
}

.dash-page__updated {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 12px;
}

.dash-page__two-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}

@media (max-width: 1100px) {
    .dash-page__two-col {
        grid-template-columns: 1fr;
    }
}
</style>
