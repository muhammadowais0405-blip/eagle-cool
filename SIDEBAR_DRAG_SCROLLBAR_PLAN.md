# Sidebar Drag-Fix & Scrollbar Improvement Plan

## 🎯 Goals
1. **Fix drag-and-order** in the sidebar — currently two drag systems (vuedraggable + native HTML5) conflict, breaking reparenting
2. **Better scrollbar** — replace the default thin system scrollbar with a sleek auto-hide-on-inactivity scrollbar

---

## 🐛 Root Cause Analysis

### Drag Issue
- `vuedraggable` (line 141 in `Sidebar.vue`) wraps folder items
- Folder `<button>` elements also have `draggable="true"` + native `@dragstart`/`@drop` handlers (lines 175-180)
- **Both systems fight** — SortableJS wins, but the native `drop` event in App.vue never fires
- Result: Reorder works (sortIndex updates), but **reparenting is broken**

### Scrollbar Issue
- `.sidebar-scroll-area` uses `overflow-y: auto` with default browser scrollbar
- On Windows, default scrollbar is ~17px wide and uses low-contrast colors
- No hover effect, no auto-hide — feels clunky in a dark theme

---

## 📁 Files to Modify

1. **`src/renderer/src/components/Sidebar.vue`** — Fix drag, add scrollbar styles
2. **`src/renderer/src/composables/useAppFolders.ts`** — Add expanded folder helper
3. **`src/renderer/src/App.vue`** — Update `onSidebarFolderDrop` to be cross-list-compatible (or remove redundant native handlers)

---

## 🏗️ Implementation Plan

### Step 1: Resolve Native vs vuedraggable Conflict
**Why:** vuedraggable uses SortableJS internally which already handles drag. Adding `draggable="true"` + native handlers causes conflicts.

**Action in `Sidebar.vue`:**
- Remove `draggable="true"` attribute
- Remove `@dragstart="emit('folder-dragstart', ...)"` 
- Remove `@dragenter.prevent="emit('folder-dragenter', ...)"`
- Remove `@dragleave.prevent="emit('folder-dragleave', ...)"`
- Remove `@dragover.prevent="handleDragOver(...)"`
- Remove `@drop.prevent="handleDrop(...)"`
- Keep ONLY: `@click`, `@dblclick`, `@contextmenu`, `@click.stop` on toggle

**Why we can drop native handlers:** The folder move feature (Move to subfolder) is now done through the right-click "Move Folder" submenu (already implemented). So we no longer need native drag for cross-level moves — vuedraggable will handle them too if we configure it.

### Step 2: Configure vuedraggable for Cross-List Dragging
**Goal:** Allow folders to be dragged from one parent to another within the same draggable list.

**vuedraggable supports nested groups via:**
```html
<draggable
  :list="derivedFolders"
  :group="{ name: 'folders', pull: true, put: true }"
  item-key="id"
  @end="onFolderDragEnd"
>
```

This makes all folder items in a single draggable group — moving one into another's "area" will visually place it at that position in the list. The parent will be inferred from the new index.

**Note:** Since `derivedFolders` is a flat list with `depth` info (already computed in `useAppFolders.ts`), when a folder is dropped at a new index, we can determine the new parent by looking at the folders around it (siblings above/below with matching depth).

### Step 3: Detect Reparenting in `onFolderDragEnd`
**Logic:**
1. Capture the dragged folder's `parentId` before drop
2. After drop, look at the new position:
   - Find the folder above and below at the **same depth** as the dragged folder
   - Those become the new siblings
   - The new parent is the parent of those siblings
3. If the parent changed, set `parentId`; otherwise just update `sortIndex`
4. If dropping on a collapsed folder, expand it and re-drop inside (auto-expand)

**Pseudo-code:**
```typescript
function onFolderDragEnd(evt) {
  const draggedId = evt.item.__draggable_context?.element?.id
  if (!draggedId) return
  
  const dragged = folders.value.find(f => f.id === draggedId)
  if (!dragged) return
  
  const newIndex = evt.newIndex
  const list = derivedFolders.value
  const itemAtNewIndex = list[newIndex]
  if (!itemAtNewIndex) return
  
  // Detect new parent by looking at nearest neighbor with same depth
  const newParentId = findParentIdForNewPosition(dragged, newIndex, list)
  const newDepth = newParentId ? depthOf(newParentId) + 1 : 0
  
  // Compute new sortIndex (between prev and next same-level siblings)
  const newSortIndex = computeSortIndexAt(newIndex, newParentId, list)
  
  const updates = { sortIndex: newSortIndex }
  if (newParentId !== dragged.parentId) {
    updates.parentId = newParentId
    if (newParentId) expandedFolders.value.add(newParentId)
  }
  
  await updateFolder(draggedId, updates)
}

function findParentIdForNewPosition(dragged, newIndex, list) {
  // Look backwards for the first folder with depth ≤ dragged.depth - 1
  // That's the "parent" we're now under
  for (let i = newIndex - 1; i >= 0; i--) {
    if (list[i].depth < dragged.depth) {
      return list[i].id  // child of this folder
    }
  }
  return null  // root level
}
```

