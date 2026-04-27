import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

function normalizeArticle(raw) {
  const category = raw.category ?? raw.category_id ?? ''
  const categoryName =
    typeof category === 'object'
      ? String(category?.title || category?.name || '').trim()
      : String(category || '').trim()

  return {
    id: raw.id,
    categoryId: categoryName,
    categoryName,
    title: raw.title || '',
    body: raw.body || '',
    show: Boolean(raw.show),
    sort: raw.sort ?? 0,
    language: raw.language || '',
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

function normalizeCategory(raw, index) {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const title = String(raw).trim()

    return {
      id: title,
      title,
      description: '',
      sort: index,
    }
  }

  const title = String(raw?.title || raw?.name || raw?.category || '').trim()

  return {
    id: String(raw?.id ?? title).trim(),
    title,
    description: raw?.description || '',
    sort: raw?.sort ?? index,
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
  const seen = new Set()

  return list
    .map(normalizeCategory)
    .filter(function filterCategory(category) {
      if (!category.id || !category.title || seen.has(category.id)) {
        return false
      }

      seen.add(category.id)
      return true
    })
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
      category: formData.categoryId,
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
