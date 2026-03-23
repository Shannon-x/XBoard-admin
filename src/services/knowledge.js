import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

function normalizeArticle(raw) {
  return {
    id: raw.id,
    categoryId: raw.category_id ?? null,
    categoryName: raw.category?.title || '',
    title: raw.title || '',
    body: raw.body || '',
    show: Boolean(raw.show),
    sort: raw.sort ?? 0,
    language: raw.language || '',
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

function normalizeCategory(raw) {
  return {
    id: raw.id,
    title: raw.title || raw.name || '',
    description: raw.description || '',
    sort: raw.sort ?? 0,
  }
}

export async function fetchKnowledgeArticles() {
  const apiUrl = buildDashboardApiUrl('knowledge/fetch')
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return list.map(normalizeArticle)
}

export async function fetchKnowledgeCategories() {
  const apiUrl = buildDashboardApiUrl('knowledge/getCategory')
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return list.map(normalizeCategory)
}

export async function saveKnowledgeArticle(formData) {
  const apiUrl = buildDashboardApiUrl('knowledge/save')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: formData.id || null,
      category_id: formData.categoryId,
      title: formData.title,
      body: formData.body,
      language: formData.language || '',
      show: formData.show ? 1 : 0,
      sort: formData.sort ?? 0,
    }),
  })

  if (!response.ok) {
    throw new Error(`保存知识库文章失败 (${response.status})`)
  }

  return response.json()
}

export async function toggleKnowledgeShow(id) {
  const apiUrl = buildDashboardApiUrl('knowledge/show')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`切换知识库显示状态失败 (${response.status})`)
  }

  return response.json()
}

export async function deleteKnowledgeArticle(id) {
  const apiUrl = buildDashboardApiUrl('knowledge/drop')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`删除知识库文章失败 (${response.status})`)
  }

  return response.json()
}

export async function sortKnowledgeArticles(ids) {
  const apiUrl = buildDashboardApiUrl('knowledge/sort')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })

  if (!response.ok) {
    throw new Error(`排序知识库文章失败 (${response.status})`)
  }

  return response.json()
}
