import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { computed, effectScope, reactive, ref, watch } from 'vue'
import {
  assertKnowledgeMutation,
  buildKnowledgePayload,
  createKnowledgeForm,
  hasPrivateKnowledgeContent,
  KNOWLEDGE_VISIBILITIES,
  normalizeKnowledgeCapabilities,
  validateKnowledgePublication,
} from '../src/services/knowledge-publication.js'

const validCapabilities = { data: { publication_version: 1, visibilities: KNOWLEDGE_VISIBILITIES, public_enabled: false } }
assert.equal(normalizeKnowledgeCapabilities(validCapabilities).publicationVersion, 1)
assert.equal(normalizeKnowledgeCapabilities(validCapabilities).publicEnabled, false)
for (const payload of [null, {}, { data: true }, { data: { publication_version: 0, visibilities: KNOWLEDGE_VISIBILITIES } }, { data: { publication_version: 1, visibilities: ['public', 'members'] } }]) {
  assert.throws(() => normalizeKnowledgeCapabilities(payload))
}
assert.equal(createKnowledgeForm().visibility, 'members')
assert.equal(createKnowledgeForm().show, false)
assert.throws(() => assertKnowledgeMutation({ data: false }))
assert.throws(() => assertKnowledgeMutation({ status: 'success' }))
assert.equal(assertKnowledgeMutation({ data: true }).data, true)

const publicForm = { ...createKnowledgeForm('Getting started'), title: 'Welcome', body: 'Public information', visibility: 'public', slug: 'first-guide', summary: 'An introduction', show: true, publicReviewed: true }
assert.equal(validateKnowledgePublication(publicForm), '')
assert.ok(validateKnowledgePublication({ ...publicForm, publicReviewed: false }))
for (const slug of ['', 'Uppercase', 'double--dash', 'slash/path', '-prefix', 'a'.repeat(121)]) {
  assert.ok(validateKnowledgePublication({ ...publicForm, slug }))
}
assert.ok(validateKnowledgePublication({ ...publicForm, summary: '' }))
assert.ok(validateKnowledgePublication({ ...publicForm, summary: 'a'.repeat(501) }))
assert.ok(validateKnowledgePublication(publicForm, [{ id: 20, language: 'zh-CN', slug: 'first-guide' }]))
assert.equal(validateKnowledgePublication(publicForm, [{ id: 20, language: 'en', slug: 'first-guide' }]), '')
assert.equal(validateKnowledgePublication({ ...publicForm, id: 20 }, [{ id: '20', language: 'zh-CN', slug: 'first-guide' }]), '')
for (const content of ['{{ subscribeUrl }}', '{{URLENCODESUBSCRIBEURL}}', '{{safeBase64SubscribeUrl}}', '{{other}}', '{{unclosed', '<!--access start-->', '<!-- ACCESS END', '<!- accessstart -->']) {
  assert.equal(hasPrivateKnowledgeContent(content), true)
  for (const field of ['title', 'categoryId', 'summary', 'body']) {
    assert.ok(validateKnowledgePublication({ ...publicForm, [field]: content, show: false }))
  }
}
assert.equal(hasPrivateKnowledgeContent('{{siteName}}'), false)
assert.equal(hasPrivateKnowledgeContent('{{ siteName }}'), true)
assert.equal(hasPrivateKnowledgeContent('{{SiteName}}'), true)
assert.equal(validateKnowledgePublication({ ...publicForm, body: 'Welcome to {{siteName}}' }), '')
assert.equal(validateKnowledgePublication({ ...publicForm, visibility: 'members', body: '{{subscribeUrl}}', slug: '', summary: '' }), '')
assert.equal(buildKnowledgePayload(publicForm).public_reviewed, true)
assert.equal(buildKnowledgePayload(createKnowledgeForm()).show, 0)
assert.equal(buildKnowledgePayload(createKnowledgeForm()).slug, null)

// Exercise the real service's gate and response checks without any network calls.
const serviceSource = (await readFile(new URL('../src/services/knowledge.js', import.meta.url), 'utf8'))
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*$/gm, '')
  .replace(/^export /gm, '')
let capabilityPayload = validCapabilities
let mutationPayload = { data: true }
const requests = []
const serviceContext = {
  assertKnowledgeMutation, buildKnowledgePayload, normalizeKnowledgeCapabilities, validateKnowledgePublication,
  buildDashboardApiUrl: path => path,
  requestDashboardApi: async path => {
    requests.push(['read', path])
    return capabilityPayload
  },
  requestDashboardMutation: async (path, payload) => {
    requests.push(['write', path, payload])
    return mutationPayload
  },
}
vm.runInNewContext(serviceSource + '\n globalThis.service = { saveKnowledgeArticle, toggleKnowledgeShow, normalizeArticle };', serviceContext)
assert.equal(serviceContext.service.normalizeArticle({ show: '0' }).show, false)
assert.equal(serviceContext.service.normalizeArticle({ show: 1 }).show, true)
assert.equal(serviceContext.service.normalizeArticle({}).visibility, 'members')
assert.equal(serviceContext.service.normalizeArticle({ visibility: 'unexpected' }).visibility, 'unexpected')
await serviceContext.service.saveKnowledgeArticle(publicForm)
assert.equal(requests[0][1], 'knowledge/capabilities')
assert.equal(requests[1][2].public_reviewed, true)
capabilityPayload = { data: true }
const writeCount = requests.filter(([kind]) => kind === 'write').length
await assert.rejects(() => serviceContext.service.saveKnowledgeArticle(publicForm))
await assert.rejects(() => serviceContext.service.toggleKnowledgeShow(7, false))
assert.equal(requests.filter(([kind]) => kind === 'write').length, writeCount)
capabilityPayload = validCapabilities
await assert.rejects(() => serviceContext.service.toggleKnowledgeShow(7))
await serviceContext.service.toggleKnowledgeShow(7, false)
await serviceContext.service.toggleKnowledgeShow(7, false)
const withdrawals = requests.filter(([kind, path]) => kind === 'write' && path === 'knowledge/show')
assert.equal(withdrawals.length, 2)
assert.equal(withdrawals[0][2].show, false)
assert.equal(withdrawals[1][2].show, false, 'Repeated withdrawals explicitly retain the unpublished state')
mutationPayload = { data: false }
await assert.rejects(() => serviceContext.service.saveKnowledgeArticle(publicForm))

