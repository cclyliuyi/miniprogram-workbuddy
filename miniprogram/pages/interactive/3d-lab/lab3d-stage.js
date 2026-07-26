// pages/interactive/3d-lab/lab3d-stage.js —— 3D 实验室 · 公共舞台模块
// 新版（暖纸舞台）用法：
//   const stage = require('../lab3d-stage');          // radiation-3d 用 './3d-lab/lab3d-stage'
//   stage.initThree(this, '#three-canvas', { onReady(env) {
//     // env = { THREE, scene, camera, renderer, canvas, width, height, dpr, lights, dispose }
//     // scene.background 已设纸色 0xf3efe6，暖白三灯已布好
//   }});
//   stage.init2D(this, '#plot', (ctx, w, h, canvas) => { ... });  // 转调 utils/lab-canvas.mount
//   材质取色一律用 stage.THEME3D.accent / teal / gold / indigo / warmGray 等
// 兼容保留（旧深空暖金 API，逐步迁走）：
//   stage.buildStage / stage.buildLights / stage.COL
// 通用工具：
//   this._home = stage.saveHome(this.controls);        // 相机定位后存 home 视角
//   onTouchStart(e) { stage.touchStart(this, e); }     // 触摸三件套
//   onXChanging(e) { this.state.x = e.detail.value/10; this.setData({xVal:...}); stage.throttle(this); }

const { THEME } = require('../../../utils/lab-theme');

// ── THEME3D：从 utils/lab-theme 派生的 three.js 数值色表（材质取色专用）──
// hex 字符串 → 0x 数值，保证 2D/3D 同源同色。
function hexNum(hex) { return parseInt(String(hex).replace('#', ''), 16); }
const THEME3D = {
  accent: hexNum(THEME.accent),    // 0xb85c38 赤陶 · 主体/强调
  teal: hexNum(THEME.teal),        // 0x1f8a70 青绿 · 第二系列
  gold: hexNum(THEME.gold),        // 0xb07d1e 赭金 · 第三系列
  indigo: hexNum(THEME.indigo),    // 0x4a63a8 靛蓝 · 第四系列
  plum: hexNum(THEME.plum),        // 0xa04f7d 梅紫 · 第五系列
  warmGray: hexNum(THEME.muted),   // 0x9b9384 暖灰 · 网格/辅助线
  paper: hexNum(THEME.bgSoft),     // 0xf3efe6 纸色 · scene.background
  card: hexNum(THEME.bg),          // 0xfbf9f4 卡面白
  ink: hexNum(THEME.ink),          // 0x20201c 墨色
  danger: hexNum(THEME.danger),    // 0xb3403a 危险红（状态用，不作系列）
};

// ── 旧·深空暖金色板（兼容保留，勿在新页使用）──
const COL = {
  bgEdge: 0x161a26,   // 深空边缘
  bgCore: 0x454b63,   // 深空中心（视线后方光晕）
  grid: 0xd4ad7e,     // 极坐标地面 · 暖金
  halo: 0xd4ad7e,     // 接触光环
  copper: 0xd89a5a,   // 暖铜主体
  copperHi: 0xf6d9a8, // 铜边高光
  throat: 0x8d9cb6,   // 喉部冷灰
  wave: 0xffd9a0,     // 波前暖金
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ═══ 暖白三灯（暖纸舞台默认光源）═══
// 纸色底上物体主要靠环境光铺亮 + 暖白主光塑形 + 纸色调补光柔化背面，
// 不再使用旧深空的青蓝底光（深色背景专属）。
function buildPaperLights(THREE, scene, opts) {
  opts = opts || {};
  const amb = new THREE.AmbientLight(0xfff6e8, opts.ambient !== undefined ? opts.ambient : 0.72);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xfff2dc, opts.key !== undefined ? opts.key : 0.85);
  key.position.set(4, 5, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf3efe6, opts.fill !== undefined ? opts.fill : 0.35);
  fill.position.set(-3, 2, -4);
  scene.add(fill);
  return { amb, key, fill };
}

