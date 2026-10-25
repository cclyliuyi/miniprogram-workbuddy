// TE10 矩形角锥喇叭：长度均以 λ 归一化，采用可分离二次口径相位。
// 来源：Baltzis, PIER 108 (2010), Eqs. (1)–(4), doi:10.2528/PIER10072309。
// 固定馈电波导 a=0.75λ, b=0.375λ（该频率下仅 TE10 传播）。
// δ(x,y)=π(x²/ρH+y²/ρE)，ρH=RA/(A−a), ρE=RB/(B−b)。
const { registerOrbitControls } = require('../orbit-controls');
const stage = require('../lab3d-stage');
const lc = require('../pkg-utils/lab-canvas');
const { THEME } = require('../pkg-utils/lab-theme');

const ASTEP = 1;        // 方向图角度步长（°），−90..90
const SCALE = 0.12;     // 场景缩放：1λ = 0.12 单位

const visual = require('../pkg-utils/lab3d-visual');
Page({
  data: {
    labView: 'perspective', autoRotate: false, phaseMode:'wrapped', phaseMax:'—',
    aSlider: 52, aVal: '5.2 λ',
    lSlider: 80, lVal: '8.0 λ',
    bSlider: 42, bVal: '4.2 λ', optimum: '', modelNote: '', efficiency: '',
    phase: '—', gain: '—', flare: '—', hpbw: '—',
    showHint: true,
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, controls: null, root: null,
  hornGroup: null, phaseGroup: null,
  animId: null,
  state: { A: 5.2, B: 4.2, R: 8 },
  plotCtx: null, plotW: 0, plotH: 0,
  lastKey: '', _cache: null,

  onLoad() { this.renderAll(); },   // 读数先行，避免首帧占位符
  onReady() {
    this.initThree();
    stage.init2D(this, '#plot', (ctx, w, h) => {
      this.plotCtx = ctx; this.plotW = w; this.plotH = h;
      this.drawPlot(this.compute());
    });
  },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); stage.clearTimers(this); },
  onShow() { if (this.canvasNode && this.renderer) { this.startAnim(); stage.scheduleIdle(this); } },

  initThree() {
    stage.initThree(this, '#three-canvas', {
      cameraPos: [1.15, 0.9, 1.55],
      onReady: (env) => {
        const THREE = env.THREE;
        registerOrbitControls(THREE);
        this.THREE = THREE;
        this.canvasNode = env.canvas;
        this.renderer = env.renderer;
        this.scene = env.scene;
        this.camera = env.camera;

        const controls = new THREE.OrbitControls(this.camera, env.canvas);
        controls.enableDamping = true;
        controls.autoRotateSpeed = 1.0;
        controls.target.set(0, 0, 0.1);
        controls.update();
        this.controls = controls;
        this._home = stage.saveHome(controls);

        const root = new THREE.Group();
        this.scene.add(root);
        this.root = root;
        this.hornGroup = new THREE.Group();
        this.phaseGroup = new THREE.Group();
        root.add(this.hornGroup, this.phaseGroup);

        this.lastKey = '';       // 强制首次搭建
        this.renderAll();
        this.startAnim();
        stage.ready(this);
      },
    });
  },

  // ═══════════════ 物理：口径积分（无魔法系数）═══════════════
  // 口径分布 g(u)，u ∈ [−1,1]
  gDist(plane, u, p) {
    return plane === 'H' ? Math.cos(Math.PI * u / 2) : 1;
  },

  // ∫₋₁¹ g(u)·exp(j[πA·u·sinθ − δmax·u²]) du 的模（梯形积分）
  apInt(plane, sinTh, A, dMax, p, N) {
    const du = 2 / N;
    let re = 0, im = 0;
    for (let i = 0; i <= N; i++) {
      const u = -1 + i * du;
      const w = (i === 0 || i === N) ? 0.5 : 1;
      const g = this.gDist(plane, u, p);
      const ph = Math.PI * A * u * sinTh - dMax * u * u;
      re += w * g * Math.cos(ph);
      im += w * g * Math.sin(ph);
    }
    return Math.hypot(re, im) * du;
  },

  // 仅为以轴向为峰值的主瓣报告宽度；分裂主瓣不能套用对称半宽。
  hpbwOf(ang, db) {
    const mid = (ang.length - 1) / 2;
    if (db[mid] < -0.05) return null;
    for (let j = mid + 1; j < db.length; j++) {
      if (db[j] <= -3.01029995664) {
        const t = (-3.01029995664 - db[j-1]) / (db[j] - db[j-1]);
        return 2 * (ang[j-1] + t * (ang[j]-ang[j-1]));
      }
    }
    return null;
  },

  planeModel(plane, width, R) {
    const throat = plane === 'H' ? 0.75 : 0.375;
    const rho = R * width / (width - throat);
    const edge = width * width / (8 * rho);
    const dMax = 2 * Math.PI * edge;
    const N = Math.max(128, Math.ceil(12 * (Math.PI * width + 2 * dMax)));
    // ∫g²du：均匀为 2，纯余弦为 1。
    const eta = this.apInt(plane, 0, width, dMax, 0, N) ** 2 / (plane === 'H' ? 2 : 4);
    return {rho, edge, dMax, N, eta, phaseDeg:360*edge,
      flare:Math.atan((width-throat)/(2*R))*180/Math.PI};
  },

  beamReading(plane, width, m) {
    const db=plane==='E'?m.eDb:m.hDb, mid=(db.length-1)/2;
    const dip=Math.max(0,-db[mid]);
    let peak=mid;
    for(let i=mid+1;i<db.length;i++) if(db[i]>db[peak]+1e-9) peak=i;
    let label='轴向单峰';
    // 显示分级，不是电磁学的分裂临界条件；浅双峰不夸大为明显分裂。
    if(peak!==mid && dip>1e-6) {
      label=dip<1?'近似平顶（浅双峰）':dip<3?'双峰趋势':'明显分裂';
    } else {
      const raw=m.ang.map(deg=>{
        const th=deg*Math.PI/180;
        return (1+Math.cos(th))/2*this.apInt(plane,Math.sin(th),width,0,0,256);
      });
      const mx=Math.max(...raw);
      const ideal=this.hpbwOf(m.ang,raw.map(v=>20*Math.log10(Math.max(v/mx,1e-6))));
      const actual=plane==='E'?m.hpbwE:m.hpbwH;
      if(ideal && actual && actual>ideal*1.2) label='轴向单峰 · 展宽';
    }
    return {label,detail:`轴向低于峰值 ${dip.toFixed(2)} dB`+
      (peak!==mid?` · 峰位约 ±${m.ang[peak]}°`:' · 峰位 0°')};
  },

  // 在本页可调网格 2..16λ / 0.2λ 内，固定轴长及波导，最大化轴向 D。
  // D 可分离为常数 × (AηH)(BηE)，因此独立遍历两轴等价于遍历二维网格。
  optimalDimensions(R) {
    if (this._optimal && this._optimal.R === R) return this._optimal;
    const pick = plane => {
      let best = {width:2, score:-1};
      for (let i=20;i<=160;i+=2) {
        const width=i/10, m=this.planeModel(plane,width,R);
        if (width*m.eta>best.score) best={width,score:width*m.eta};
      }
      return best;
    };
    const h=pick('H'), e=pick('E');
    return (this._optimal={R,A:h.width,B:e.width,gain:10*Math.log10(4*Math.PI*h.score*e.score)});
  },
  useOptimal() {
    const o=this.optimalDimensions(this.state.R);
    this.state.A=o.A; this.state.B=o.B;
    this.renderAll();
  },
  phaseAt(m,x,y) { return 180*(x*x/m.h.rho+y*y/m.e.rho); },
  phaseFraction(phase,mode) {
    // 两种映射都与本图最大值无关。累计模式为固定非线性色标，不截断。
    return mode==='wrapped' ? ((phase/360)%1+1)%1 : 2/Math.PI*Math.atan(phase/180);
  },
  compute() {
    const {A,B,R}=this.state;
    const key=[A,B,R].join('|');
    if(this._cache && this._cache.key===key) return this._cache;
    const h=this.planeModel('H',A,R), e=this.planeModel('E',B,R);
    const ang=[],eRaw=[],hRaw=[];
    for(let deg=-90;deg<=90;deg+=ASTEP){
      const th=deg*Math.PI/180, el=(1+Math.cos(th))/2;
      ang.push(deg);
      eRaw.push(el*this.apInt('E',Math.sin(th),B,e.dMax,0,e.N));
      hRaw.push(el*this.apInt('H',Math.sin(th),A,h.dMax,0,h.N));
    }
    const toDb=arr=>{const mx=Math.max(...arr)||1;return arr.map(v=>Math.max(-60,20*Math.log10(Math.max(v/mx,1e-6))));};
    const eDb=toDb(eRaw),hDb=toDb(hRaw);
    return (this._cache={key,h,e,phaseDeg:Math.max(e.phaseDeg,h.phaseDeg),
      corner:e.phaseDeg+h.phaseDeg,etaE:e.eta,etaH:h.eta,
      gain:10*Math.log10(4*Math.PI*A*B*e.eta*h.eta),ang,eDb,hDb,
      hpbwE:this.hpbwOf(ang,eDb),hpbwH:this.hpbwOf(ang,hDb)});
  },

  // ═══════════════ 3D 几何（材质色一律取 stage.THEME3D / lab-theme）═══════════════
  layout3d(m) {
    const THREE = this.THREE;
    if (!THREE) return;
    const C = stage.THEME3D;
    const S = this.state;
    stage.clearGroup(this.hornGroup);
    stage.clearGroup(this.phaseGroup);

    const ap = S.A * SCALE, bp = S.B * SCALE, R = S.R * SCALE, th = 0.26 * SCALE;
    const thr = 0.75 * SCALE, thrB = 0.375 * SCALE;
    const z0 = -R / 2, z1 = R / 2;

    // ── 喇叭壁 · 赭金 ──
    const pts = [
      [-thr / 2, -thrB / 2, z0], [thr / 2, -thrB / 2, z0],
      [thr / 2, thrB / 2, z0], [-thr / 2, thrB / 2, z0],
      [-ap / 2, -bp / 2, z1], [ap / 2, -bp / 2, z1],
      [ap / 2, bp / 2, z1], [-ap / 2, bp / 2, z1]
    ].map((q) => new THREE.Vector3(q[0], q[1], q[2]));

    const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const posArr = [];
    faces.forEach((f) => {
      const [a, b, c, d] = f;
      [[a, b, c], [a, c, d]].forEach((t) => t.forEach((i) => {
        posArr.push(pts[i].x, pts[i].y, pts[i].z);
      }));
    });
    const geo = new THREE.BufferGeometry();
    geo.addAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));  // r108 API
    geo.computeVertexNormals();
    this.hornGroup.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xc4a16c, metalness: 0.55, roughness: 0.38,
      side: THREE.DoubleSide,
    })));

    // 棱线 + 口径边框 · 暖灰/赤陶勾边
    const edgeLines = [];
    [0, 1, 2, 3].forEach((i) => { edgeLines.push(pts[i], pts[i + 4]); });
    this.hornGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(edgeLines),
      new THREE.LineBasicMaterial({ color: C.warmGray, transparent: true, opacity: 0.8 })
    ));
    this.hornGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([pts[4], pts[5], pts[6], pts[7]]),
      new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.9 })
    ));

    visual.rim(THREE,this.hornGroup,[[-ap/2,-bp/2,z1],[ap/2,-bp/2,z1],[ap/2,bp/2,z1],[-ap/2,bp/2,z1]],.014,0xc4a16c);
    visual.rim(THREE,this.hornGroup,[[-thr*.7,-thrB*.7,z0],[thr*.7,-thrB*.7,z0],[thr*.7,thrB*.7,z0],[-thr*.7,thrB*.7,z0]],.018,0x536776);
    // ── 喉部（馈电波导段）· 暖灰 ──
    const throat = new THREE.Mesh(
      new THREE.BoxGeometry(thr * 0.82, thrB * 0.82, th),
      new THREE.MeshStandardMaterial({ color: C.warmGray, metalness: 0.3, roughness: 0.6 })
    );
    throat.position.z = z0 - th * 0.55;
    this.hornGroup.add(throat);

    // 口径相位与方向图共用二次近似；累计模式不截断，周期模式使用闭合色环。
    const SEG = this.data.phaseMode==='wrapped' ? Math.min(512, Math.max(64, Math.ceil(m.phaseDeg / 360 * 48))) : 64;
    const pg = new THREE.PlaneBufferGeometry(ap, bp, SEG, SEG);
    const ppos = pg.getAttribute('position');
    const col = [];
    for (let i = 0; i < ppos.count; i++) {
      const phase = this.phaseAt(m,ppos.getX(i)/SCALE,ppos.getY(i)/SCALE);
      const fraction=this.phaseFraction(phase,this.data.phaseMode);
      const c = this.data.phaseMode==='wrapped'
        ? new THREE.Color().setHSL(fraction,0.78,0.50)
        : new THREE.Color(visual.heatColor(fraction));
      col.push(c.r, c.g, c.b);
    }
    pg.addAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const apertureMesh = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({
      vertexColors: THREE.VertexColors, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    }));
    apertureMesh.position.z = z1 + 0.012;
    this.phaseGroup.add(apertureMesh);
  },

  // ═══════════════ 动画（仅阻尼/自转，无装饰性假动画）═══════════════
  startAnim() {
    if (this.animId || !this.canvasNode) return;
    const tick = () => {
      this.animId = this.canvasNode.requestAnimationFrame(tick);
      this.controls.update();
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
    stage.clearTimers(this);
    if (this.scene) stage.clearGroup(this.scene);
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    if (this.controls) { this.controls.dispose(); this.controls = null; }
  },

  onTouchStart(e) { stage.touchStart(this, e); },
  onTouchMove(e) { stage.touchMove(this, e); },
  onTouchEnd(e) { stage.touchEnd(this, e); },

  // ═══════════════ 参数：拖动节流 + 松手精修 ═══════════════
  onAChanging(e) { this.state.A = e.detail.value / 10; stage.throttle(this); },
  onRChanging(e) { this.state.R = e.detail.value / 10; stage.throttle(this); },
  onBChanging(e) { this.state.B = e.detail.value / 10; stage.throttle(this); },
  onA(e) { this.state.A = e.detail.value / 10; this.renderAll(); },
  onR(e) { this.state.R = e.detail.value / 10; this.renderAll(); },
  onB(e) { this.state.B = e.detail.value / 10; this.renderAll(); },

  fmtHpbw(v) { return v == null ? '—' : v.toFixed(1) + '°'; },

  setPhaseMode(e) { this.setData({phaseMode:e.currentTarget.dataset.mode},()=>this.renderAll()); },
  renderAll() {
    const S = this.state;
    const m = this.compute();
    const o=this.optimalDimensions(S.R);
    const eBeam=this.beamReading('E',S.B,m), hBeam=this.beamReading('H',S.A,m);
    const difference=(v,best)=>Math.abs(v-best)<1e-6?'等于最佳口径':`${v>best?'大于':'小于'}最佳 ${(Math.abs(v-best)).toFixed(1)}λ`;
    this.setData({
      eBeam:eBeam.label, eBeamDetail:eBeam.detail,
      hBeam:hBeam.label, hBeamDetail:hBeam.detail,
      apertureDifference:`H 面 A：${difference(S.A,o.A)}；E 面 B：${difference(S.B,o.B)}`,
      optimalLoss:Math.max(0,o.gain-m.gain).toFixed(2)+' dB',
      aSlider:Math.round(S.A*10), bSlider:Math.round(S.B*10), lSlider:Math.round(S.R*10),
      bVal:S.B.toFixed(1)+' λ',
      optimum:`A=${o.A.toFixed(1)}λ · B=${o.B.toFixed(1)}λ · D≈${o.gain.toFixed(1)} dBi`,
      efficiency:(100*m.etaE*m.etaH).toFixed(1)+' %',
      modelNote:Math.max(m.e.flare,m.h.flare)>25 ? '当前张角较大：以下是二次相位模型的外推，仅供观察趋势，工程设计需全波验证。' : 'TE₁₀ 二次相位口径近似；未计反射、损耗、高次模和边缘绕射。',
      aVal: S.A.toFixed(1) + ' λ',
      lVal: S.R.toFixed(1) + ' λ',

      phase: m.e.phaseDeg.toFixed(0)+'° / '+m.h.phaseDeg.toFixed(0)+'°',
      phaseMax: m.corner.toFixed(0)+'°',
      gain: m.gain.toFixed(1) + ' dBi',
      flare:m.e.flare.toFixed(1)+'° / '+m.h.flare.toFixed(1)+'°',
      hpbw: this.fmtHpbw(m.hpbwE) + ' / ' + this.fmtHpbw(m.hpbwH),
    });
    const key = m.key+'|'+this.data.phaseMode;
    if (key !== this.lastKey) {
      this.layout3d(m);
      this.lastKey = key;
    }
    this.drawPlot(m);
  },

  // ═══════════════ 2D 方向图（lab-canvas 纸底 · 坐标轴 + 刻度 + 图例）═══════════════
  drawPlot(m) {
    if (!this.plotCtx) return;
    if (!m) m = this.compute();
    const ctx = this.plotCtx, w = this.plotW, h = this.plotH;
    lc.clear(ctx, w, h);
    const box = { x: 46, y: 24, w: w - 60, h: h - 66 };
    const p = lc.plot(ctx, box, [-90, 90], [-45, 0]);
    p.axes({
      xTicks: [-90, -60, -30, 0, 30, 60, 90],
      yTicks: [-40, -30, -20, -10, 0],
      xFmt: (v) => v + '°',
      xLabel: 'θ（°）',
      yLabel: '归一化电平（dB）',
    });
    p.area(m.ang, m.eDb, THEME.accent, -45);
    p.line(m.ang, m.eDb, THEME.accent, 2);
    p.line(m.ang, m.hDb, THEME.teal, 2);
    p.guideY(-3);
    lc.label(ctx, '−3 dB', box.x + box.w - 4, p.Y(-3) - 4, {
      align: 'right', color: THEME.muted, font: THEME.fontTick,
    });
    lc.legend(ctx, [
      { name: 'E 面（均匀分布）', color: THEME.accent },
      { name: 'H 面（TE₁₀ 余弦）', color: THEME.teal },
    ], box.x, h - 12);
  },

  onLabView(e) { visual.fitView(this,e.currentTarget.dataset.view); this._home=stage.saveHome(this.controls); },
  onLabRotate() { const value=!this.data.autoRotate; this.setData({autoRotate:value}); if(this.controls)this.controls.autoRotate=value; },
  onShareAppMessage() {
    return { title: '喇叭天线 3D 实验室', path: '/pages/interactive/3d-lab/horn/horn' };
  },
});
