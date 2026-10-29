# Move Folder Feature — Implementation Plan

## 🎯 Goal
Replace the placeholder `"Move Folder feature coming soon!"` toast in the right-click context menu with a **fully functional submenu tree** that lets users move any folder to:
- 📁 Root (top level)
- 📁 Any other folder (as a child)

With **confirmation modal** to prevent accidental moves.

---

## 📁 Files to Modify

1. **`src/renderer/src/App.vue`** — Main implementation
2. **`src/renderer/src/components/ConfirmDialog.vue`** — Already exists, just reuse it

No new files needed. No new components needed.

---

## 🏗️ Implementation Steps

### Step 1: Add `isDescendantOrSelf` helper
- **Why:** Prevent moving a folder into itself or its own descendants (circular move)
- **Location:** Top of `<script setup>` in App.vue (near other utility functions)
- **Logic:** Walk up the parent chain; return true if candidate is the ancestor or any of its descendants

### Step 2: Add `movableFolders` computed
- **Why:** Generate the submenu's folder list (excluding source + descendants)
- **Logic:** Filter `folders.value` → exclude `isDescendantOrSelf(folder.id, ctxFolder.id)` results

### Step 3: Add `folderDepth` helper
- **Why:** Render folder tree with indentation (visual hierarchy)
- **Logic:** Walk up parents, count depth, return number

### Step 4: Add `ctxMoveTo()` function
- **Why:** The actual move logic
- **Behavior:**
  1. Closes context menu
  2. Validates: prevent moving into self/descendants
  3. Validates: prevent moving to same current parent
  4. **Opens confirmation modal** ("Move 'X' to 'Y'?")
  5. On confirm: calls `library.updateFolder(f.id, { parentId, sortIndex })`
  6. Calls `handleBatchUpdate()` to refresh counts
  7. Toast success: "Moved 'X' to 'Y'"

### Step 5: Replace the `ctxMoveFolder` button with a submenu
- Convert single button to `ctx-item--has-sub` with submenu
- Submenu items:
  - **"📁 Move to Root"** (top option, with separator below)
  - List of all valid destination folders, indented by depth
- Each folder item shows the folder icon + name (or color if set)

### Step 6: Add CSS for the move submenu
- `.ctx-move-submenu` — max-height: 300px, overflow-y: auto, min-width: 220px
- `.ctx-item--folder` — text-align: left, padding-left scaled by depth
- Indent using `padding-left: calc(8px + var(--depth) * 12px)` (or simple em-dash prefix)

### Step 7: Add confirmation modal integration
- Reuse existing `confirmDialog` ref pattern already in App.vue (line 619+)
- Use `openConfirmDialog()` helper
- Action label: "Move"
- Action class: "cd-confirm--blue"
- onConfirm: `await library.updateFolder(...)` + reload

---

## 🛡️ Edge Cases Handled

| Case | Behavior |
|------|----------|
| Moving root to root | Toast: "Already at root" |
| Moving folder into itself | Blocked + error toast |
| Moving folder into its descendant | Blocked + error toast |
| No folders available (only root) | Only "Move to Root" option shown |
| Folders with 0 items in target | Works fine, just appends |
| User cancels confirmation | Nothing happens |

---

## 🎨 Visual Design

```
┌─────────────────────────┐
│ 📁 New Folder        N  │
│ 📁 New Subfolder     S  │
│ ↔ Move Folder    M  ▶  │  ← click "Move Folder"
└─────────────────────────┘     ┌─────────────────────────┐
                                │ 📁 Move to Root         │  ← parentId = null
                                │ ─────────────────────── │
                                │ 📁 Work                  │
                                │   📁 Projects            │
                                │     📁 Old Stuff         │
                                │   📁 Archive             │
                                │ 📁 Personal              │
                                └─────────────────────────┘
```

After click → confirmation modal:
```
┌─────────────────────────────┐
│ Move Folder                 │
│                             │
│ Move "Old Stuff" into       │
│ "Projects"?                │
│                             │
│           [Cancel]  [Move]  │
└─────────────────────────────┘
```

---

## ⏱️ Estimated Time: 30–45 minutes

| Step | Time |
|------|------|
| 1. Helper functions | 5 min |
| 2. `movableFolders` computed | 5 min |
| 3. `ctxMoveTo` + confirmation | 10 min |
| 4. Submenu template | 10 min |
| 5. CSS | 5 min |
| 6. Test & polish | 5–10 min |

---

## ✅ Testing Checklist

- [ ] Right-click any folder → "Move Folder" submenu opens
- [ ] Submenu shows "Move to Root" + all valid folders
- [ ] Source folder and its descendants are NOT in the list
- [ ] Folders are indented by depth
- [ ] Confirmation modal appears with correct folder names
- [ ] Cancel does nothing
- [ ] Confirm moves the folder
- [ ] Sidebar reflects the move immediately
- [ ] Folder counts in sidebar update
- [ ] No regression to existing context menu items
- [ ] Drag-and-drop still works (not affected)

---

## 🔄 Why This Approach

- **No new dependencies** — uses existing `confirmDialog` ref
- **Reuses patterns** — submenu matches your existing Color/Icon/Sort submenus
- **Safe by design** — confirmation + circular-move prevention
- **Fast UX** — 3 clicks max (right-click → Move → destination)
- **Discoverable** — visual tree shows folder hierarchy
- **Keyboard-friendly** — submenu can be navigated with arrow keys (optional, free with native `<button>` elements)