// ═══ initThree(page, selector, opts) —— 3D 初始化样板复用 ═══
// SelectorQuery → createScopedThreejs → renderer/camera/暖白光源。
// scene.background 默认纸色 0xf3efe6（THEME3D.paper）。
// opts（均可省）：
//   onReady(env)  初始化完成回调；也可直接对返回的 Promise 用 .then(env => ...)
//   onError(err)  失败回调（canvas 不存在 / 尺寸始终为 0）
//   background    覆盖背景色（0x 数值）
//   lights:false  跳过默认灯（页面自建）；lightOpts 透传 buildPaperLights
//   fov/near/far/cameraPos([x,y,z])/maxDpr/retries
// env = { THREE, scene, camera, renderer, canvas, width, height, dpr, lights, dispose }
// dispose 只释放 renderer；controls/几何体仍由页面自管。
function initThree(page, selector, opts) {
  if (typeof opts === 'function') opts = { onReady: opts };
  opts = opts || {};
  const p = new Promise((resolve, reject) => {
    let tries = opts.retries !== undefined ? opts.retries : 5;
    const fail = (msg) => {
      const err = new Error('[lab3d-stage] ' + msg + ' (' + selector + ')');
      console.error(err.message);
      if (opts.onError) opts.onError(err);
      reject(err);
    };
    const attempt = () => {
      page.createSelectorQuery().select(selector).fields({ node: true, size: true }).exec((res) => {
        const r = res && res[0];
        if (!r || !r.node) { fail('canvas 节点不存在'); return; }
        if (!r.width || !r.height) {
          if (tries-- > 0) { setTimeout(attempt, 200); return; }
          fail('canvas 尺寸始终为 0'); return;
        }
        const canvas = r.node;
        const { createScopedThreejs } = require('threejs-miniprogram');
        const THREE = createScopedThreejs(canvas);

        const dpr = wx.getWindowInfo().pixelRatio || 2;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(dpr, opts.maxDpr || 2));
        renderer.setSize(r.width, r.height, false);
        const bg = opts.background !== undefined ? opts.background : THEME3D.paper;
        renderer.setClearColor(bg, 1);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(bg);

        const camera = new THREE.PerspectiveCamera(
          opts.fov || 42, r.width / r.height, opts.near || 0.01, opts.far || 200
        );
        const cp = opts.cameraPos || [1.45, 1.2, 1.65];
        camera.position.set(cp[0], cp[1], cp[2]);

        const lights = opts.lights !== false
          ? buildPaperLights(THREE, scene, opts.lightOpts)
          : null;

        const env = {
          THREE, scene, camera, renderer, canvas,
          width: r.width, height: r.height, dpr, lights,
          dispose() { try { renderer.dispose(); } catch (e) { /* noop */ } },
        };
        if (opts.onReady) opts.onReady(env);
        resolve(env);
      });
    };
    attempt();
  });
  p.catch(() => {});   // 纯回调用法下吞掉 unhandled rejection 噪音；.then 链不受影响
  return p;
}

// ═══ init2D(page, selector, cb) —— 2D 副图初始化 ═══
// 直接转调 utils/lab-canvas.mount：DPR 初始化后 cb(ctx, w, h, canvas)。
function init2D(page, selector, cb) {
  return require('../../../utils/lab-canvas').mount(page, selector, cb);
}

