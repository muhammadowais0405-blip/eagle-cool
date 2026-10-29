# Virtualization Refactor Plan — Option A
## Extending Custom `VirtualGrid` Engine to All Layouts

---

## 🎯 Goal
Refactor the custom `VirtualGrid` engine (`src/renderer/src/VirtualGrid.ts`) to support all four gallery layouts:
- ✅ `grid` (already done)
- 🆕 `justified`
- 🆕 `list`
- 🆕 `waterfall`

**Outcome:** All layouts handle 10,000+ items smoothly with consistent hover/preview/drag/select behavior.

---

## 📋 Pre-Work Checklist

- [ ] **Identify source-of-truth `Gallery.vue`**
  - Files: `Gallery.vue`, `Gallery - claude wala jitna changes kaya hain.vue`, `Gallery - Gemini wala.vue`
  - Action: Search for import/usage to find the active one. Edit only that file.

- [ ] **Backup current state**
  - Action: `git commit` or create backup branch before starting

- [ ] **Read remaining composables** for context
  - `useLibrary.ts`, `useAppSearch.ts`, `useAppShortcuts.ts`
  - Understand how `items`, `selectedIds`, `thumbCache` flow into Gallery

---

## 🏗️ Phase 1: Engine Refactor (Foundation)
**File:** `src/renderer/src/VirtualGrid.ts`
**Estimated time:** 1 hour

### 1.1 Add Layout Mode Support
```typescript
export type LayoutMode = 'grid' | 'justified' | 'list' | 'waterfall';

export interface VirtualGridOptions {
  layout: LayoutMode;        // 🆕 NEW
  rowHeight: number;
  gap: number;
  columns: number | 'auto';
  minColWidth: number;
  overscan: number;
  showName: boolean;
  showRes: boolean;
  showExt: boolean;
  itemInfoType: 'dimensions' | 'size' | 'type';
}
```

### 1.2 Refactor Layout Calculation
Create separate methods for each layout:
- `private updateGridLayout()` — current logic (fixed col count, fixed row height)
- `private updateJustifiedLayout()` — row-based, variable column widths
- `private updateListLayout()` — single column, fixed height, horizontal cells
- `private updateWaterfallLayout()` — column-balancing algorithm

### 1.3 Refactor Card Positioning
Current: `positionCard(cardEl, idx)` assumes grid math.
New: Switch based on `this.opts.layout`:
- `grid` → `translate(col * (colW + gap), row * (rowH + gap))`
- `justified` → use pre-computed `row` data
- `list` → `translate(0, idx * (rowH + gap))`, full width
- `waterfall` → use pre-computed column placement

### 1.4 Refactor Card Sizing
- `grid`: `width: colWidth, height: rowHeight`
- `justified`: `width: jItem.width, height: jItem.height`
- `list`: `width: 100%, height: rowHeight` (with horizontal grid inside)
- `waterfall`: `width: colWidth, height: itemHeight` (from aspect ratio)

### 1.5 Add Item Height Cache
```typescript
private itemHeights: Map<number, number> = new Map();
private getItemHeight(idx: number, item: IndexEntry): number {
  // For waterfall: compute from item.width / item.height
  // For others: return rowHeight
}
```

### 1.6 Update `updateInnerHeight()` for Variable Heights
Sum actual item heights + gaps instead of `rowCount * (rowHeight + gap)`.

---

## 🎨 Phase 2: Migrate `justified` Layout
**File:** `src/renderer/src/components/Gallery.vue`
**Estimated time:** 1 hour

### 2.1 Pre-compute Justified Rows
Move `justifiedRows` logic into the engine:
```typescript
private computeJustifiedRows(): { item: IndexEntry; x: number; y: number; width: number; height: number }[] {
  // Same algorithm as current Gallery.vue, but returns absolute positions
}
```

### 2.2 Wire Up in Gallery.vue
Replace the `v-for="(row, ri) in justifiedRows"` block with:
```vue
<div v-show="items.length && activeLayout === 'justified'" 
     class="vg-wrapper" ref="justifiedContainer"></div>
```

### 2.3 Test
- Zoom in/out → rows reflow correctly
- Scroll → only visible rows render
- Hover/select/preview work

---

## 📋 Phase 3: Migrate `list` Layout
**File:** `src/renderer/src/components/Gallery.vue`
**Estimated time:** 1 hour

### 3.1 List Card Structure
Current list card has horizontal columns: thumb | name | size | format | date.
New approach: card pool renders the **same card** but with list-mode CSS class that applies grid layout.

### 3.2 Add List-Specific Stamp Method
```typescript
private stampListCard(cardEl: HTMLElement, item: IndexEntry): void {
  // Set: thumb (small, 40x40), name, size, format, date
}
```

### 3.3 Wire Up in Gallery.vue
Replace list `v-for` with:
```vue
<div v-show="items.length && activeLayout === 'list'" 
     class="vg-wrapper vg-list-mode" ref="listContainer"></div>
```

### 3.4 Add List Header
The list header (column labels) stays as static HTML above the virtualized container.

### 3.5 Test
- Header alignment matches card columns
- Scroll → only visible rows render
- Selection/highlight works

---

## 🏞️ Phase 4: Migrate `waterfall` Layout
**File:** `src/renderer/src/components/Gallery.vue`
**Estimated time:** 2 hours (most complex)

