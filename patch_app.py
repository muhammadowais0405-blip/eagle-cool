import re

with open('src/renderer/src/App.vue', 'r') as f:
    content = f.read()

# 1. Update useAppSearch destructured vars
use_app_search = """const {
  searchText, activeView, activeTag, activeFolderId, selectedFolderIds, filters, hasActiveFilters,
  clearFilters, onFilterChange, reloadCurrentView, onFindSimilar, onSearch,
  setView, handleBatchUpdate
} = searchState"""

new_use_app_search = """const {
  searchText, itemSortBy, itemSortDir, activeView, activeTag, activeFolderId, selectedFolderIds, filters, hasActiveFilters,
  clearFilters, onFilterChange, reloadCurrentView, onFindSimilar, onSearch,
  setView, handleBatchUpdate
} = searchState"""

if use_app_search in content:
    content = content.replace(use_app_search, new_use_app_search)
else:
    print("Warning: use_app_search not found")

# 2. Update Toolbar props
toolbar_props = """        v-model:grid-show-extension="gridShowExtension"
        v-model:grid-show-subfolder="gridShowSubfolder"
        v-model:show-inspector="showInspector"
        v-model:filter-bar-open="filterBarOpen"
        v-model:search-text="searchText"
        :themes="THEMES"
        :accent-colors="ACCENT_COLORS"
        :current-theme="currentTheme"
        :current-accent="currentAccent"
        :current-translucency="currentTranslucency"
        @toggle-panels="togglePanels"
        @zoom-in="zoom = Math.min(10, zoom + 1)"
        @zoom-out="zoom = Math.max(1, zoom - 1)"
        @empty-trash="onEmptyTrash"
        @select-theme="t => applyTheme(t, true)"
        @preview-theme="t => applyTheme(t, false)"
        @clear-preview="applyTheme(currentTheme, false)"
        @select-accent="c => applyAccent(c, true)"
        @select-translucency="v => applyTranslucency(v, true)"
      />"""

new_toolbar_props = """        v-model:grid-show-extension="gridShowExtension"
        v-model:grid-show-subfolder="gridShowSubfolder"
        v-model:show-inspector="showInspector"
        v-model:filter-bar-open="filterBarOpen"
        v-model:search-text="searchText"
        v-model:itemSortBy="itemSortBy"
        v-model:itemSortDir="itemSortDir"
        :themes="THEMES"
        :accent-colors="ACCENT_COLORS"
        :current-theme="currentTheme"
        :current-accent="currentAccent"
        :current-translucency="currentTranslucency"
        @toggle-panels="togglePanels"
        @zoom-in="zoom = Math.min(10, zoom + 1)"
        @zoom-out="zoom = Math.max(1, zoom - 1)"
        @empty-trash="onEmptyTrash"
        @select-theme="t => applyTheme(t, true)"
        @preview-theme="t => applyTheme(t, false)"
        @clear-preview="applyTheme(currentTheme, false)"
        @select-accent="c => applyAccent(c, true)"
        @select-translucency="v => applyTranslucency(v, true)"
      />"""

if toolbar_props in content:
    content = content.replace(toolbar_props, new_toolbar_props)
else:
    print("Warning: toolbar_props not found")

with open('src/renderer/src/App.vue', 'w') as f:
    f.write(content)