// ═══ 深空渐变天穹 + 极坐标地面 + 接触光环 ═══
// opts: { groundY, domeRadius, groundScale, ground, halo }
function buildStage(THREE, scene, opts) {
  opts = opts || {};
  const groundY = opts.groundY !== undefined ? opts.groundY : -1.08;
  const gs = opts.groundScale || 1;

  // 天穹：球壳内表面顶点色，视平线上方高斯光晕带
  const R = opts.domeRadius || 60;
  const geo = new THREE.SphereBufferGeometry(R, 32, 20);
  const pos = geo.getAttribute('position');
  const col = [];
  const edge = new THREE.Color(COL.bgEdge);
  const core = new THREE.Color(COL.bgCore);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / R;
    const g = Math.exp(-((t - 0.18) ** 2) / (2 * 0.32 * 0.32));
    c.copy(edge).lerp(core, clamp(g, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  geo.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, depthWrite: false,
  }));
  dome.renderOrder = -10;
  scene.add(dome);

  if (opts.ground !== false) {
    const gridMat = new THREE.LineBasicMaterial({
      color: COL.grid, transparent: true, opacity: 0.20, depthWrite: false,
    });
    for (let k = 1; k <= 5; k++) {
      const rr = (0.42 * k + 0.14) * gs;
      const pts = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rr, groundY, Math.sin(a) * rr));
      }
      scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    const spokes = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spokes.push(new THREE.Vector3(Math.cos(a) * 0.56 * gs, groundY, Math.sin(a) * 0.56 * gs));
      spokes.push(new THREE.Vector3(Math.cos(a) * 2.24 * gs, groundY, Math.sin(a) * 2.24 * gs));
    }
    scene.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(spokes),
      new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.10, depthWrite: false })
    ));
  }

  if (opts.halo !== false) {
    [[0.78, 0.05], [0.52, 0.09], [0.30, 0.14]].forEach(([rr, op]) => {
      const m = new THREE.Mesh(
        new THREE.CircleBufferGeometry(rr * gs, 40),
        new THREE.MeshBasicMaterial({
          color: COL.halo, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = groundY + 0.004;
      scene.add(m);
    });
  }
  return { groundY };
}

// ═══ 三灯：主光暖白 / 轮廓暖金 / 底部青蓝 ═══
function buildLights(THREE, scene, opts) {
  opts = opts || {};
  scene.add(new THREE.AmbientLight(0xfff4e6, opts.ambient !== undefined ? opts.ambient : 0.5));
  const key = new THREE.DirectionalLight(0xfff0d8, opts.key !== undefined ? opts.key : 1.15);
  key.position.set(4, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9a8, opts.rim !== undefined ? opts.rim : 0.85);
  rim.position.set(-3, 2, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x5f7ee0, opts.fill !== undefined ? opts.fill : 0.45);
  fill.position.set(0, -3, -2);
  scene.add(fill);
  return { key, rim, fill };
}

// ═══ 清组（几何+材质都销毁）═══
function clearGroup(g) {
  while (g.children.length) {
    const o = g.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
}

// ═══ 视角 home 存取 + 双击复位 ═══
function saveHome(controls) {
  const t = controls._targetSpherical;
  return { radius: t.radius, phi: t.phi, theta: t.theta };
}

function resetView(controls, home) {
  if (!controls || !home) return;
  const t = controls._targetSpherical;
  t.radius = home.radius;
  t.phi = home.phi;
  t.theta = home.theta;
  try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
}

// ═══ 闲置 3s 自转 ═══
function scheduleIdle(page) {
  if (page._idleT) clearTimeout(page._idleT);
  page._idleT = setTimeout(() => {
    if (page.controls && page.animId) page.controls.autoRotate = true;
  }, 3000);
}

// ═══ 触摸三件套（page 需有 controls/_idleT/_home/_moved/_lastTap/_tapX/_tapY）═══
function touchStart(page, e) {
  if (page.controls) {
    page.controls.autoRotate = false;
    if (page._idleT) { clearTimeout(page._idleT); page._idleT = null; }
    page.controls.onTouchStart(e);
  }
  page._moved = false;
  if (e.touches && e.touches[0]) {
    page._tapX = e.touches[0].clientX;
    page._tapY = e.touches[0].clientY;
  }
}

function touchMove(page, e) {
  if (page.controls) page.controls.onTouchMove(e);
  if (e.touches && e.touches[0]) {
    const dx = e.touches[0].clientX - page._tapX;
    const dy = e.touches[0].clientY - page._tapY;
    if (dx * dx + dy * dy > 36) page._moved = true;   // 6px 阈值
  }
}

function touchEnd(page, e) {
  if (page.controls) page.controls.onTouchEnd(e);
  const now = Date.now();
  if (!page._moved && now - (page._lastTap || 0) < 280) {
    resetView(page.controls, page._home);             // 双击复位
    page._lastTap = 0;
  } else {
    page._lastTap = now;
  }
  scheduleIdle(page);
}

// ═══ 参数重建节流（55ms 窗口合并；apply 缺省调 page.renderAll）═══
function throttle(page, wait, apply) {
  if (page._pt) return;
  page._pt = setTimeout(() => {
    page._pt = null;
    if (apply) apply.call(page); else page.renderAll();
  }, wait || 55);
}

// ═══ 初始化收尾：撤骨架屏 + 提示淡出 + 闲置自转 ═══
function ready(page) {
  page.setData({ glReady: true });
  page._hintT = setTimeout(() => page.setData({ showHint: false }), 2400);
  scheduleIdle(page);
}

// ═══ 页面退出清理 ═══
function clearTimers(page) {
  ['_idleT', '_hintT', '_pt'].forEach(k => {
    if (page[k]) { clearTimeout(page[k]); page[k] = null; }
  });
}

module.exports = {
  // 新版暖纸舞台
  THEME3D, initThree, init2D, buildPaperLights,
  // 兼容保留
  COL, buildStage, buildLights, clearGroup,
  saveHome, resetView, scheduleIdle,
  touchStart, touchMove, touchEnd,
  throttle, ready, clearTimers,
};
