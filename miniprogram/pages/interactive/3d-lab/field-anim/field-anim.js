// pages/interactive/3d-lab/field-anim/field-anim.js —— 电偶极子辐射（全屏 shader，r108）
// 物理内核（Balanis 4-8a，整体常数归一化）：
//   Eθ ∝ sinθ · [ k²·cos τ / r − k·sin τ / r² − cos τ / r³ ]，τ = ωt − kr，k = 2π（λ=1）
//   三项分别为辐射(1/r)、感应(1/r²)、静电(1/r³)；kr=1（r=λ/2π）处辐射与感应项等幅。
// 视觉：暖纸底 + 靛蓝↔赤陶发散色（正负场），叠加 2D 标注层（场区圈/比例尺/色标，lab-canvas 绘制）。
const { createScopedThreejs } = require('threejs-miniprogram');
const haptic = require('../../../../utils/haptic');
const lc = require('../../../../utils/lab-canvas');
const { THEME, alpha, divergeColor } = require('../../../../utils/lab-theme');

// hex → GLSL vec3 字面量（shader 取色与 lab-theme 同源）
function glslColor(hex) {
  const h = String(hex).replace('#', '');
  const f = (i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4);
  return 'vec3(' + f(0) + ',' + f(2) + ',' + f(4) + ')';
}
function hexNum(hex) { return parseInt(String(hex).replace('#', ''), 16); }