// Execute the actual Vue setup logic with reactive state and inert API doubles.
// No admin credentials, backend calls or production writes are used.
const sfc = await readFile(new URL('../src/views/KnowledgePage.vue', import.meta.url), 'utf8')
const setup = sfc.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*$/gm, '')
const messages = []
const saves = []
const sample = { ...publicForm, id: 7, categoryId: 'Getting started', categoryName: 'Getting started' }
let supported = true
let detailFails = false
let toggles = 0
const requestedStates = []
const context = {
  computed, reactive, ref, watch, onMounted: () => {},
  FileLock2: {}, Globe2: {}, LockKeyhole: {}, Plus: {}, ShieldCheck: {},
  ElMessage: { success: value => messages.push(value), error: () => {}, info: () => {} },
  ElMessageBox: { confirm: async () => true },
  KNOWLEDGE_VISIBILITIES, createKnowledgeForm, hasPrivateKnowledgeContent, validateKnowledgePublication,
  fetchKnowledgeCapabilities: async () => {
    if (!supported) throw new Error('Unsupported backend')
    return normalizeKnowledgeCapabilities(validCapabilities)
  },
  fetchKnowledgeArticles: async () => [sample],
  fetchKnowledgeCategories: async () => [{ id: 'Getting started', title: 'Getting started' }],
  fetchKnowledgeArticle: async () => {
    if (detailFails) throw new Error('Detail failed')
    return sample
  },
  saveKnowledgeArticle: async value => { saves.push({ ...value }); return { data: true } },
  toggleKnowledgeShow: async (id, expectedShow) => { toggles += 1; requestedStates.push({ id, show: expectedShow }); return { data: true } },
  deleteKnowledgeArticle: async () => ({ data: true }),
  sortKnowledgeArticles: async () => ({ data: true }),
}
const scope = effectScope()
scope.run(() => vm.runInNewContext(setup + '\n globalThis.state = { form, formError, publicationReady, dialogVisible, formLocked, loadData, checkCapabilities, openCreateDialog, openEditDialog, handleSave, changeVisibility, chooseAudience, handleToggleShow };', context))
const state = context.state
await state.loadData()
assert.equal(state.publicationReady.value, true)
state.openCreateDialog()
assert.equal(state.form.visibility, 'members')
assert.equal(state.form.show, false)
await state.openEditDialog(sample)
assert.equal(state.form.publicReviewed, false)
await state.handleSave()
assert.equal(saves.length, 0, 'An existing public article needs fresh review')
state.form.publicReviewed = true
state.form.categoryId = 'Another category'
assert.equal(state.form.publicReviewed, false, 'Metadata changes reset review')
assert.equal(state.form.visibility, 'public', 'Categories do not change access')
assert.equal(state.form.show, true, 'Categories do not change publication state')
state.changeVisibility('members')
assert.equal(state.form.show, false, 'Changing audience cannot publish implicitly')
state.form.show = true
state.changeVisibility('subscribers')
assert.equal(state.form.show, false)
state.chooseAudience('members')
assert.equal(state.form.visibility, 'subscribers', 'The member card preserves its subscription requirement')
state.changeVisibility('admin')
state.form.show = true
await state.handleSave()
assert.equal(saves.at(-1).visibility, 'admin')
await state.handleToggleShow({ ...sample, show: false })
assert.equal(toggles, 0, 'Publishing a public article must use the reviewed editor')
await state.handleToggleShow(sample)
assert.equal(toggles, 1, 'Withdrawing an existing public article remains available')
assert.equal(requestedStates.at(-1).show, false)
await state.handleToggleShow({ ...sample, visibility: 'members', show: false })
assert.equal(requestedStates.at(-1).show, true)
await state.handleToggleShow({ ...sample, visibility: 'members', show: true })
await state.handleToggleShow({ ...sample, visibility: 'members', show: true })
assert.equal(requestedStates.at(-1).show, false)
assert.equal(requestedStates.at(-2).show, false, 'Two stale published rows must both request withdrawal')
const toggleCount = toggles
supported = false
await state.checkCapabilities()
assert.equal(state.publicationReady.value, false)
const savedCount = saves.length
await state.handleSave()
await state.handleToggleShow({ ...sample, visibility: 'members' })
assert.equal(saves.length, savedCount, 'An unsupported backend must never receive a save')
assert.equal(toggles, toggleCount, 'An unsupported backend must never receive a publication toggle')
supported = true
await state.checkCapabilities()
detailFails = true
await state.openEditDialog(sample)
assert.equal(state.formLocked.value, true, 'A failed detail load cannot overwrite an article')
scope.stop()
console.log('Knowledge publication checks passed: capability gate, publication review, audience changes, safe defaults, validation and Vue editor state.')
