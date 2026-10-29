import re

with open('src/renderer/src/components/Toolbar.vue', 'r') as f:
    content = f.read()

# Add sort menu before zoom-ctrl
zoom_ctrl = """        <div class="zoom-ctrl">"""
sort_menu = """        <div class="layout-menu-wrap" ref="sortMenuRef" style="position:relative;">
          <button class="tb-btn tb-btn--sort" :class="{ active: sortMenuOpen }" @click="sortMenuOpen = !sortMenuOpen" title="Sort Options">
            <svg viewBox="0 0 16 16" fill="currentColor" stroke="none" style="width:14px;height:14px;"><path d="M12.5 13.5v-11h-1v11l-2-2-.707.707 3.207 3.207 3.207-3.207-.707-.707-2 2zM3.5 2.5v11h1v-11l2 2 .707-.707-3.207-3.207-3.207 3.207.707.707 2-2z"/></svg>
          </button>
          <div v-if="sortMenuOpen" class="layout-popover" style="width: 200px;">
            <div class="tp-section-label" style="padding-top: 2px;">Sort By</div>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">Date Added</span>
              <div class="lp-actions">
                <input type="radio" name="sort-by" value="date" :checked="itemSortBy === 'date'" @change="$emit('update:itemSortBy', 'date')" />
              </div>
            </label>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">Name</span>
              <div class="lp-actions">
                <input type="radio" name="sort-by" value="name" :checked="itemSortBy === 'name'" @change="$emit('update:itemSortBy', 'name')" />
              </div>
            </label>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">File Size</span>
              <div class="lp-actions">
                <input type="radio" name="sort-by" value="size" :checked="itemSortBy === 'size'" @change="$emit('update:itemSortBy', 'size')" />
              </div>
            </label>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">File Type</span>
              <div class="lp-actions">
                <input type="radio" name="sort-by" value="type" :checked="itemSortBy === 'type'" @change="$emit('update:itemSortBy', 'type')" />
              </div>
            </label>
            <div class="lp-divider"></div>
            <div class="tp-section-label">Order</div>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">Ascending</span>
              <div class="lp-actions">
                <input type="radio" name="sort-dir" value="asc" :checked="itemSortDir === 'asc'" @change="$emit('update:itemSortDir', 'asc')" />
              </div>
            </label>
            <label class="lp-row lp-tappable" style="padding: 4px 16px;">
              <span class="lp-label">Descending</span>
              <div class="lp-actions">
                <input type="radio" name="sort-dir" value="desc" :checked="itemSortDir === 'desc'" @change="$emit('update:itemSortDir', 'desc')" />
              </div>
            </label>
          </div>
        </div>
        <div class="tb-sep"></div>
        <div class="zoom-ctrl">"""

if zoom_ctrl in content:
    content = content.replace(zoom_ctrl, sort_menu)
else:
    print("Warning: zoom_ctrl not found")

# Add props
props = """  searchText: string
  THEMES: any[]"""
new_props = """  searchText: string
  itemSortBy: string
  itemSortDir: string
  THEMES: any[]"""

if props in content:
    content = content.replace(props, new_props)
else:
    print("Warning: props not found")

# Add emits
emits = """  'update:searchText',
  'toggle-panels',"""
new_emits = """  'update:searchText',
  'update:itemSortBy',
  'update:itemSortDir',
  'toggle-panels',"""

if emits in content:
    content = content.replace(emits, new_emits)
else:
    print("Warning: emits not found")

# Add refs
refs = """const layoutMenuOpen = ref(false)
const layoutMenuRef = ref<HTMLElement>()"""
new_refs = """const sortMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement>()
const layoutMenuOpen = ref(false)
const layoutMenuRef = ref<HTMLElement>()"""

if refs in content:
    content = content.replace(refs, new_refs)
else:
    print("Warning: refs not found")

# Add click outside listener
click_outside = """  if (layoutMenuOpen.value && layoutMenuRef.value && !layoutMenuRef.value.contains(e.target as Node)) {
    layoutMenuOpen.value = false
  }
}"""
new_click_outside = """  if (layoutMenuOpen.value && layoutMenuRef.value && !layoutMenuRef.value.contains(e.target as Node)) {
    layoutMenuOpen.value = false
  }
  if (sortMenuOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortMenuOpen.value = false
  }
}"""

if click_outside in content:
    content = content.replace(click_outside, new_click_outside)
else:
    print("Warning: click_outside not found")

with open('src/renderer/src/components/Toolbar.vue', 'w') as f:
    f.write(content)
