/**
 * VirtualGrid
 * ───────────
 * A framework-agnostic virtual scroll engine for the media gallery.
 * Supports four layout modes: grid, justified, list, waterfall.
 */

import type { IndexEntry } from './types';

class EventEmitter {
  private _listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(listener);
    return this;
  }
  off(event: string, listener: (...args: any[]) => void): this {
    const arr = this._listeners.get(event) ?? [];
    this._listeners.set(event, arr.filter(l => l !== listener));
    return this;
  }
  emit(event: string, ...args: any[]): void {
    (this._listeners.get(event) ?? []).forEach(l => l(...args));
  }
  removeAllListeners(event?: string): this {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }
}

export type LayoutMode = 'grid' | 'justified' | 'list' | 'waterfall';

export interface CardPlacement {
  item:   IndexEntry;
  idx:    number;
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface VirtualGridOptions {
  layout:         LayoutMode;
  rowHeight:      number;
  gap:            number;
  columns:        number | 'auto';
  minColWidth:    number;
  overscan:       number;
  showName:       boolean;
  showRes:        boolean;
  showExt:        boolean;
  itemInfoType:   'dimensions' | 'size' | 'type';
  targetRowHeight?: number;
  footerHeight?:  number;
  listThumbSize?: number;
  formatSize?:    (bytes: number) => string;
  formatDate?:    (ts: number) => string;
}

const DEFAULTS: VirtualGridOptions = {
  layout:          'grid',
  rowHeight:       200,
  gap:             12,
  columns:         'auto',
  minColWidth:     150,
  overscan:        3,
  showName:        true,
  showRes:         true,
  showExt:         true,
  itemInfoType:    'dimensions',
  targetRowHeight: 0,
  footerHeight:    44,
  listThumbSize:   40,
  formatSize:      undefined as any,
  formatDate:      undefined as any,
};

export class VirtualGrid extends EventEmitter {
  private container:    HTMLElement;
  private opts:         VirtualGridOptions;
  private items:        IndexEntry[] = [];
  private selectedIds:  Set<string> = new Set();
  private thumbCache:   Map<string, string> = new Map();

  private scrollEl:     HTMLElement;
  private innerEl:      HTMLElement;
  private poolEl:       HTMLElement;
  /** Reserved DOM element at the top of the scroll area where the component
   *  can <Teleport> its own banner content. The engine measures the slot's
   *  first child to compute the banner height. */
  private bannerSlotEl: HTMLElement;
  private bannerHeight: number = 0;
  private bannerResizeObs: ResizeObserver | null = null;


  private cardPool:     HTMLElement[] = [];
  private visibleCards: Map<number, HTMLElement> = new Map();


  private colCount:     number = 4;
  private colWidth:     number = 0;
  private totalHeight:  number = 0;

  private placements:   CardPlacement[] = [];

  private firstVisRow:  number = -1;
  private lastVisRow:   number = -1;
  private rafId:        number | null = null;
  private idleId:       number | null = null;
  private resizeObs:    ResizeObserver | null = null;

  constructor(container: HTMLElement, opts: Partial<VirtualGridOptions> = {}) {
    super();
    this.container = container;
    this.opts      = { ...DEFAULTS, ...opts };
    if (!this.opts.targetRowHeight) this.opts.targetRowHeight = this.opts.rowHeight;

    this.scrollEl     = this.createScrollEl();
    this.innerEl      = this.createInnerEl();
    this.poolEl       = this.createPoolEl();
    this.bannerSlotEl = this.createBannerSlotEl();

    // Order inside scrollEl: [bannerSlot, innerEl, poolEl]
    this.scrollEl.appendChild(this.bannerSlotEl)
    this.scrollEl.appendChild(this.innerEl)
    this.scrollEl.appendChild(this.poolEl)
    container.appendChild(this.scrollEl);

    this.attachListeners();
    this.updateLayout();
  }


  // ─── Public API ───────────────────────────────────────────────────────────

  setItems(items: IndexEntry[]): void {
    this.items = items;
    this.updateLayout();

    for (const [idx, cardEl] of this.visibleCards) {
      cardEl.style.display = 'none';
      this.cardPool.push(cardEl);
    }
    this.visibleCards.clear();
    this.firstVisRow = -1;
    this.lastVisRow = -1;
    this.render();
  }