### 4.1 Column-Balancing Algorithm
```typescript
private computeWaterfallLayout(): { item: IndexEntry; col: number; x: number; y: number; width: number; height: number }[] {
  const colCount = this.computeColCount();
  const colWidth = this.computeColWidth(colCount);
  const colHeights = new Array(colCount).fill(0);
  const placements: any[] = [];
  
  for (let idx = 0; idx < this.items.length; idx++) {
    const item = this.items[idx];
    const aspectRatio = item.width && item.height ? item.width / item.height : 4 / 3;
    const cardHeight = (colWidth / aspectRatio) + 44; // +44 for footer if shown
    
    // Find shortest column
    const shortestCol = colHeights.indexOf(Math.min(...colHeights));
    const x = shortestCol * (colWidth + this.opts.gap);
    const y = colHeights[shortestCol];
    
    placements.push({ item, col: shortestCol, x, y, width: colWidth, height: cardHeight });
    colHeights[shortestCol] += cardHeight + this.opts.gap;
  }
  
  this.totalHeight = Math.max(...colHeights);
  return placements;
}
```

### 4.2 Handle Aspect Ratio Edge Cases
- Missing `width`/`height` → use 4:3 default
- Very wide images → cap height (e.g., max 2x column width)
- Very tall images → cap height (e.g., min 0.5x column width)

### 4.3 Wire Up in Gallery.vue
Replace waterfall `v-for` with:
```vue
<div v-show="items.length && activeLayout === 'waterfall'" 
     class="vg-wrapper vg-waterfall-mode" ref="waterfallContainer"></div>
```

### 4.4 Test
- Variable heights render correctly
- Shortest-column-first placement works
- Zoom in/out → columns reflow
- Scroll → only visible cards render

---

## ✅ Phase 5: Polish & Testing
**Estimated time:** 1 hour

### 5.1 Remove Old Vue `computed` Layouts
Delete `justifiedRows` and `waterfallColumns` computed properties from Gallery.vue (they're now in the engine).

### 5.2 Add Layout-Specific CSS
```css
.vg-list-mode .vg-card {
  display: grid;
  grid-template-columns: 40px 1fr 100px 80px 120px;
  gap: 16px;
  align-items: center;
  padding: 8px 16px;
}
.vg-waterfall-mode .vg-card {
  /* Uses absolute positioning from engine */
}
```

### 5.3 Lasso Selection Compatibility
Update `onGalleryMouseDown` and `updateLassoSelection` to query `.vg-card` (already does this — ✅ no change needed).

### 5.4 Thumbnail Fetching
Verify `need-thumbs` event fires for all layouts. May need to adjust card selectors.

### 5.5 Performance Test
- Import a library with 5,000+ items
- Switch between all four layouts
- Measure: initial render, scroll FPS, memory usage
- Target: 60fps scroll, <500ms initial render

### 5.6 Edge Cases
- Empty library → empty state still shows
- Loading state → progress bar still works
- Resize window → columns reflow
- Zoom slider → all layouts respond

---

## 🚨 Risk Mitigation

### Incremental Commits
Commit after each phase:
```bash
git commit -m "Phase 1: Add layout mode support to VirtualGrid engine"
git commit -m "Phase 2: Migrate justified layout to VirtualGrid"
git commit -m "Phase 3: Migrate list layout to VirtualGrid"
git commit -m "Phase 4: Migrate waterfall layout to VirtualGrid"
git commit -m "Phase 5: Polish and test all layouts"
```

### Fallback Strategy
Keep old `v-for` code **commented out** until new engine is verified for each layout. If issues arise, uncomment to revert.

### Testing Checklist (per phase)
- [ ] Layout renders correctly
- [ ] Hover-to-play video works
- [ ] Quick preview popover works
- [ ] Mute toggle works
- [ ] Drag & drop works
- [ ] Selection (single/multi/range) works
- [ ] Lasso selection works
- [ ] Thumbnail lazy-loading works
- [ ] Zoom slider works
- [ ] Resize window works
- [ ] Empty state shows correctly
- [ ] No console errors

---

## 📊 Success Metrics

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Grid layout (10k items) | <1s render, 60fps | <1s render, 60fps (same) |
| Justified layout (10k items) | ~3-5s render, 20-30fps | <1s render, 60fps |
| List layout (10k items) | ~2-3s render, 30-40fps | <500ms render, 60fps |
| Waterfall layout (10k items) | ~3-5s render, 20-30fps | <1s render, 60fps |
| Memory usage (10k items) | ~200-300MB | ~50-80MB |
| Bundle size | No change | No change |

---

## 🎬 Implementation Order

1. **Phase 1** — Refactor engine (foundation)
2. **Phase 2** — Justified (easiest migration)
3. **Phase 3** — List (medium complexity)
4. **Phase 4** — Waterfall (hardest, do last)
5. **Phase 5** — Polish & test

**Total estimated time:** 6 hours

---

## 📝 Notes

- All three `Gallery.vue` copies should be left as-is. I'll edit only the source-of-truth one.
- The `VirtualGrid` engine is already framework-agnostic, so no changes to its public API are needed.
- Existing features (hover, preview, mute, drag, lasso) work out-of-the-box once items are in the card pool.

---

## ❓ Open Questions

1. **Which `Gallery.vue` is the source of truth?** (Need to check imports)
2. **Should the other two copies be deleted, or kept as reference?**
3. **Is there a preferred order for the four layouts in the layout switcher?**
4. **Any specific performance targets beyond 60fps?** (e.g., startup time, memory cap)

---

## 🚀 Ready to Start?

If you're happy with this plan, I'll:
1. First, identify which `Gallery.vue` is the active one
2. Then start with Phase 1 (engine refactor)
3. Commit incrementally as described

Let me know if you'd like to adjust anything, or if I should proceed! 🎯
