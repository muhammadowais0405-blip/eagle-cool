import { storeToRefs } from 'pinia'
import { useThemeStore, THEMES, ACCENT_COLORS } from '../stores/theme'

export { THEMES, ACCENT_COLORS }

export function useTheme() {
  const store = useThemeStore()
  const refs = storeToRefs(store)

  return {
    ...refs,
    THEMES,
    ACCENT_COLORS,
    previewTheme: store.previewTheme,
    clearPreview: store.clearPreview,
    selectTheme: store.selectTheme,
    selectAccent: store.selectAccent,
    selectTranslucency: store.selectTranslucency,
    initTheme: store.initTheme
  }
}