Page({
  data: {
    playing: true, playText: '暂停',
    spdSlider: 10, spdVal: '1.0 ×',
    sclSlider: 30, sclVal: '3.0 λ',
    normalize: true, showZones: true,
    fieldMode: 'both',
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, uniforms: null,
  animId: null,
  state: { playing: true, speed: 1.0, scale: 3.0, normalize: true, showZones: true, fieldMode: 'both', time: 0 },
  _ov: null,

  onReady() { this.initThree(); this.initOverlay(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); },
  onShow() { if (this.canvasNode && this.renderer) this.startAnim(); },

  initThree() {
    const sel = wx.createSelectorQuery().in(this);
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      if (!canvas) return;
      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      this.canvasNode = canvas;
      // 全屏逐像素 shader：pixelRatio 固定 1 控制填充率（uRes 即 CSS 尺寸）
      let THREE, renderer;
      try {
        THREE = createScopedThreejs(canvas);
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      } catch (err) {
        console.error('[field-anim] WebGL 初始化失败：', err);
        return;
      }
      this.THREE = THREE;
      renderer.setPixelRatio(1);
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(hexNum(THEME.bgSoft));   // 纸色 0xf3efe6
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.camera = camera;

      const vert = 'void main(){gl_Position=vec4(position.xy,0.,1.);}';

      // 场色：暖纸底 ↔ 正=赤陶 / 负=靛蓝（与 lab-theme 发散色同源）
      const frag = [
        'precision highp float;',
        'uniform float uTime;',
        'uniform vec2 uRes;',
        'uniform float uScale;',
        'uniform float uNorm;',
        'uniform float uMode;',
        'const float TAU=6.28318530718;',
        'const vec3 PAPER=' + glslColor(THEME.bgSoft) + ';',
        'const vec3 POS=' + glslColor(THEME.divergePos) + ';',
        'const vec3 NEG=' + glslColor(THEME.divergeNeg) + ';',
        'const vec3 INK=' + glslColor(THEME.ink) + ';',
        'const vec3 GOLD=' + glslColor(THEME.gold) + ';',
        'vec3 field_color(float v){',
        '  v=clamp(v,-1.0,1.0);',
        '  float a=abs(v);',
        '  float b=a*a*(3.0-2.0*a);',
        '  return (v>=0.0)?mix(PAPER,POS,b):mix(PAPER,NEG,b);',
        '}',
        'void main(){',
        '  vec2 fc=gl_FragCoord.xy;',
        '  vec2 ctr=uRes*0.5;',
        '  float ppl=uRes.y*0.5/uScale;',       // 像素/λ
        '  vec2 w=(fc-ctr)/ppl;',
        '  float x=w.x,z=w.y;',
        '  float r=length(w);',
        '  float armLen=0.25,armW=0.012;',
        '  if(abs(x)<armW&&r<armLen+armW){',    // 偶极臂（墨色）
        '    gl_FragColor=vec4(INK,1.0);',
        '    return;',
        '  }',
        '  if(r<0.03){gl_FragColor=vec4(GOLD,1.0);return;}',  // 馈电点（赭金）
        '  float k=TAU;',                       // λ=1 → k=2π
        '  float kr=k*r;',
        '  float tau=uTime-kr;',                // 推迟相位 τ=ωt−kr
        '  float sinT=abs(x)/max(r,1e-5);',     // 方向因子 sinθ（臂沿竖直）
        '  float rr=max(r,0.045);',
        '  float invR=1.0/rr;',
        '  float radiation=sinT*(k*k*cos(tau)*invR);',              // 1/r 辐射项
        '  float induction=sinT*(-k*sin(tau)*invR*invR);',          // 1/r² 感应项
        '  float electrostatic=sinT*(-cos(tau)*invR*invR*invR);',   // 1/r³ 静电项
        '  float E=radiation+induction+electrostatic;',
        '  if(uMode>1.5){E=radiation;}',
        '  else if(uMode>0.5){E=induction+electrostatic;}',
        '  float disp;',
        '  if(uNorm>0.5){disp=E*r/(k*k);}',     // ×r 振幅补偿（仅显示）
        '  else{disp=E/(k*k*2.0);}',
        '  float v=tanh(disp*2.8);',            // 动态范围压缩（仅显示）
        '  gl_FragColor=vec4(field_color(v),1.0);',
        '}'
      ].join('\n');

      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(cssW, cssH) },
        uScale: { value: this.state.scale },
        uNorm: { value: 1.0 },
        uMode: { value: 0.0 },
      };
      this.uniforms = uniforms;

      scene.add(new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })
      ));

      this.startAnim();
      this.setData({ glReady: true });
    });
  },

  // ── 2D 标注层：场区边界圈 + 1λ 比例尺 + 发散色标（lab-canvas）──
  initOverlay() {
    lc.mount(this, '#fa-overlay', (ctx, w, h) => {
      this._ov = { ctx, w, h };
      this.drawOverlay();
    });
  },

  drawOverlay() {
    if (!this._ov) return;
    const { ctx, w, h } = this._ov;
    const st = this.state;
    ctx.clearRect(0, 0, w, h);
    const ppl = h * 0.5 / st.scale;             // 像素/λ（与 shader 同一定标）
    const cx = w / 2, cy = h / 2;

    // 场区边界（虚线圆 + 文字标注）
    if (st.showZones) {
      const rings = [
        { rl: 1 / (2 * Math.PI), text: 'r = λ/2π', color: THEME.gold },
        { rl: 2, text: 'r = 2λ', color: THEME.teal },
      ];
      rings.forEach((rg) => {
        const rp = rg.rl * ppl;
        if (rp < 10 || rp > Math.hypot(w, h) / 2) return;
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = alpha(rg.color, 0.9);
        ctx.beginPath();
        ctx.arc(cx, cy, rp, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        const lx = cx + rp * 0.7071 + 5;
        const ly = cy - rp * 0.7071 - 5;
        lc.label(ctx, rg.text, Math.min(lx, w - 58), Math.max(ly, 14),
          { color: rg.color, font: THEME.fontLabel });
      });
    }

    // 比例尺（随视野联动，取 0.5/1/2λ 中最合适的）
    let barL = 1;
    if (ppl * barL < 36) barL = 2;
    if (ppl * barL > w * 0.42) barL = 0.5;
    const bw = ppl * barL;
    const bx = 14, by = h - 18;
    ctx.strokeStyle = THEME.inkSoft;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + bw, by - 4); ctx.lineTo(bx + bw, by + 4);
    ctx.stroke();
    lc.label(ctx, (barL === 1 ? '1' : String(barL)) + ' λ', bx + bw / 2, by - 8,
      { align: 'center', color: THEME.inkSoft, font: THEME.fontLabel });

    // 色标：靛蓝（E<0）↔ 纸色 ↔ 赤陶（E>0）
    const cbW = 64, cbH = 8, cbX = w - cbW - 14, cbY = 14;
    for (let i = 0; i < cbW; i++) {
      ctx.fillStyle = divergeColor((i / (cbW - 1)) * 2 - 1);
      ctx.fillRect(cbX + i, cbY, 1.5, cbH);
    }
    ctx.strokeStyle = THEME.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX - 0.5, cbY - 0.5, cbW + 1, cbH + 1);
    lc.label(ctx, '−', cbX - 10, cbY + cbH, { color: THEME.inkSoft, font: THEME.fontLabel });
    lc.label(ctx, '+', cbX + cbW + 4, cbY + cbH, { color: THEME.inkSoft, font: THEME.fontLabel });
    lc.label(ctx, 'Eθ', cbX + cbW / 2, cbY + cbH + 14,
      { align: 'center', color: THEME.muted, font: THEME.fontTick });
  },

  // ── 动画 ──
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    let last = Date.now();
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (this.state.playing) {
        this.state.time += dt * this.state.speed * Math.PI * 2;
        if (this.uniforms) this.uniforms.uTime.value = this.state.time;
      }
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  },

  stopAnim() {
    if (this.animId && this.canvasNode) {
      this.canvasNode.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  dispose() {
    this.stopAnim();
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
  },

  // ── 事件 ──
  onPlay() {
    haptic.light();
    this.state.playing = !this.state.playing;
    this.setData({ playing: this.state.playing, playText: this.state.playing ? '暂停' : '播放' });
  },
  onSpd(e) {
    this.state.speed = e.detail.value / 10;
    this.setData({ spdVal: this.state.speed.toFixed(1) + ' ×' });
  },
  onScl(e) {
    this.state.scale = e.detail.value / 10;
    this.setData({ sclVal: this.state.scale.toFixed(1) + ' λ' });
    if (this.uniforms) this.uniforms.uScale.value = this.state.scale;
    this.drawOverlay();
  },
  onSclChanging(e) { this.onScl(e); },
  onNorm() {
    haptic.light();
    this.state.normalize = !this.state.normalize;
    if (this.uniforms) this.uniforms.uNorm.value = this.state.normalize ? 1 : 0;
    this.setData({ normalize: this.state.normalize });
  },
  onZones() {
    haptic.light();
    this.state.showZones = !this.state.showZones;
    this.setData({ showZones: this.state.showZones });
    this.drawOverlay();
  },
  onMode(e) {
    haptic.light();
    const mode = e.currentTarget.dataset.m;
    this.state.fieldMode = mode;
    const modeVal = mode === 'near' ? 1 : mode === 'far' ? 2 : 0;
    if (this.uniforms) this.uniforms.uMode.value = modeVal;
    this.setData({ fieldMode: mode });
  },

  onShareAppMessage() {
    return { title: '电偶极子辐射动画', path: '/pages/interactive/3d-lab/field-anim/field-anim' };
  },
});
