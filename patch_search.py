import re

with open('src/renderer/src/composables/useAppSearch.ts', 'r') as f:
    content = f.read()

# Replace the sorting logic in buildQuery
old_sort_logic = """      if (activeFolderId.value) {
        const sort = folderSortMap.value[activeFolderId.value]
        if (sort) {
          if (sort === 'name' || sort === 'size' || sort === 'type') {
            q.sortBy = sort
            if (sort === 'name' || sort === 'type') q.sortDir = 'asc'
          } else if (sort === 'date') {
            q.sortBy = 'importTime'
            q.sortDir = 'desc'
          }
        }
      }"""

new_sort_logic = """      if (activeFolderId.value) {
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

if old_sort_logic in content:
    content = content.replace(old_sort_logic, new_sort_logic)
else:
    print("Warning: old_sort_logic not found")

# Add to the root query build logic
add_sort_logic = """    if (activeTag.value) q.tags = [activeTag.value]"""
new_add_sort_logic = """    if (!q.sortBy) {
      q.sortBy = itemSortBy.value === 'date' ? 'importTime' : itemSortBy.value
      q.sortDir = itemSortDir.value
    }
    if (activeTag.value) q.tags = [activeTag.value]"""

if add_sort_logic in content:
    content = content.replace(add_sort_logic, new_add_sort_logic)
else:
    print("Warning: add_sort_logic not found")

# Add to returned object
ret_logic = """    searchText,
    activeView,"""
new_ret_logic = """    searchText,
    itemSortBy,
    itemSortDir,
    activeView,"""
if ret_logic in content:
    content = content.replace(ret_logic, new_ret_logic)
else:
    print("Warning: ret_logic not found")


with open('src/renderer/src/composables/useAppSearch.ts', 'w') as f:
    f.write(content)