  setSelected(ids: Set<string> | string[]): void {
    this.selectedIds = ids instanceof Set ? ids : new Set(ids);
    for (const [idx, cardEl] of this.visibleCards) {
      const p = this.placements[idx];
      if (p) this.stampCard(cardEl, p.item, idx);
    }
  }

  setThumb(itemId: string, url: string): void {
    this.thumbCache.set(itemId, url);
    for (const [idx, cardEl] of this.visibleCards) {
      const p = this.placements[idx];
      if (p && p.item.id === itemId) {
        this.applyThumbToCard(cardEl, p.item);
      }
    }
  }

  refreshVisibleThumbs(cache: Record<string, string>): void {
    for (const [idx, cardEl] of this.visibleCards) {
      const p = this.placements[idx];
      if (!p) continue;
      const url = cache[p.item.id];
      if (url && this.thumbCache.get(p.item.id) !== url) {
        this.setThumb(p.item.id, url);
      }
    }
  }

  updateOptions(opts: Partial<VirtualGridOptions>): void {
    const oldOpts = { ...this.opts };
    this.opts = { ...this.opts, ...opts };
    if (!this.opts.targetRowHeight) this.opts.targetRowHeight = this.opts.rowHeight;

    const layoutChanged =
      oldOpts.layout          !== this.opts.layout          ||
      oldOpts.rowHeight       !== this.opts.rowHeight       ||
      oldOpts.gap             !== this.opts.gap             ||
      oldOpts.columns         !== this.opts.columns         ||
      oldOpts.minColWidth     !== this.opts.minColWidth     ||
      oldOpts.targetRowHeight !== this.opts.targetRowHeight ||
      oldOpts.footerHeight    !== this.opts.footerHeight;

    const stampChanged =
      oldOpts.showName     !== this.opts.showName    ||
      oldOpts.showRes      !== this.opts.showRes     ||
      oldOpts.showExt      !== this.opts.showExt     ||
      oldOpts.itemInfoType !== this.opts.itemInfoType;

    if (layoutChanged) {
      this.updateLayout();
      this.firstVisRow = -1;
      this.lastVisRow = -1;
    }

    if (stampChanged) {
      for (const [idx, cardEl] of this.visibleCards) {
        const p = this.placements[idx];
        if (p) this.stampCard(cardEl, p.item, idx);
      }
    }

    this.render();
  }

  scrollToItem(id: string): void {
    const p = this.placements.find(pl => pl.item.id === id);
    if (!p) return;
    this.scrollEl.scrollTo({ top: p.y, behavior: 'smooth' });
  }

  destroy(): void {
    this.resizeObs?.disconnect();
    this.bannerResizeObs?.disconnect();
    this.bannerResizeObs = null;
    this.scrollEl.removeEventListener('scroll', this.onScroll);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.idleId !== null) {
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(this.idleId);
      else clearTimeout(this.idleId);
    }
    if (this.container.contains(this.scrollEl)) {
      this.container.removeChild(this.scrollEl);
    }
    this.bannerHeight = 0;
    this.cardPool     = [];
    this.visibleCards.clear();
    this.thumbCache.clear();
    this.placements   = [];
  }



  // ─── Layout Calculation ───────────────────────────────────────────────────

  private updateLayout(): void {
    const containerW = this.scrollEl.clientWidth - 32;
    if (containerW <= 0) return;

    if (this.opts.columns === 'auto') {
      this.colCount = Math.max(1, Math.floor(
        (containerW + this.opts.gap) / (this.opts.minColWidth + this.opts.gap)
      ));
    } else {
      this.colCount = this.opts.columns;
    }
    this.colWidth = Math.max(1, Math.floor(
      (containerW - this.opts.gap * (this.colCount - 1)) / this.colCount
    ));

    this.placements = this.computePlacements();
    this.updateInnerHeight();
  }

  private computePlacements(): CardPlacement[] {
    const layout = this.opts.layout;
    if (layout === 'grid')      return this.computeGridPlacements();
    if (layout === 'justified') return this.computeJustifiedPlacements();
    if (layout === 'list')      return this.computeListPlacements();
    if (layout === 'waterfall') return this.computeWaterfallPlacements();
    return [];
  }

