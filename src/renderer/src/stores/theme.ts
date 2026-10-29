import { ref } from 'vue'
import { defineStore } from 'pinia'

export const THEMES = [
  { id: 'auto',           name: 'Auto',          color: 'linear-gradient(135deg, #f5f5f7 50%, #1c1c1e 50%)' },
  { id: 'light-clean',    name: 'Clean Light',   color: '#ffffff' },
  { id: 'light-warm',     name: 'Parchment',     color: '#f4ece2' },
  { id: 'dark-graphite',  name: 'Graphite',      color: '#1c1c1e' },
  { id: 'dark-oled',      name: 'OLED Black',    color: '#000000' },
  { id: 'dark-midnight',  name: 'Midnight',      color: '#0f172a' },
  { id: 'dark-nord',      name: 'Arctic Frost',  color: '#2e3440' },
  { id: 'dark-aubergine', name: 'Deep Plum',     color: '#231526' },
]

export const ACCENT_COLORS = [
  { name: 'Pink',    value: '#e8318a' },
  { name: 'Blue',    value: '#0a84ff' },
  { name: 'Sky',     value: '#38bdf8' },
  { name: 'Purple',  value: '#c084fc' },
  { name: 'Green',   value: '#34c759' },
  { name: 'Orange',  value: '#ff9f0a' },
  { name: 'Red',     value: '#ff453a' },
  { name: 'Teal',    value: '#2dd4bf' },
  { name: 'Yellow',  value: '#fbbf24' },
  { name: 'White',   value: '#e5e5e5' },
]

export const useThemeStore = defineStore('theme', () => {
  const currentTheme  = ref('auto')
  const currentAccent = ref('#e8318a')
  const currentTranslucency = ref(true)

  function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return `${r},${g},${b}`
  }

  function applyAccentToDom(hex: string) {
    const root = document.documentElement.style
    root.setProperty('--accent', hex)
    root.setProperty('--accent-dim',  `rgba(${hexToRgb(hex)}, 0.15)`)
    root.setProperty('--accent-glow', `0 0 0 2px rgba(${hexToRgb(hex)}, 0.25)`)
  }

  function applyThemeToDom(theme: string) {
    document.documentElement.classList.add('theme-transitioning')
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300)

    if (theme === 'auto') {
      const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', isDark ? 'dark-graphite' : 'light-clean')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    
    // Apply Translucency
    document.documentElement.setAttribute('data-translucency', currentTranslucency.value ? 'on' : 'off')
    
    applyAccentToDom(currentAccent.value)
    
    if ((window as any).api?.invoke) {
      (window as any).api.invoke('window:set-theme', theme).catch(() => {})
    }
  }

  function previewTheme(themeId: string) { applyThemeToDom(themeId) }
  function clearPreview() { applyThemeToDom(currentTheme.value) }
  
  function selectTheme(themeId: string) {
    currentTheme.value = themeId
    applyThemeToDom(themeId)
  }

  function selectAccent(hex: string) {
    currentAccent.value = hex
    applyAccentToDom(hex)
  }

  function selectTranslucency(val: boolean) {
    currentTranslucency.value = val
    applyThemeToDom(currentTheme.value)
  }

  function initTheme() {
    const themeMap: Record<string, string> = {
      'light': 'light-clean', 'light-gray': 'light-clean',
      'dark': 'dark-graphite', 'dark-gray': 'dark-graphite',
      'dark-blue': 'dark-midnight', 'dark-purple': 'dark-aubergine'
    }
    if (themeMap[currentTheme.value]) {
      currentTheme.value = themeMap[currentTheme.value]
    }

    applyThemeToDom(currentTheme.value)

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme.value === 'auto') applyThemeToDom('auto')
      })
    }
  }

  return {
    currentTheme,
    currentAccent,
    currentTranslucency,
    previewTheme,
    clearPreview,
    selectTheme,
    selectAccent,
    selectTranslucency,
    initTheme
  }
}, {
  persist: {
    pick: ['currentTheme', 'currentAccent', 'currentTranslucency'],
    afterRestore: (ctx) => {
      ctx.store.initTheme()
    }
  }
})
