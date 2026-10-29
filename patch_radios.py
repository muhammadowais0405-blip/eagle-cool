import re

with open('src/renderer/src/components/Toolbar.vue', 'r') as f:
    content = f.read()

old_sort_menu = """          <div v-if="sortMenuOpen" class="layout-popover" style="width: 200px;">
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
          </div>"""

new_sort_menu = """          <div v-if="sortMenuOpen" class="layout-popover" style="width: 200px;">
            <div class="tp-section-label" style="padding-top: 2px;">Sort By</div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'date')">
              <span class="lp-label" :style="{ color: itemSortBy === 'date' ? 'var(--text-1)' : 'var(--text-2)' }">Date Added</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'date'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'name')">
              <span class="lp-label" :style="{ color: itemSortBy === 'name' ? 'var(--text-1)' : 'var(--text-2)' }">Name</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'name'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'size')">
              <span class="lp-label" :style="{ color: itemSortBy === 'size' ? 'var(--text-1)' : 'var(--text-2)' }">File Size</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'size'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortBy', 'type')">
              <span class="lp-label" :style="{ color: itemSortBy === 'type' ? 'var(--text-1)' : 'var(--text-2)' }">File Type</span>
              <div class="lp-actions">
                <svg v-if="itemSortBy === 'type'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-divider"></div>
            <div class="tp-section-label">Order</div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortDir', 'asc')">
              <span class="lp-label" :style="{ color: itemSortDir === 'asc' ? 'var(--text-1)' : 'var(--text-2)' }">Ascending</span>
              <div class="lp-actions">
                <svg v-if="itemSortDir === 'asc'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
            <div class="lp-row lp-tappable" style="padding: 4px 16px;" @click="$emit('update:itemSortDir', 'desc')">
              <span class="lp-label" :style="{ color: itemSortDir === 'desc' ? 'var(--text-1)' : 'var(--text-2)' }">Descending</span>
              <div class="lp-actions">
                <svg v-if="itemSortDir === 'desc'" class="tp-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 6 11 12 3"/></svg>
              </div>
            </div>
          </div>"""

if old_sort_menu in content:
    content = content.replace(old_sort_menu, new_sort_menu)
    with open('src/renderer/src/components/Toolbar.vue', 'w') as f:
        f.write(content)
    print("Patched sort menu successfully")
else:
    print("Old sort menu not found")
