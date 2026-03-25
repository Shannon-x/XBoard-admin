<script setup>
import { useI18n } from "vue-i18n";
import {
    Activity,
    ArrowDownToLine,
    ArrowUpFromLine,
    BadgeDollarSign,
    Coins,
    Server,
    Smartphone,
    TicketCheck,
    UserRound,
} from "lucide-vue-next";

defineProps({
    loading: {
        type: Boolean,
        default: false,
    },
    metrics: {
        type: Array,
        required: true,
    },
});

const emit = defineEmits(['metric-click'])

const { t } = useI18n();

const metricIconMap = {
    收入: Coins,
    佣金: BadgeDollarSign,
    工单: TicketCheck,
    用户: UserRound,
    上传: ArrowUpFromLine,
    下载: ArrowDownToLine,
    节点: Server,
    设备: Smartphone,
    流量: Activity,
};

function resolveMetricIcon(label) {
    const matchedKeyword = Object.keys(metricIconMap).find(
        function findKeyword(keyword) {
            return String(label || "").includes(keyword);
        },
    );

    return matchedKeyword ? metricIconMap[matchedKeyword] : UserRound;
}

function resolveTrendClass(changeText) {
    const text = String(changeText || "");

    if (text.includes("↑") || text.includes("+")) {
        return "up";
    }

    if (text.includes("↘") || text.includes("-")) {
        return "down";
    }

    return "neutral";
}

function resolveTrendText(changeText) {
    const state = resolveTrendClass(changeText);

    if (state === "up") {
        return t("metrics.trend.up");
    }

    if (state === "down") {
        return t("metrics.trend.down");
    }

    return t("metrics.trend.flat");
}

function isSplitMetric(metric) {
    return Boolean(
        metric?.compact &&
        String(metric?.label || "").includes(" / ") &&
        String(metric?.value || "").includes(" / "),
    );
}

function splitMetricText(text) {
    return String(text || "")
        .split(" / ")
        .map(function trimPart(part) {
            return part.trim();
        });
}

function resolveMetricSegments(metric) {
    const labels = splitMetricText(metric.label);
    const values = splitMetricText(metric.value);

    return labels.map(function mapSegment(label, index) {
        return {
            label,
            value: values[index] || "--",
        };
    });
}
</script>

<template>
    <div class="metric-grid">
        <el-card
            v-for="metric in metrics"
            :key="metric.label"
            v-loading="loading"
            class="metric-card"
            :class="[
                'metric-card--unified',
                { 'metric-card--compact': metric.compact },
                { 'metric-card--clickable': metric.label === '待处理工单' || metric.label === '待处理佣金' },
            ]"
            shadow="never"
            @click="emit('metric-click', metric.label)"
        >
            <div class="metric-head">
                <span class="metric-label-wrap">
                    <el-icon class="metric-icon"
                        ><component :is="resolveMetricIcon(metric.label)"
                    /></el-icon>
                    <span v-if="!isSplitMetric(metric)" class="metric-label">{{
                        metric.label
                    }}</span>
                    <span v-else class="metric-label metric-label--split">{{
                        splitMetricText(metric.label).join(" · ")
                    }}</span>
                </span>
            </div>
            <div v-if="isSplitMetric(metric)" class="metric-split-value">
                <div
                    v-for="segment in resolveMetricSegments(metric)"
                    :key="segment.label"
                    class="metric-split-value__item"
                >
                    <span class="metric-split-value__label">{{
                        segment.label
                    }}</span>
                    <strong class="metric-split-value__number">{{
                        segment.value
                    }}</strong>
                </div>
            </div>
            <strong v-else class="metric-value">{{ metric.value }}</strong>
            <span
                class="metric-change"
                :class="`metric-change--${resolveTrendClass(metric.change)}`"
                >{{ metric.change }}</span
            >
        </el-card>
    </div>
</template>
