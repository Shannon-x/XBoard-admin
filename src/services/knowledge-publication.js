export const KNOWLEDGE_VISIBILITIES = ['public', 'members', 'subscribers', 'admin']
export const PUBLIC_SLUG_MAX_LENGTH = 120
export const PUBLIC_SUMMARY_MAX_LENGTH = 500

export function normalizeKnowledgeCapabilities(payload) {
  const data = payload?.data
  if (
    data?.publication_version !== 1 ||
    !Array.isArray(data.visibilities) ||
    !KNOWLEDGE_VISIBILITIES.every(value => data.visibilities.includes(value))
  ) {
    throw new Error('后端尚未完整支持知识库访问范围，请先升级后端与数据库；为避免误公开，当前不能保存或发布文章。')
  }
  return { publicationVersion: 1, publicEnabled: data.public_enabled === true }
}

export function createKnowledgeForm(categoryId = null) {
  return {
    id: null, categoryId, title: '', body: '', language: 'zh-CN',
    show: false, sort: 0, visibility: 'members', slug: '', summary: '',
    publicReviewed: false,
  }
}

export function hasPrivateKnowledgeContent(text) {
  const value = String(text || '')
  const withoutSiteName = value.replaceAll('{{siteName}}', '')
  return /\{\{|\}\}/.test(withoutSiteName) || /<!-*\s*\/?\s*access(?:\b|start|end)/i.test(value)
}

export function validateKnowledgePublication(form, articles = []) {
  if (!KNOWLEDGE_VISIBILITIES.includes(form.visibility)) return '访问范围无法识别，请明确选择后再保存。'
  if (form.visibility !== 'public') return ''

  if (!String(form.slug || '').trim()) return '公开指南需要填写稳定网址。'
  if (
    form.slug.length > PUBLIC_SLUG_MAX_LENGTH ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
  ) return '网址只能使用小写英文字母、数字和单个连字符，最长 120 个字符。'
  if (!String(form.summary || '').trim()) return '请填写经过审核的公开摘要，不要直接截取私人正文。'
  if ([...form.summary.trim()].length > PUBLIC_SUMMARY_MAX_LENGTH) return '公开摘要最长 500 个字符。'
  if (articles.some(article => (
    String(article.id) !== String(form.id) &&
    article.language === form.language && article.slug === form.slug
  ))) return '同一语言已有文章使用这个网址，请换一个网址。'
  if (hasPrivateKnowledgeContent([form.title, form.categoryId, form.slug, form.summary, form.body].join('\n'))) {
    return '发现个人订阅占位符、未知模板变量或 access 保护标记，不能直接公开。请改写通用说明，私人步骤保留在会员文章。'
  }
  if (form.show && form.publicReviewed !== true) return '请先确认已审核全部公开内容，再发布或保存这篇公开指南。'
  return ''
}

export function buildKnowledgePayload(form) {
  return {
    id: form.id || null,
    category: String(form.categoryId ?? '').trim(),
    title: String(form.title || '').trim(),
    body: form.body,
    language: form.language || '',
    show: form.show ? 1 : 0,
    sort: form.sort ?? 0,
    visibility: form.visibility,
    slug: String(form.slug || '').trim() || null,
    summary: String(form.summary || '').trim() || null,
    public_reviewed: form.publicReviewed === true,
  }
}

export function assertKnowledgeMutation(payload) {
  if (payload?.data !== true) throw new Error('后端没有确认操作成功，请刷新核对文章状态后重试。')
  return payload
}