  private computeGridPlacements(): CardPlacement[] {
    const out: CardPlacement[] = [];
    const rowH = this.opts.rowHeight + this.opts.gap;
    for (let i = 0; i < this.items.length; i++) {
      const col = i % this.colCount;
      const row = Math.floor(i / this.colCount);
      out.push({
        item: this.items[i],
        idx: i,
        x: col * (this.colWidth + this.opts.gap),
        y: row * rowH,
        width: this.colWidth,
        height: this.opts.rowHeight,
      });
    }
    return out;
  }

  private computeJustifiedPlacements(): CardPlacement[] {
    const out: CardPlacement[] = [];
    const containerW = this.scrollEl.clientWidth - 32;
    if (containerW <= 0) return out;

    const targetH = this.opts.targetRowHeight || this.opts.rowHeight;
    const gap = this.opts.gap;

    interface RowItem { item: IndexEntry; idx: number; width: number }
    let currentRow: RowItem[] = [];
    let currentW = 0;
    const rows: RowItem[][] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const ar = item.width && item.height ? item.width / item.height : 4 / 3;
      const w = targetH * ar;
      if (currentRow.length > 0 && currentW + gap + w > containerW) {
        rows.push(currentRow);
        currentRow = [];
        currentW = 0;
      }
      currentRow.push({ item, idx: i, width: w });
      currentW += (currentRow.length > 1 ? gap : 0) + w;
    }
    if (currentRow.length > 0) rows.push(currentRow);

    let y = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const isLast = r === rows.length - 1;
      const totalGaps = (row.length - 1) * gap;
      let rowH = targetH;
      let widths: number[] = row.map(c => c.width);

      if (!isLast) {
        // sum widths in row
        let rowW = 0;
        for (const c of row) rowW += c.width;
        const scale = (containerW - totalGaps) / Math.max(1, (rowW));
        widths = row.map(c => Math.max(1, Math.floor(c.width * scale)));
        rowH = Math.max(1, Math.floor(targetH * scale));
      }

