import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', () => {
  const showSidebar = ref(true)
  const showInspector = ref(true)
  const sidebarWidth = ref(240)
  
  const zoom = ref(5)
  const activeLayout = ref('justified')
  
  const gridShowName = ref(true)
  const gridShowItemInfo = ref(true)
  const gridItemInfoType = ref('dimensions')
  const gridShowExtension = ref(true)
  const gridShowSubfolder = ref(true)
  
  const filterBarOpen = ref(false)
  const globalMute = ref(false)
  const isCompareMode = ref(false)

  function toggleSidebar() { showSidebar.value = !showSidebar.value }
  function toggleInspector() { showInspector.value = !showInspector.value }
  
  function togglePanels() {
    const anyOpen = showSidebar.value || showInspector.value
    showSidebar.value = !anyOpen
    showInspector.value = !anyOpen
  }

  function zoomIn() { if (zoom.value < 10) zoom.value++ }
  function zoomOut() { if (zoom.value > 1) zoom.value-- }
  
  function toggleMute() { globalMute.value = !globalMute.value }
  function toggleCompareMode() { isCompareMode.value = !isCompareMode.value }

  return {
    showSidebar, showInspector, sidebarWidth,
    zoom, activeLayout,
    gridShowName, gridShowItemInfo, gridItemInfoType, gridShowExtension, gridShowSubfolder,
    filterBarOpen, globalMute, isCompareMode,
    toggleSidebar, toggleInspector, togglePanels, zoomIn, zoomOut, toggleMute, toggleCompareMode
  }
}, {
  persist: {
    pick: [
      'showSidebar', 'showInspector', 'sidebarWidth', 
      'zoom', 'activeLayout', 
      'gridShowName', 'gridShowItemInfo', 'gridItemInfoType', 'gridShowExtension', 'gridShowSubfolder', 
      'globalMute'
    ]
  }
})
