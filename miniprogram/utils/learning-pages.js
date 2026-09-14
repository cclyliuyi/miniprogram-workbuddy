// Shared reading behavior for the two illustrated series.
const haptic = require('./haptic');

function safeRead(key) {
  const value = wx.getStorageSync(key);
  return Array.isArray(value) ? value : [];
}

function createList({ cards, key, title, intro, stages }) {
  return {
    data: { cards: [], groups: [], title, intro, total: cards.length, readCount: 0 },
    onLoad() { this.refreshReading(); },
    onShow() { this.refreshReading(); },
    refreshReading() {
      const read = safeRead(key + '_read_v2');
      const list = cards.map((card, index) => ({ ...card, index, isRead: read.indexOf(card.id) >= 0 }));
      const groups = stages.map((stage, index) => ({ ...stage, number: index + 1, cards: list.filter(card => card.stage === stage.title) }));
      this.setData({ cards: list, groups, readCount: list.filter(card => card.isRead).length });
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
      let index = options.id ? cards.findIndex(card => card.id === options.id) : Number(options.index || 0);
      if (!Number.isInteger(index) || index < 0 || index >= cards.length) index = 0;
      this.setData({ cards: cards.map(card => ({ ...card, imageStatus: 'loading' })), currentIndex: index });
      this.markRead(index);
    },
    onUnload() { this._unloaded = true; },
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
      const index = Number(e.currentTarget.dataset.index);
      const card = cards[index];
      if (!card) return;
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
