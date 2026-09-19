// Each list keeps its own preference across navigation, reloads and browser sessions.
export function createPageSizePreference(scope, defaultSize, pageSizes) {
  const key = `xboard-admin:page-size:${scope}`
  let initialSize = defaultSize

  try {
    const savedSize = Number(localStorage.getItem(key))
    if (pageSizes.includes(savedSize)) initialSize = savedSize
  } catch {
    // Storage may be disabled; pagination must still work.
  }

  function save(size) {
    if (!pageSizes.includes(size)) return
    try {
      localStorage.setItem(key, String(size))
    } catch {
      // A failed preference write must not prevent loading the selected page.
    }
  }

  return { initialSize, pageSizes, save }
}