      let x = 0;
      for (let c = 0; c < row.length; c++) {
        out.push({
          item: row[c].item,
          idx: row[c].idx,
          x, y,
          width: widths[c],
          height: rowH,
        });
        x += widths[c] + gap;
      }
      y += rowH + gap;
    }
    return out;
  }

  private computeListPlacements(): CardPlacement[] {
    const out: CardPlacement[] = [];
    const rowH = this.opts.rowHeight + this.opts.gap;
    const w = this.scrollEl.clientWidth - 32;
    for (let i = 0; i < this.items.length; i++) {
      out.push({
        item: this.items[i],
        idx: i,
        x: 0,
        y: i * rowH,
        width: Math.max(0, w),
        height: this.opts.rowHeight,
      });
    }
    return out;
  }

  private computeWaterfallPlacements(): CardPlacement[] {
    const out: CardPlacement[] = [];
    const footerH = (this.opts.showName || this.opts.showRes) ? (this.opts.footerHeight || 44) : 0;
    const colHeights = new Array(this.colCount).fill(0);
    const gap = this.opts.gap;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const ar = item.width && item.height ? item.width / item.height : 4 / 3;
      const cappedAR = Math.max(0.5, Math.min(2.5, ar));
      const cardH = (this.colWidth / cappedAR) + footerH;

      let shortestCol = 0;
      let minH = colHeights[0];
      for (let c = 1; c < this.colCount; c++) {
        if (colHeights[c] < minH) {
          minH = colHeights[c];
          shortestCol = c;
        }
      }

      const x = shortestCol * (this.colWidth + gap);
      const y = colHeights[shortestCol];

      out.push({
        item, idx: i, x, y,
        width: this.colWidth,
        height: cardH,
      });
      colHeights[shortestCol] += cardH + gap;
    }
    this.totalHeight = colHeights.length > 0 ? Math.max(...colHeights) : 0;
    return out;
  }

  private updateInnerHeight(): void {
    let h = 0;
    const layout = this.opts.layout;
    if (this.placements.length === 0) {
      h = 0;
    } else if (layout === 'grid' || layout === 'list') {
      const last = this.placements[this.placements.length - 1];
      h = last.y + this.opts.rowHeight + this.opts.gap;
    } else if (layout === 'justified') {
      const last = this.placements[this.placements.length - 1];
      h = last.y + last.height + this.opts.gap;
    } else if (layout === 'waterfall') {
      h = this.totalHeight;
    }
    // Add the banner height so the scroll area is tall enough to scroll the
    // banner off the top of the viewport.
    h += this.bannerHeight;
    this.innerEl.style.height = `${Math.max(0, h)}px`;
  }

  // ─── Banner (scrollable content above the cards) ────────────────────────────

  /**
   * Returns the DOM element the engine has reserved for a scrollable banner.
   * Pass this to <Teleport to="..."> in the host component. The engine will
   * measure the slot's first child to compute the banner height and offset
   * the card pool accordingly.
   */
  getBannerSlot(): HTMLElement {
    return this.bannerSlotEl
  }

  /** Manually trigger a re-measure of the banner (e.g. after Teleport adds a
   *  child asynchronously). Normally not needed \u2014 the ResizeObserver handles it. */
  refreshBanner(): void {
    const prev = this.bannerHeight
    this.measureBanner()
    if (this.bannerHeight !== prev) {
      this.applyBannerOffset()
      this.updateInnerHeight()
      this.firstVisRow = -1
      this.lastVisRow = -1
      this.render()
    }
  }

  private measureBanner(): void {
    // Measure the slot itself when it has no children yet; otherwise measure
    // the actual teleported content (slot's first child).
    const child = this.bannerSlotEl.firstElementChild as HTMLElement | null
    if (child) {
      this.bannerHeight = child.getBoundingClientRect().height
    } else {
      this.bannerHeight = this.bannerSlotEl.getBoundingClientRect().height
    }
  }

  private applyBannerOffset(): void {
    // 16px = scroll container's existing padding; bannerHeight = teleported content's measured height;
    // 16 = guaranteed minimum gap so the first card never butts up against the banner.
    const top = 16 + this.bannerHeight + 16
    this.innerEl.style.top = `${top}px`
    this.poolEl.style.top  = `${top}px`
  }




  // ─── Scroll & Render Loop ─────────────────────────────────────────────────

  private onScroll = (): void => {
    if (this.idleId !== null) {
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(this.idleId);
      else clearTimeout(this.idleId);
      this.idleId = null;
    }

    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();

      const scheduleIdle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 150));
      this.idleId = scheduleIdle(() => {
        this.idleId = null;
        this.render(true);
      });
    });
  };

  private render(isIdle: boolean = false): void {
    if (this.placements.length === 0) return;
    const scrollTop = this.scrollEl.scrollTop;
    const viewH     = this.scrollEl.clientHeight;
    if (viewH <= 0) return;

    const overscan = this.opts.overscan + (isIdle ? 4 : 0);

    // Estimate average row height to compute visible Y range
    const avgH = this.opts.layout === 'list' ? this.opts.rowHeight :
                 this.opts.layout === 'justified' ? (this.opts.targetRowHeight || this.opts.rowHeight) :
                 this.opts.rowHeight;

    const firstY = scrollTop - overscan * avgH;
    const lastY  = scrollTop + viewH + overscan * avgH;

    // Find first/last visible placement (linear scan; could optimize with binary search)
    let firstIdx = 0, lastIdx = this.placements.length - 1;
    for (let i = 0; i < this.placements.length; i++) {
      const p = this.placements[i];
      if (p.y + p.height >= firstY) { firstIdx = i; break; }
    }
    for (let i = this.placements.length - 1; i >= 0; i--) {
      const p = this.placements[i];
      if (p.y <= lastY) { lastIdx = i; break; }
    }

    if (!isIdle && firstIdx === this.firstVisRow && lastIdx === this.lastVisRow) {
      for (const [idx, cardEl] of this.visibleCards) {
        this.positionCard(cardEl, idx);
      }
      return;
    }

    this.firstVisRow = firstIdx;
    this.lastVisRow  = lastIdx;

    // Recycle cards out of range
    for (const [idx, cardEl] of this.visibleCards) {
      if (idx < firstIdx || idx > lastIdx) {
        cardEl.style.display = 'none';
        this.cardPool.push(cardEl);
        this.visibleCards.delete(idx);
      }
    }

    // Render visible cards
    const newlyVisible: string[] = [];
    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      if (idx < 0 || idx >= this.placements.length) continue;
      if (this.visibleCards.has(idx)) {
        this.positionCard(this.visibleCards.get(idx)!, idx);
        continue;
      }
      const p = this.placements[idx];
      if (!p) continue;

      const cardEl = this.acquireCard();
      this.stampCard(cardEl, p.item, idx);
      this.positionCard(cardEl, idx);
      cardEl.style.display = '';
      this.visibleCards.set(idx, cardEl);

      if (!this.thumbCache.has(p.item.id)) {
        newlyVisible.push(p.item.id);
      }
    }

    if (newlyVisible.length > 0) {
      const size = this.colWidth >= 300 ? 'lg' : this.colWidth >= 180 ? 'md' : 'sm';
      this.emit('need-thumbs', { ids: newlyVisible, size });
    }

    this.emit('visible-range', firstIdx, lastIdx);
  }

  private acquireCard(): HTMLElement {
    return this.cardPool.pop() ?? this.createCard();
  }

  private positionCard(cardEl: HTMLElement, idx: number): void {
    const p = this.placements[idx];
    if (!p) return;
    // In list layout, use static positioning to avoid sub-pixel jitter from transform on hover
    if (this.opts.layout === 'list') {
      cardEl.style.transform = 'none';
      cardEl.style.top       = `${p.y}px`;
      cardEl.style.left      = `${p.x}px`;
    } else {
      cardEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    cardEl.style.width     = `${p.width}px`;
    cardEl.style.height    = `${p.height}px`;
  }


  private applyThumbToCard(cardEl: HTMLElement, item: IndexEntry): void {
    const thumbUrl = this.thumbCache.get(item.id) ?? null;
    const thumbArea = cardEl.querySelector<HTMLElement>('.vg-thumb');
    const imgEl = cardEl.querySelector<HTMLImageElement>('.vg-thumb-img');
    if (!thumbArea || !imgEl) return;

    if (thumbUrl) {
      imgEl.src = thumbUrl;
      imgEl.style.display = 'block';
      thumbArea.style.background = '';
    } else {
      imgEl.src = '';
      imgEl.style.display = 'none';
      thumbArea.style.background = this.placeholderBg(item.ext);
    }
  }

  private stampCard(cardEl: HTMLElement, item: IndexEntry, _idx: number): void {
    const isSelected = this.selectedIds.has(item.id);
    const layout = this.opts.layout;
    cardEl.dataset.id = item.id;
    cardEl.dataset.layout = layout;
    cardEl.className = `vg-card vg-layout-${layout}${isSelected ? ' vg-selected' : ''}`;

    const isList = layout === 'list';
    const isWaterfall = layout === 'waterfall';

    const extBadge   = cardEl.querySelector<HTMLElement>('.vg-ext');
    const nameEl     = cardEl.querySelector<HTMLElement>('.vg-name');
    const resEl      = cardEl.querySelector<HTMLElement>('.vg-res');
    const imgEl      = cardEl.querySelector<HTMLImageElement>('.vg-thumb-img');
    const durEl      = cardEl.querySelector<HTMLElement>('.vg-duration');
    const enhancedBadge = cardEl.querySelector<HTMLElement>('.vg-enhanced-badge');
    const footer     = cardEl.querySelector<HTMLElement>('.vg-footer');
    const thumbArea  = cardEl.querySelector<HTMLElement>('.vg-thumb');

    if (!extBadge || !nameEl || !resEl || !imgEl || !footer || !thumbArea) return;

    extBadge.textContent = item.ext.toUpperCase();
    extBadge.style.display = this.opts.showExt ? 'block' : 'none';

    if (enhancedBadge) {
      enhancedBadge.style.display = (item as any).hasEnhanced ? 'block' : 'none';
      enhancedBadge.style.right = isSelected ? '8px' : '6px';
      enhancedBadge.style.top   = isSelected ? '8px' : '6px';
    }

    this.applyThumbToCard(cardEl, item);

    // Name
    nameEl.textContent = item.name || '';
    if (isList) {
      nameEl.style.display = 'block';
    } else {
      nameEl.style.display = this.opts.showName ? 'block' : 'none';
    }

    // Info text
    let infoText = '';
    if (this.opts.itemInfoType === 'dimensions' && item.width && item.height) {
      infoText = `${item.width} × ${item.height}`;
    } else if (this.opts.itemInfoType === 'size' && this.opts.formatSize) {
      infoText = this.opts.formatSize(item.size);
    } else {
      infoText = item.ext.toUpperCase();
    }
    resEl.textContent = infoText;
    resEl.style.display = this.opts.showRes || isList ? 'block' : 'none';

    // For list layout, set extra fields if available
    if (isList) {
      const sizeEl  = cardEl.querySelector<HTMLElement>('.vg-list-size');
      const fmtEl   = cardEl.querySelector<HTMLElement>('.vg-list-format');
      const dateEl  = cardEl.querySelector<HTMLElement>('.vg-list-date');
      if (sizeEl && this.opts.formatSize) sizeEl.textContent = this.opts.formatSize(item.size);
      if (fmtEl)  fmtEl.textContent = item.ext.toUpperCase();
      if (dateEl && this.opts.formatDate) dateEl.textContent = this.opts.formatDate(item.importTime);
    }

    // Footer visibility
    const showFooter = isList || this.opts.showName || this.opts.showRes;
    footer.style.display = showFooter ? (isList ? 'none' : 'flex') : 'none';
    if (!isList) {
      thumbArea.style.height = (this.opts.showName || this.opts.showRes) ? 'calc(100% - 44px)' : '100%';
    } else {
      thumbArea.style.height = '100%';
    }

    // Duration badge (videos)
    const isVid = ['mp4','mov','avi','mkv','webm','mpeg','mpg'].includes(item.ext.toLowerCase());
    if (durEl) {
      if (isVid && item.duration) {
        const m = Math.floor(item.duration / 60);
        const s = Math.floor(item.duration % 60);
        durEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        durEl.style.display = 'block';
      } else {
        durEl.style.display = 'none';
      }
    }
  }

  private placeholderBg(ext: string): string {
    const map: Record<string, string> = {
      png: '#1a2535', jpg: '#1e2025', jpeg: '#1e2025', jfif: '#1e2025',
      gif: '#1a2535', webp: '#1a2535', svg: '#1a2a1e',
      mp4: '#1a1e2a', mov: '#1a1e2a', pdf: '#2a1e1e',
      ai:  '#2a1e1e', psd: '#1e1e2a',
    };
    return map[ext.toLowerCase()] ?? '#1a1a1e';
  }

  // ─── DOM Construction ─────────────────────────────────────────────────────

  private createScrollEl(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'vg-scroll';
    el.style.cssText = `
      position: relative; width: 100%; height: 100%;
      overflow-y: auto; overflow-x: hidden;
      padding: 16px; box-sizing: border-box;
    `;
    return el;
  }

  private createInnerEl(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'position: relative; width: 100%; pointer-events: none; top: 16px; left: 16px;';
    return el;
  }

  private createPoolEl(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'position: absolute; top: 16px; left: 16px; right: 16px;';
    return el;
  }

  private createBannerSlotEl(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'vg-banner-slot';
    el.style.cssText = 'position: relative; width: 100%; box-sizing: border-box;';
    return el;
  }


  private createCard(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'vg-card';
    el.draggable = true;
    el.style.cssText = `position: absolute; cursor: pointer; border-radius: 8px;
      overflow: hidden; box-sizing: border-box; will-change: transform;`;

    el.innerHTML = `
      <div class="vg-thumb" style="position:relative;width:100%;height:calc(100% - 44px);
        overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0a0a0c;">
        <img class="vg-thumb-img" draggable="false" style="width:100%;height:100%;object-fit:cover;
          display:none;z-index:1;" loading="lazy" decoding="async"/>
        <span class="vg-ext" style="position:absolute;top:6px;left:6px;
          background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);border-radius:3px;padding:2px 5px;
          font-size:9px;font-weight:700;color:rgba(255,255,255,0.85);
          letter-spacing:0.06em;font-family:monospace;z-index:4;"></span>
        <span class="vg-duration" style="position:absolute;bottom:6px;right:6px;
          background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);
          border-radius:3px;padding:2px 6px;font-size:10px;font-weight:600;color:#fff;
          font-family:monospace;letter-spacing:0.03em;display:none;z-index:4;"></span>

        <button class="vg-preview-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>

        <button class="vg-mute-btn">
          <svg class="vg-mute-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px; display: none;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          <svg class="vg-mute-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 15px; height: 15px; display: block;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        </button>
        <span class="vg-enhanced-badge" style="position:absolute;top:6px;right:6px;font-size:14px;display:none;z-index:4;filter:drop-shadow(0 0 4px rgba(0,0,0,0.5));pointer-events:none;">✨</span>
      </div>
      <div class="vg-footer" style="padding:6px 8px 7px;display:flex;flex-direction:column;text-align:center;">
        <div class="vg-name" style="font-size:11px;white-space:nowrap;font-weight:600;
          overflow:hidden;text-overflow:ellipsis;"></div>
        <div class="vg-res" style="font-size:10px;margin-top:2px;opacity:0.45;font-family:monospace;"></div>
      </div>
      <div class="vg-list-cols" style="display:none;">
        <span class="vg-list-size"></span>
        <span class="vg-list-format"></span>
        <span class="vg-list-date"></span>
      </div>`;

    const previewBtn = el.querySelector('.vg-preview-btn');
    const muteBtn    = el.querySelector('.vg-mute-btn');

    el.addEventListener('click', (e) => {
      const id    = el.dataset.id;
      const entry = this.items.find(i => i.id === id);
      if (id && entry) this.emit('select', { id, entry, event: e });
    });

    el.addEventListener('dblclick', (e) => {
      const id    = el.dataset.id;
      const entry = this.items.find(i => i.id === id);
      if (id && entry) this.emit('dblclick', { id, entry, event: e });
    });

    el.addEventListener('mouseenter', (e) => {
      const id    = el.dataset.id;
      const entry = this.items.find(i => i.id === id);
      if (id && entry) this.emit('hover', { id, entry, el, event: e });
    });
    el.addEventListener('mouseleave', (e) => {
      const id    = el.dataset.id;
      const entry = this.items.find(i => i.id === id);
      if (id && entry) this.emit('unhover', { id, entry, el, event: e });
    });

    el.addEventListener('dragstart', (e) => {
      const id    = el.dataset.id;
      const entry = this.items.find(i => i.id === id);
      if (id && entry) this.emit('dragstart', { id, entry, event: e });
    });

    if (previewBtn) {
      previewBtn.addEventListener('mouseenter', (e) => {
        const id    = el.dataset.id;
        const entry = this.items.find(i => i.id === id);
        if (id && entry) this.emit('preview-enter', { id, entry, el, event: e });
      });
      previewBtn.addEventListener('mouseleave', (e) => {
        this.emit('preview-leave', { event: e });
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('toggle-mute', { event: e });
      });
    }

    this.poolEl.appendChild(el);
    return el;
  }

  private attachListeners(): void {
    this.scrollEl.addEventListener('scroll', this.onScroll, { passive: true });

    this.resizeObs = new ResizeObserver(() => {
      this.updateLayout();
      this.render();
    });
    this.resizeObs.observe(this.container);

    // Re-measure when teleported banner content appears or resizes
    this.bannerResizeObs = new ResizeObserver(() => {
      this.refreshBanner()
    })
    this.bannerResizeObs.observe(this.bannerSlotEl)
  }

}

