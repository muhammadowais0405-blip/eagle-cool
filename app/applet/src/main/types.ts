export interface MediaItem {
  id: string;
  name: string;
  ext: string;
  tags: string[];
  notes?: string;
  dimensions?: { width: number; height: number };
  duration?: number; // For videos
  addedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface LibraryManifest {
  name: string;
  folders: any[];
  tags: string[];
  settings: any;
}

export interface IndexStoreData {
  items: MediaItem[];
}
