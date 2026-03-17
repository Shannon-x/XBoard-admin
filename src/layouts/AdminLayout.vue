<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
    ArrowDown,
    FolderOpened,
    Promotion,
    Search,
    SwitchButton,
} from "@element-plus/icons-vue";

import { useAdminStore } from "../stores/admin";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const adminStore = useAdminStore();
const authStore = useAuthStore();
const { t } = useI18n();

const pageTitle = computed(function pageTitle() {
    if (route.meta.titleKey) {
        return t(route.meta.titleKey);
    }

    return route.meta.title ?? t("routes.dashboard.title");
});

const pageEyebrow = computed(function pageEyebrow() {
    if (route.meta.eyebrowKey) {
        return t(route.meta.eyebrowKey);
    }

    return route.meta.eyebrow ?? t("routes.dashboard.eyebrow");
});

const activeMenu = computed(function activeMenu() {
    return route.name ?? "dashboard";
});

const headerUserInitial = computed(function headerUserInitial() {
    const email = adminStore.userInfo?.email || "";

    if (!email || email === "--") {
        return "LT";
    }

    return email.charAt(0).toUpperCase();
});

const headerUserEmail = computed(function headerUserEmail() {
    return adminStore.userInfo?.email && adminStore.userInfo.email !== "--"
        ? adminStore.userInfo.email
        : t("app.adminFallback");
});

function handleMenuSelect(routeName) {
    router.push({ name: routeName });
}

function handleAccountCommand(command) {
    if (command !== "logout") {
        return;
    }

    authStore.logout();
    router.push({ name: "login" });
}
</script>

<template>
    <el-container class="app-shell">
        <el-aside class="sidebar" width="288px">
            <div class="brand-panel">
                <div class="brand-mark">L</div>
                <div>
                    <strong>{{ t("app.brand") }}</strong>
                    <p>{{ t("app.console") }}</p>
                </div>
            </div>

            <el-input
                v-model="adminStore.searchKeyword"
                class="search-box"
                :placeholder="t("search.placeholder")"
            >
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>

            <div class="nav-groups">
                <section
                    v-for="group in adminStore.filteredNavigationGroups"
                    :key="group.title"
                    class="nav-group"
                >
                    <div class="nav-title">{{ group.title }}</div>

                    <el-menu
                        :default-active="String(activeMenu)"
                        :router="false"
                        class="nav-menu"
                        background-color="transparent"
                        text-color="#dce7f4"
                        active-text-color="#86efac"
                    >
                        <el-menu-item
                            v-for="item in group.items"
                            :key="`${group.title}-${item.label}`"
                            :index="item.routeName"
                            class="nav-item"
                            @click="handleMenuSelect(item.routeName)"
                        >
                            <el-icon><component :is="item.icon" /></el-icon>
                            <span>{{ item.label }}</span>
                        </el-menu-item>
                    </el-menu>
                </section>
            </div>

            <div class="sidebar-footer">
                <span class="status-dot"></span>
                <span>{{ t("app.status.servicesHealthy") }}</span>
            </div>
        </el-aside>

        <el-main class="main-panel">
            <header class="topbar">
                <div>
                    <div class="eyebrow">{{ pageEyebrow }}</div>
                    <h1>{{ pageTitle }}</h1>
                </div>

                <div class="topbar-actions">
                    <el-dropdown
                        class="header-account"
                        :class="{ loading: adminStore.userInfoLoading }"
                        placement="bottom-end"
                        trigger="click"
                        @command="handleAccountCommand"
                    >
                        <button class="header-account__trigger" type="button">
                            <div class="header-account__meta">
                                <strong>{{ headerUserEmail }}</strong>
                            </div>

                            <div class="header-account__avatar-wrap">
                                <img
                                    v-if="adminStore.userInfo.avatarUrl"
                                    :src="adminStore.userInfo.avatarUrl"
                                    :alt="headerUserEmail"
                                    class="header-account__avatar"
                                />
                                <div
                                    v-else
                                    class="header-account__avatar header-account__avatar--fallback"
                                >
                                    {{ headerUserInitial }}
                                </div>
                            </div>

                            <el-icon class="header-account__arrow"
                                ><ArrowDown
                            /></el-icon>
                        </button>

                        <template #dropdown>
                            <el-dropdown-menu class="header-account__menu">
                                <el-dropdown-item command="logout">
                                    <el-icon><SwitchButton /></el-icon>
                                    <span>{{ t("auth.logout") }}</span>
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </div>
            </header>

            <router-view />
        </el-main>
    </el-container>
</template>
