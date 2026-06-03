import { readStoredAuth, signalAuthExpired } from "./auth";
import i18n from "../i18n";

function getApiOrigin() {
  return import.meta.env.VITE_API_BASE_URL || "/";
}

function getDashboardSecurePath() {
  return import.meta.env.VITE_DASHBOARD_SECURE_PATH || "";
}

function getNormalizedApiOrigin() {
  return getApiOrigin().replace(/\/$/, "");
}

function getNormalizedSecurePath() {
  return getDashboardSecurePath().replace(/^\//, "");
}

/**
 * 拼接管理后台 v2 接口 URL。endpointPath 可带或不带前导 `/`。
 * 之前同时存在 buildDashboardApiUrl 与 buildSecureV2ApiUrl —— 实际逻辑等价，
 * 这里统一实现，buildSecureV2ApiUrl 保留为别名以保持 import 兼容。
 */
export function buildDashboardApiUrl(endpointPath, queryEntries = []) {
  const apiOrigin = getNormalizedApiOrigin();
  const securePath = getNormalizedSecurePath();
  const normalizedEndpoint = String(endpointPath || "").replace(/^\//, "");
  const url = new URL(
    `${apiOrigin}/api/v2/${securePath}/${normalizedEndpoint}`,
  );

  queryEntries.forEach(function appendQueryEntry([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  // cache-buster：后端 Cache-Control 头并不可靠，先保留；如果未来后端补好可考虑移除。
  url.searchParams.set("t", String(Date.now()));

  return url.toString();
}

// 历史 alias —— 与 buildDashboardApiUrl 等价。保留以兼容现有 import。
export const buildSecureV2ApiUrl = buildDashboardApiUrl;

export function buildCommonApiUrl(endpointPath, queryEntries = []) {
  const apiOrigin = getNormalizedApiOrigin();
  const normalizedPath = String(endpointPath || "").replace(/^\//, "");
  const url = new URL(`${apiOrigin}/api/v1/${normalizedPath}`);

  queryEntries.forEach(function appendQueryEntry([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("t", String(Date.now()));

  return url.toString();
}

export function getDashboardApiHeaders() {
  const storedSession = readStoredAuth();
  // SPA 不再支持构建期注入的全局 API token：任何 VITE_ 变量都会被打到 dist
  // 里面对所有浏览器用户暴露。会话凭据必须由 /passport/auth/login 走用户登录拿到。
  const headers = {
    Accept: "application/json, text/plain, */*",
  };
  const authData = storedSession?.authData;
  if (authData && typeof authData === 'string') {
    headers.Authorization = authData;
  }
  return headers;
}

export async function requestDashboardApi(url) {
  const response = await fetch(url, {
    headers: getDashboardApiHeaders(),
  });

  if (response.status === 401 || response.status === 403) {
    signalAuthExpired(`get:${response.status}`);
    throw new Error(resolveMessage("defaults.dashboardStatsAuthFailed"));
  }

  if (!response.ok) {
    throw new Error(
      resolveMessage("defaults.dashboardRequestFailed", {
        status: response.status,
      }),
    );
  }

  const payload = await response.json();

  if (payload?.status && payload.status !== "success") {
    throw new Error(
      payload.message || resolveMessage("defaults.dashboardStatusFailed"),
    );
  }

  if (payload?.code !== undefined && Number(payload.code) !== 0) {
    throw new Error(
      payload.message || resolveMessage("defaults.dashboardCodeFailed"),
    );
  }

  return payload;
}

export async function requestDashboardMutation(url, payload, method = "POST") {
  const headers = {
    ...getDashboardApiHeaders(),
    "Content-Type": "application/json",
  };
  const response = await fetch(url, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    signalAuthExpired(`mutation:${response.status}`);
    throw new Error(resolveMessage("defaults.dashboardStatsAuthFailed"));
  }

  if (!response.ok) {
    if (response.status === 422) {
      const errBody = await response.json().catch(() => null);
      throw new Error(
        errBody?.message || errBody?.errors
          ? `验证失败: ${JSON.stringify(errBody?.errors || errBody?.message)}`
          : `请求失败: ${response.status}`,
      );
    }
    throw new Error(
      resolveMessage("defaults.dashboardRequestFailed", {
        status: response.status,
      }),
    );
  }

  const responsePayload = await response.json();

  if (responsePayload?.status && responsePayload.status !== "success") {
    throw new Error(
      responsePayload.message ||
        resolveMessage("defaults.dashboardStatusFailed"),
    );
  }

  if (
    responsePayload?.code !== undefined &&
    Number(responsePayload.code) !== 0
  ) {
    throw new Error(
      responsePayload.message || resolveMessage("defaults.dashboardCodeFailed"),
    );
  }

  return responsePayload;
}

export async function requestDashboardUpload(url, formData, method = "POST") {
  const headers = {
    ...getDashboardApiHeaders(),
  };
  const response = await fetch(url, {
    method,
    headers,
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    signalAuthExpired(`upload:${response.status}`);
    throw new Error(resolveMessage("defaults.dashboardStatsAuthFailed"));
  }

  if (!response.ok) {
    throw new Error(
      resolveMessage("defaults.dashboardRequestFailed", {
        status: response.status,
      }),
    );
  }

  const responsePayload = await response.json();

  if (responsePayload?.status && responsePayload.status !== "success") {
    throw new Error(
      responsePayload.message ||
        resolveMessage("defaults.dashboardStatusFailed"),
    );
  }

  if (
    responsePayload?.code !== undefined &&
    Number(responsePayload.code) !== 0
  ) {
    throw new Error(
      responsePayload.message || resolveMessage("defaults.dashboardCodeFailed"),
    );
  }

  return responsePayload;
}

function resolveMessage(key, values) {
  if (i18n?.global?.te?.(key)) {
    return i18n.global.t(key, values);
  }
  // i18n 缺 key 时直接返回 key 本身：让开发期立刻发现缺失，而不是被 fallback
  // 字典默默兜底。之前的中文 fallback 重复了 zh-CN.js 里的字面量，永远不会触发。
  return key;
}
