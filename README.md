# XBoard-admin

> 🛠️ 个人重写的 Xboard 管理后台 · Vue 3 + Element Plus

<div align="center">

![Vue](https://img.shields.io/badge/Vue-3.5-42b883.svg)
![Element Plus](https://img.shields.io/badge/Element%20Plus-2.11-409eff.svg)
![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

</div>

---

## ⚠️ 重要说明（请先看完再决定是否使用）

**本仓库是个人从零重写、按自己需求魔改的管理后台，已经不是原版 Xboard 的官方前端。** 使用前你必须知道以下事实：

1. **完全不是原版 Xboard 的 React 后台**
   原版 Xboard 后台是 React + Shadcn UI，本项目是用 Vue 3 + Element Plus 重新写的，UI 结构、组件、状态管理、接口调用全部不一样。

2. **大量功能不在原版 Xboard 范围内**
   节点路由可拖拽排序、公告 Markdown 实时预览与自定义标签、节点权限组重排、礼品卡管理、知识库、主题配置、插件管理 UI、自建 v2node 适配字段……等等都是本项目独有的，原版没有。

3. **与原版 Xboard 后端不适配**
   本后台是为我个人 fork 的后端 [Shannon-x/Xboard-sh](https://github.com/Shannon-x/Xboard-sh) 量身开发。直接接到原版 [cedar2025/Xboard](https://github.com/cedar2025/Xboard) 上**会出现接口字段缺失、404、行为不一致等问题**，请不要把这些当作 Bug 反馈给我或者上游。

4. **配套节点端支持 [v2node](https://github.com/wyx2685/V2bX/tree/v2node) 与 [V2bX](https://github.com/wyx2685/V2bX) 主线**
   后台的节点编辑、路由、权限组、协议字段等全部按 v2node / V2bX 契约设计（**全面适配 v2node**，V2bX 主线一并兼容）。**完全不支持 xbnode**，也不保证兼容 XrayR 等其他节点端。

5. **没有维护承诺**
   纯个人按自己使用习惯调整，可能随时引入 Breaking Change，不会刻意为通用场景做兼容。

6. **仅供学习交流**
   一切因使用本项目造成的后果（违法、被封、被攻击、数据丢失、面板被打穿等）由使用者自行承担。

---

## 🎯 与原版 Xboard 后台的核心差异

| 维度 | 原版 Xboard | 本项目 (XBoard-admin) |
| --- | --- | --- |
| 技术栈 | React + Shadcn UI + TailwindCSS | **Vue 3 + Element Plus + Vite** |
| 状态管理 | Zustand / React Query | **Pinia** |
| 节点端兼容 | xbnode / V2bX / XrayR | **全面适配 v2node，兼容 V2bX 主线；xbnode 完全不支持** |
| 字段定义 | 上游字段 | 按 v2node / V2bX + Xboard-sh 重写 |
| 节点路由 | 列表 | **支持拖拽排序、组内优先级** |
| 公告编辑 | 简版 textarea | **Markdown 实时预览 + 双列布局 + 公告标签** |
| 公告标签 | 无 | **支持自定义标签（v2_notice.tags）** |
| 节点权限组 | 静态 | **可拖拽重排序，决定节点路由生效顺序** |
| 主题配置 | 无 | **支持后台改主题色 / Logo / 文案** |
| 知识库 / 工单 | 上游字段 | UI 重写、字段调整 |
| 后端接口 | 直连官方 | **仅适配 [Shannon-x/Xboard-sh](https://github.com/Shannon-x/Xboard-sh)** |

如果你的目标是"标准 Xboard 后台"，**请用上游 [cedar2025/Xboard](https://github.com/cedar2025/Xboard) 自带的 React 后台，不要用这个项目**。

---

## ✨ 主要特性

- 🎨 Vue 3 `<script setup>` + Element Plus，统一视觉风格
- 🌍 i18n 多语言基建（当前主推 zh-CN）
- 🧩 拖拽排序：节点路由、节点权限组、公告排序
- 📝 公告编辑：Markdown 实时预览（基于 md-editor-v3），公告自有标签
- ⚙️ 节点编辑：完整适配 v2node 的协议字段、路由、tag、权限组（V2bX 主线一并兼容）
- 🎁 礼品卡 / 优惠券 / 套餐 / 工单 / 用户管理一应俱全
- 🛡️ 系统日志、插件管理、主题配置等运营向页面
- 🖥️ 桌面端 & 平板自适应；Safari 兼容性逐项打磨

---

## 🚀 快速开始

```bash
git clone https://github.com/Shannon-x/XBoard-admin.git
cd XBoard-admin

npm install         # 或 pnpm install / bun install

# 配置后端地址
cp .env.example .env    # 若无示例文件可手动新建
# 写入 .env：
#   VITE_API_BASE_URL=https://你的后端域名
#   VITE_DASHBOARD_SECURE_PATH=你的安全路径

npm run dev         # 开发模式，默认 http://localhost:5173
npm run build       # 产出 dist/
npm run preview     # 预览生产构建
```

---

## 🛠️ 技术栈

- **框架**：Vue 3.5 + Vite 8
- **UI**：Element Plus 2.11
- **状态**：Pinia 3
- **路由**：Vue Router 4
- **i18n**：vue-i18n 10
- **Markdown 编辑器**：md-editor-v3 6
- **代码编辑器**：monaco-editor（插件编辑等场景）
- **图标**：lucide-vue-next
- **拖拽**：sortablejs

更多约定请见 [AGENTS.md](./AGENTS.md) 和 [DEPLOYMENT.md](./DEPLOYMENT.md)。

---

## 📦 配套生态

- **必须配套后端**：[Shannon-x/Xboard-sh](https://github.com/Shannon-x/Xboard-sh)
- **节点端**：[V2bX v2node 分支](https://github.com/wyx2685/V2bX/tree/v2node)（推荐，全面适配） / [V2bX 主线](https://github.com/wyx2685/V2bX)（兼容）
- **后台前端（本仓库）**：[Shannon-x/XBoard-admin](https://github.com/Shannon-x/XBoard-admin)

三件套绑定使用；节点端可在 v2node（推荐）与 V2bX 主线之间二选一。混搭原版 Xboard / xbnode / XrayR 大概率跑不起来，作者不承诺兼容。

---

## ⚠️ 免责声明

1. 本项目是 [cedar2025/Xboard](https://github.com/cedar2025/Xboard) 的个人魔改前端实现，**与上游官方无关**，不代表上游立场。
2. 本项目仅供个人学习、技术研究交流。
3. **严禁**用于任何违反所在国家或地区法律法规的用途。
4. 由于深度魔改，本项目与原版 Xboard 的后端、节点端、文档均不保证兼容；混用造成的故障由使用者自行排查。
5. 一切因使用本项目产生的法律责任、数据安全问题、服务中断、资产损失等，**均由使用者自行承担**，作者不承担任何责任。
6. 使用、克隆、部署本项目即视为已阅读并同意本声明。

---

## 🤝 反馈

- 与原版 Xboard 行为不一致 → **不是 Bug**，是设计目标，不会改
- 本项目自身逻辑错误 / 崩溃 / 安全问题 → 欢迎提 Issue
- 想加新功能 → 自行 fork 修改更省事，PR 是否合并取决于是否符合本人使用场景