### Step 4: Handle Drop on Collapsed Folder (Auto-Expand)
**UX:** If user drops a folder onto a collapsed folder, automatically:
1. Expand the target folder
2. Place the dragged folder as the first child

**Implementation:** Add `onFolderDragOver` to vuedraggable to detect hovering over a folder. If hovering over a collapsed folder, expand it after a 500ms delay.

### Step 5: Update Active Folder State
**If the user moves the currently-active folder** (the one they're viewing items for), update `activeFolderId` to follow it, OR clear it (re-load root view).

**If the user moves a folder's parent** and the user was viewing that folder, refresh the current view.

### Step 6: Custom Scrollbar Styling
**File:** `Sidebar.vue` styles section (around line 542)

**Goal:** Thin (6px) scrollbar that:
- Almost invisible by default
- Brightens on hover
- Smooth transitions
- Works in Firefox, Chrome, Edge, Safari

**CSS:**
```css
.sidebar-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.2s ease;
}
.sidebar-scroll-area:hover {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}
/* WebKit/Blink */
.sidebar-scroll-area::-webkit-scrollbar {
  width: 6px;
}
.sidebar-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  transition: background 0.2s ease;
}
.sidebar-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
.sidebar-scroll-area::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.55);
}
```

### Step 7: Add `updateFolder` + `moveFolder` API Helper (Optional)
If needed, add a `moveFolder(id, newParentId, newSortIndex)` helper to `useAppFolders.ts` that:
- Validates the move (no circular moves)
- Updates the folder
- Returns success/error

This could be reused by both the menu "Move" feature and the drag-and-drop.

---

## 🛡️ Edge Cases

| Case | Behavior |
|------|----------|
| Drag folder onto itself | Blocked via SortableJS `filter` option |
| Drag parent into its own child | Blocked — would create a cycle |
| Drag folder to root | `parentId` set to `null`, sortIndex = next available |
| Drop on collapsed folder | Auto-expand after 500ms |
| Drop at top of list | New sortIndex = prev.sibling.sortIndex - 100 |
| Drop at bottom of list | New sortIndex = last.sibling.sortIndex + 100 |
| Move currently-active folder | Re-load view to show new location's items |
| Cross-tab synchronization | (If applicable) — broadcast change via `libraryPath` watcher |

---

## 🧪 Testing Checklist

- [ ] Drag folder up/down within same level → reorders correctly
- [ ] Drag folder into a sub-folder → reparented
- [ ] Drag sub-folder out to root → moved to top level
- [ ] Drag folder onto collapsed folder → auto-expands
- [ ] SortIndex is reasonable (no huge gaps)
- [ ] Drop on a folder that would create cycle → blocked
- [ ] Scrollbar appears on hover, fades when not hovering
- [ ] Scrollbar is grabbable (not too thin)
- [ ] No regression to right-click "Move Folder" submenu
- [ ] No regression to file drag-and-drop into folders

---

## ⏱️ Estimated Time: 1.5–2 hours

| Step | Time |
|------|------|
| 1. Remove native drag attrs | 10 min |
| 2. Configure vuedraggable group | 5 min |
| 3. Reparent detection logic | 30 min |
| 4. Auto-expand on hover | 20 min |
| 5. Update active folder state | 10 min |
| 6. Custom scrollbar CSS | 15 min |
| 7. (Optional) moveFolder helper | 15 min |
| Testing & polish | 15 min |

---

## 🔄 Why This Approach

- **Single drag system** — eliminates conflicts
- **Cross-list drag** — leverages SortableJS's proven cross-list drag implementation
- **Auto-expand** — intuitive nested folder reorganization
- **Modern scrollbar** — matches VSCode, Discord, macOS Finder aesthetic
- **No breaking changes** — right-click "Move Folder" still works
- **Reuses existing logic** — `sortIndex` calc, `expandedFolders` state, `updateFolder` API
