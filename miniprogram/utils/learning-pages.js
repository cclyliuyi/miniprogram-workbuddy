// Shared reading behavior for the two illustrated series.
const haptic = require('./haptic');
const { fetchMethodImages } = require('./learning-images');

function privateMethodImage(card, key) {
  return key === 'method' && /^cloud:\/\//.test(card.imageSrc || '');
}

function safeRead(key) {
  const value = wx.getStorageSync(key);
  return Array.isArray(value) ? value : [];
}

function createList({ cards, key, title, intro, stages }) {
  return {
    data: { cards: [], groups: [], title, intro, total: cards.length, readCount: 0 },
    onLoad() { this._unloaded = false; this.refreshReading(); this.resolveImages(); },
    onShow() { this.refreshReading(); this.resolveImages(); },
    onUnload() { this._unloaded = true; },
    refreshReading() {
      const read = safeRead(key + '_read_v2');
      const list = cards.map((card, index) => ({ ...card, index, isRead: read.indexOf(card.id) >= 0,
        imageSrc: privateMethodImage(card, key) ? ((this._imageURLs || {})[card.imageSrc] || '') : card.imageSrc }));
      const groups = stages.map((stage, index) => ({ ...stage, number: index + 1, cards: list.filter(card => card.stage === stage.title) }));
      this.setData({ cards: list, groups, readCount: list.filter(card => card.isRead).length });
    },
    async resolveImages() {
      if (!cards.some(card => privateMethodImage(card, key))) return;
      try {
        const images = await fetchMethodImages();
        if (this._unloaded) return;
        this._imageURLs = images;
        this.refreshReading();
      } catch (err) { /* 保留目录文字与已加载缩略图，再次进入时重试。 */ }
    },
    openCard(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (!cards[index]) return;
      haptic.light();
      wx.navigateTo({ url: `/pages/${key}-detail/detail?id=${cards[index].id}` });
    },
    onShareAppMessage() { return { title: `${title} · ${cards.length}张图解`, path: `/pages/${key}/${key}` }; },
    onShareTimeline() { return { title: `${title} · ${cards.length}张图解` }; }
  };
}

function createDetail({ cards, key }) {
  return {
    data: { cards: [], currentIndex: 0, total: cards.length },
    onLoad(options = {}) {
      this._unloaded = false;
      let index = options.id ? cards.findIndex(card => card.id === options.id) : Number(options.index || 0);
      if (!Number.isInteger(index) || index < 0 || index >= cards.length) index = 0;
      this.setData({ cards: cards.map(card => ({ ...card, imageStatus: 'loading',
        imageSrc: privateMethodImage(card, key) ? '' : card.imageSrc })), currentIndex: index });
      this.markRead(index);
      this.resolveImages();
    },
    onShow() { this.resolveImages(); },
    onUnload() { this._unloaded = true; },
    async resolveImages(force = false) {
      if (!cards.some(card => privateMethodImage(card, key))) return;
      try {
        const images = await fetchMethodImages(force);
        if (this._unloaded) return;
        const updates = {};
        cards.forEach((card, index) => {
          if (!privateMethodImage(card, key)) return;
          const src = images[card.imageSrc] || '';
          const current = this.data.cards[index];
          if (src !== current.imageSrc || !src) {
            updates[`cards[${index}].imageSrc`] = src;
            updates[`cards[${index}].imageStatus`] = src ? 'loading' : 'error';
          }
        });
        if (Object.keys(updates).length) this.setData(updates);
      } catch (err) {
        if (this._unloaded) return;
        const updates = {};
        this.data.cards.forEach((card, index) => {
          if (privateMethodImage(cards[index], key) && card.imageStatus === 'loading') updates[`cards[${index}].imageStatus`] = 'error';
        });
        if (Object.keys(updates).length) this.setData(updates);
      }
    },
    markRead(index) {
      const card = cards[index];
      if (!card) return;
      const storageKey = key + '_read_v2';
      const read = safeRead(storageKey);
      if (read.indexOf(card.id) < 0) {
        read.push(card.id);
        wx.setStorageSync(storageKey, read);
      }
    },
    onSwiperChange(e) {
      this.setData({ currentIndex: e.detail.current });
      this.markRead(e.detail.current);
    },
    navigateCard(e) {
      const index = this.data.currentIndex + Number(e.currentTarget.dataset.step);
      if (index < 0 || index >= cards.length) return;
      this.setData({ currentIndex: index });
      this.markRead(index);
      haptic.light();
    },
    onImageLoad(e) { this.setData({ [`cards[${e.currentTarget.dataset.index}].imageStatus`]: 'ready' }); },
    onImageError(e) { this.setData({ [`cards[${e.currentTarget.dataset.index}].imageStatus`]: 'error' }); },
    async retryImage(e) {
      if (this._unloaded) return;
      const index = Number(e.currentTarget.dataset.index);
      const card = cards[index];
      if (!card) return;
      if (privateMethodImage(card, key)) {
        this.setData({ [`cards[${index}].imageStatus`]: 'loading', [`cards[${index}].imageSrc`]: '' });
        await this.resolveImages(true);
        return;
      }
      this.setData({ [`cards[${index}].imageStatus`]: 'loading' });
      try {
        const result = await wx.cloud.getTempFileURL({ fileList: [card.imageSrc] });
        const file = result.fileList && result.fileList[0];
        if (!file || !file.tempFileURL || file.status) throw new Error('Image unavailable');
        if (!this._unloaded) this.setData({ [`cards[${index}].imageSrc`]: file.tempFileURL });
      } catch (err) {
        if (!this._unloaded) this.setData({ [`cards[${index}].imageStatus`]: 'error' });
      }
    },
    previewImage() {
      const card = this.data.cards[this.data.currentIndex];
      if (!card || card.imageStatus !== 'ready') return;
      wx.previewImage({ current: card.imageSrc, urls: [card.imageSrc] });
    },
    copySource(e) {
      wx.setClipboardData({ data: e.currentTarget.dataset.url });
    },
    onShareAppMessage() {
      const card = cards[this.data.currentIndex];
      return { title: card.title, path: `/pages/${key}-detail/detail?id=${card.id}` };
    },
    onShareTimeline() {
      const card = cards[this.data.currentIndex];
      return { title: card.title, query: `id=${card.id}` };
    }
  };
}

module.exports = { createList, createDetail };
