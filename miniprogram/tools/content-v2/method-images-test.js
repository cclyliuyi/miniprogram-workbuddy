// Reproduce an ordinary reader with no permission to sign private storage files.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const cards = require('../../pages/method/method-data').CARDS;
const prefix = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/';
let now = Date.now(), generation = 0, unavailable = '', calls = 0, clientSigns = 0, fail = false, release;
const Clock = class extends Date { static now() { return now; } };
const signed = [], reads = [], storage = { method_read_v2: ['v2-m01'] };
const sdk = {
  init() {}, DYNAMIC_CURRENT_ENV: 'current',
  async downloadFile({fileID}) { reads.push(fileID); throw Error('method images must not read article JSON'); },
  async getTempFileURL({fileList}) {
    const revision = ++generation;
    return {fileList: fileList.map(item => {
      const fileID = typeof item === 'string' ? item : item.fileID;
      signed.push(fileID);
      return {fileID, status: fileID === unavailable ? -1 : 0, tempFileURL: 'https://media.example/' + fileID.split('/').pop() + '?v=' + revision};
    })};
  },
};
const server = {exports: {}, require: name => { assert.equal(name, 'wx-server-sdk'); return sdk; }, console, Date: Clock};
vm.runInNewContext(fs.readFileSync(path.join(root, 'cloudfunctions/getArticle/index.js'), 'utf8'), server);
let preview;
const wx = {
  getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = value; },
  previewImage: options => { preview = options; }, navigateTo() {},
  cloud: {
    async getTempFileURL() { clientSigns++; throw Error('PERMISSION_DENIED'); },
    callFunction(options) {
      calls++;
      assert.equal(options.name, 'getArticle');
      const respond = async () => {
        if (fail) return options.fail({errMsg: 'offline'});
        options.success({result: await server.exports.main(options.data)});
      };
      if (release === null) release = respond;
      else Promise.resolve().then(respond);
    },
  },
};
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports: {}};
  modules.set(file, module);
  const context = {module, exports: module.exports, wx, Date: Clock, console, require: name => name.endsWith('haptic') ? {light() {}} : load(path.resolve(path.dirname(file), name + '.js'))};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
  return module.exports;
}
function page(definition) {
  const p = {...definition, data: JSON.parse(JSON.stringify(definition.data))};
  p.setData = patch => {
    for (const [key, value] of Object.entries(patch)) {
      const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = p.data;
      for (const k of keys.slice(0, -1)) target = target[k];
      target[keys.at(-1)] = value;
    }
  };
  return p;
}
async function drain() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
async function testServer() {
  const result = await server.exports.main({action: 'method-images', fileIDs: [prefix + 'backups/private.json']});
  assert.equal(result.ok, true, 'method illustrations need server-issued links');
  assert.equal(Object.keys(result.data.images).length, 16);
  assert(result.data.mediaExpiresAt > now + 60000);
  for (const card of cards) assert.match(result.data.images[card.imageSrc], /^https:\/\//);
  assert.equal(reads.length, 0);
  assert(signed.every(id => /^content-v2-20260914\/method\/m(0[1-9]|1[0-6])\.webp$/.test(id.slice(prefix.length))), 'never sign caller-supplied private files');
  unavailable = cards[15].imageSrc;
  const partial = await server.exports.main({action: 'method-images'});
  assert.equal(partial.data.images[unavailable], undefined, 'missing files must not receive a successful URL');
  unavailable = '';
  console.log('PASS method gateway: 16 published images, restricted paths, expiry, partial missing file');
}
async function testClient() {
  const {createList, createDetail} = load(path.join(root, 'utils/learning-pages.js'));
  const stages = [...new Set(cards.map(c => c.stage))].map(title => ({title}));
  const list = page(createList({cards, key: 'method', title: '方法论', intro: '', stages}));
  const detail = page(createDetail({cards, key: 'method'}));
  list.onLoad(); list.onShow(); detail.onLoad({id: 'v2-m08'});
  await drain();
  assert.equal(detail.data.currentIndex, 7);
  assert.match(detail.data.cards[0].imageSrc, /^https:\/\//, 'ordinary readers must receive a signed body image instead of a private cloud:// ID');
  assert.equal(list.data.groups.length, 4);
  for (const card of list.data.groups.flatMap(g => g.cards)) assert.match(card.imageSrc, /^https:\/\//);
  for (const card of detail.data.cards) assert.match(card.imageSrc, /^https:\/\//);
  assert.equal(calls, 1, 'list and detail share a single request and valid link cache');
  assert.equal(clientSigns, 0);
  assert.equal(list.data.readCount, 2, 'the async thumbnail refresh must preserve the newly read deep link');
  assert(storage.method_read_v2.includes('v2-m08'));
  assert(cards.every(c => c.imageSrc.startsWith('cloud://')), 'do not mutate editorial data');
  detail.onImageLoad({currentTarget: {dataset: {index: 7}}}); detail.previewImage();
  assert.equal(preview.current, detail.data.cards[7].imageSrc);
  detail.navigateCard({currentTarget: {dataset: {step: 1}}}); assert.equal(detail.data.currentIndex, 8);
  fail = true;
  await detail.retryImage({currentTarget: {dataset: {index: 8}}});
  assert.equal(detail.data.cards[8].imageStatus, 'error');
  fail = false;
  const oldURL = detail.data.cards[8].imageSrc;
  await detail.retryImage({currentTarget: {dataset: {index: 8}}});
  assert.match(detail.data.cards[8].imageSrc, /^https:\/\//);
  assert.notEqual(detail.data.cards[8].imageSrc, oldURL);
  assert.equal(clientSigns, 0, 'retry also uses the server identity');
  const oldThumb = list.data.cards[0].imageSrc;
  now += 3600000;
  list.onShow(); await drain();
  assert.notEqual(list.data.cards[0].imageSrc, oldThumb, 're-entering renews expired thumbnails');
  now += 3600000;
  detail.onShow(); await drain();
  assert.match(detail.data.cards[15].imageSrc, /^https:\/\//);
  release = null;
  const pending = detail.retryImage({currentTarget: {dataset: {index: 0}}});
  detail.onUnload(); const snapshot = JSON.stringify(detail.data);
  assert.equal(typeof release, 'function'); await release(); await pending;
  assert.equal(JSON.stringify(detail.data), snapshot, 'unloaded pages must not receive late responses');
  console.log('PASS method reader: list/body, private-storage denial, shared cache, expiry, deep links, reading progress, preview, retry and unload');
}
(async () => {
  if (process.argv[2] !== 'client') await testServer();
  if (process.argv[2] !== 'server') await testClient();
})().catch(error => { console.error(error); process.exitCode = 1; });