export const VIRTUAL_GRID_CSS = `
.vg-card {
  background: var(--bg-card);
  border: 2px solid transparent;
  transition: border-color 0.12s, box-shadow 0.2s, transform 0.2s;
  color: var(--text-1);
  pointer-events: auto;
}
.vg-card:hover {
  border-color: rgba(255,255,255,0.12);
  box-shadow: 0 6px 20px rgba(0,0,0,.3);
  z-index: 10;
}
.vg-selected {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 1px var(--accent);
}
.vg-preview-btn {
  position: absolute; bottom: 6px; right: 6px; width: 26px; height: 26px;
  border-radius: 5px; background: rgba(255,255,255,.14); backdrop-filter: blur(6px);
  border: none; color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: opacity .15s, transform .1s, background .15s; z-index: 5;
}
.vg-card:hover .vg-preview-btn { opacity: 1; }
.vg-preview-btn:hover { background: rgba(255,255,255,.28); transform: scale(1.1); }

.vg-mute-btn {
  position: absolute; bottom: 12px; left: 6px; width: 26px; height: 26px;
  border-radius: 5px; background: rgba(255,255,255,.14); backdrop-filter: blur(6px);
  border: none; color: #fff; display: none; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: opacity .15s, transform .1s, background .15s; z-index: 5;
}
.vg-card:hover .vg-mute-btn { opacity: 1; }
.vg-mute-btn:hover { background: rgba(255,255,255,.28); transform: scale(1.1); }

.vg-scroll::-webkit-scrollbar { width: 6px; }
.vg-scroll::-webkit-scrollbar-track { background: transparent; }
.vg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
.vg-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }

/* ─── List layout (horizontal compact rows) ────────────────────────────── */
.vg-layout-list {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 0 !important;
  padding: 6px 16px !important;
  background: transparent !important;
  /* Pre-allocate the 2px border to prevent layout shift on hover */
  border: 2px solid transparent !important;
  border-radius: 4px !important;
  /* No box-shadow / z-index changes that would re-trigger layout in the engine's RAF loop */
  box-shadow: none !important;
  transform: none !important;
  transition: background 0.12s, border-color 0.12s !important;
  will-change: auto !important;
  contain: layout style;
}
.vg-layout-list:hover {
  background: rgba(255,255,255,0.04) !important;
  border-color: rgba(255,255,255,0.08) !important;
  box-shadow: none !important;
  transform: none !important;
  z-index: auto !important;
}
.vg-layout-list.vg-selected {
  background: rgba(255,255,255,0.08) !important;
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 1px var(--accent) !important;
  z-index: auto !important;
}

.vg-layout-list .vg-thumb {
  position: relative !important;
  width: 40px !important;
  min-width: 40px !important;
  height: 40px !important;
  flex-shrink: 0 !important;
  border-radius: 4px !important;
  overflow: hidden !important;
  aspect-ratio: 1 / 1 !important;
  background: #0a0a0c !important;
  margin: 0 !important;
  padding: 0 !important;
}
.vg-layout-list .vg-thumb .vg-thumb-img {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.vg-layout-list .vg-name {
  flex: 1 1 0 !important;
  min-width: 0 !important;
  margin: 0 16px !important;
  padding: 0 !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  color: var(--text-1) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  text-align: left !important;
  pointer-events: none !important;
}
.vg-layout-list .vg-list-cols {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 32px !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  padding: 0 0 0 16px !important;
  font-size: 12px !important;
  color: var(--text-2) !important;
  pointer-events: none !important;
}
.vg-layout-list .vg-list-cols .vg-list-size,
.vg-layout-list .vg-list-cols .vg-list-format,
.vg-layout-list .vg-list-cols .vg-list-date {
  display: inline-block !important;
  width: 80px !important;
  text-align: left !important;
  font-size: 12px !important;
  color: var(--text-2) !important;
  font-family: var(--font-mono) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.vg-layout-list .vg-list-cols .vg-list-format { width: 70px; }
.vg-layout-list .vg-list-cols .vg-list-date   { width: 150px; }

.vg-layout-list .vg-footer,
.vg-layout-list .vg-res,
.vg-layout-list .vg-ext,
.vg-layout-list .vg-duration,
.vg-layout-list .vg-preview-btn,
.vg-layout-list .vg-mute-btn,
.vg-layout-list .vg-enhanced-badge,
.vg-layout-list .vg-meta-overlay {
  display: none !important;
}

`;

export function injectVirtualGridStyles(): void {
  if (document.getElementById('vg-styles')) return;
  const style = document.createElement('style');
  style.id        = 'vg-styles';
  style.textContent = VIRTUAL_GRID_CSS;
  document.head.appendChild(style);
}

