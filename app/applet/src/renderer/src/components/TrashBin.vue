<template>
  <div class="trash-bin">
    <div class="header">
      <h2>Trash ({{ trashItems.length }} items)</h2>
      <button 
        @click="handleEmptyTrash" 
        :disabled="trashItems.length === 0"
        class="empty-btn"
      >
        Empty Trash
      </button>
    </div>

    <div v-if="isLoading" class="loading">Loading...</div>
    
    <div v-else-if="trashItems.length === 0" class="empty-state">
      Trash is empty
    </div>

    <div v-else class="grid">
      <div v-for="item in trashItems" :key="item.id" class="grid-item">
        <div class="item-info">
          <span class="name">{{ item.name }}</span>
          <span class="date">Deleted: {{ new Date(item.deletedAt || 0).toLocaleDateString() }}</span>
        </div>
        <div class="actions">
          <button @click="restoreFromTrash(item.id)" class="restore-btn">Restore</button>
          <button @click="permanentlyDelete(item.id)" class="delete-btn">Delete Permanently</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useLibrary } from '../composables/useLibrary';

const { trashItems, isLoading, fetchItems, restoreFromTrash, permanentlyDelete, emptyTrash } = useLibrary();

onMounted(() => {
  fetchItems();
});

const handleEmptyTrash = async () => {
  if (confirm('Are you sure you want to permanently delete all items in the trash? This cannot be undone.')) {
    await emptyTrash();
  }
};
</script>

<style scoped>
.trash-bin {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.empty-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.empty-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.grid-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item-info {
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: bold;
  word-break: break-all;
}
.date {
  font-size: 0.85em;
  color: #666;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
.restore-btn {
  flex: 1;
  background-color: #28a745;
  color: white;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
}
.delete-btn {
  flex: 1;
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
}
.empty-state {
  text-align: center;
  color: #666;
  padding: 40px;
}
</style>
