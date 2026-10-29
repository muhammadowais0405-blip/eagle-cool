import { ref } from 'vue';
import type { MediaItem } from '../../../main/types';

export function useLibrary() {
  const items = ref<MediaItem[]>([]);
  const trashItems = ref<MediaItem[]>([]);
  const isLoading = ref(false);

  const fetchItems = async () => {
    isLoading.value = true;
    try {
      // Fetch normal items
      items.value = await window.api.invoke('library:getItems', false);
      // Fetch deleted items
      trashItems.value = await window.api.invoke('library:getItems', true);
    } catch (e) {
      console.error('Failed to fetch items', e);
    } finally {
      isLoading.value = false;
    }
  };

  const moveToTrash = async (id: string) => {
    await window.api.invoke('library:moveToTrash', id);
    await fetchItems();
  };

  const restoreFromTrash = async (id: string) => {
    await window.api.invoke('library:restoreFromTrash', id);
    await fetchItems();
  };

  const permanentlyDelete = async (id: string) => {
    await window.api.invoke('library:permanentlyDelete', id);
    await fetchItems();
  };

  const emptyTrash = async () => {
    await window.api.invoke('library:emptyTrash');
    await fetchItems();
  };

  return {
    items,
    trashItems,
    isLoading,
    fetchItems,
    moveToTrash,
    restoreFromTrash,
    permanentlyDelete,
    emptyTrash
  };
}
