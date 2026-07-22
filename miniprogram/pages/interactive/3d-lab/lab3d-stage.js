// pages/interactive/3d-lab/lab3d-stage.js —— 深空暖金实验室 · 公共舞台模块
// 用法：
//   const stage = require('../lab3d-stage');          // radiation-3d 用 './3d-lab/lab3d-stage'
//   stage.buildStage(THREE, scene, { groundY: -1.08 });
//   stage.buildLights(THREE, scene);
//   this._home = stage.saveHome(this.controls);        // 相机定位后存 home 视角
//   onTouchStart(e) { stage.touchStart(this, e); }     // 触摸三件套
//   onXChanging(e) { this.state.x = e.detail.value/10; this.setData({xVal:...}); stage.throttle(this); }

// ── 深空暖金色板 ──
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
  COL, buildStage, buildLights, clearGroup,
  saveHome, resetView, scheduleIdle,
  touchStart, touchMove, touchEnd,
  throttle, ready, clearTimers,
};
