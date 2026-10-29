import re

with open('src/renderer/src/composables/useAppSearch.ts', 'r') as f:
    content = f.read()

old_logic = """      if (activeFolderId.value) {
        const sort = folderSortMap.value[activeFolderId.value]
        if (sort) {
          if (sort === 'name' || sort === 'size' || sort === 'type') {
            q.sortBy = sort
            if (sort === 'name' || sort === 'type') q.sortDir = 'asc'
          } else if (sort === 'date') {
            q.sortBy = 'importTime'
            q.sortDir = 'desc'
          }
        } else {
          q.sortBy = itemSortBy.value === 'date' ? 'importTime' : itemSortBy.value
          q.sortDir = itemSortDir.value
        }
      }"""

new_logic = """      if (activeFolderId.value) {
        // We use the global itemSortBy instead of folderSortMap (which is for subfolders)
        q.sortBy = itemSortBy.value === 'date' ? 'importTime' : itemSortBy.value
        q.sortDir = itemSortDir.value
      }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('src/renderer/src/composables/useAppSearch.ts', 'w') as f:
        f.write(content)
    print("Patched buildQuery logic successfully")
else:
    print("Logic not found in useAppSearch.ts")
