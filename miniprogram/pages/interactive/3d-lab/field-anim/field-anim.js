// pages/interactive/3d-lab/field-anim/field-anim.js —— 电偶极子辐射 (Shader r108)
const { createScopedThreejs } = require('threejs-miniprogram');

Page({
  data: {
    playing: true, playText: '暂停',
    spdSlider: 10, spdVal: '1.0×',
    sclSlider: 30, sclVal: '3 λ',
    normalize: true, showZones: true,
    fieldMode: 'both',
    glReady: false,
  },

  THREE: null, canvasNode: null, renderer: null, scene: null,
  camera: null, quadMesh: null, uniforms: null,
  animId: null,
  state: { playing: true, speed: 1.0, scale: 3.0, normalize: true, showZones: true, fieldMode: 'both', time: 0 },
  // 触摸交互状态
  _touch: { mode: null, x: 0, y: 0, dist: 0 },
  _offset: { x: 0, y: 0 },  // 平移偏移（波长单位）
  _lastTap: 0,

  onReady() { this.initThree(); },
  onUnload() { this.dispose(); },
  onHide() { this.stopAnim(); },

  initThree() {
    const sel = this.createSelectorQuery();
    sel.select('#three-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const r = res[0];
      const canvas = r.node;
      if (!canvas) return;
      const cssW = r.width, cssH = r.height;
      if (!cssW || !cssH) { setTimeout(() => this.initThree(), 200); return; }

      this.canvasNode = canvas;
      const dpr = wx.getWindowInfo().pixelRatio || 2;

      const THREE = createScopedThreejs(canvas);
      this.THREE = THREE;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      renderer.setPixelRatio(1);
      renderer.setSize(cssW, cssH, false);
      renderer.setClearColor(0x05070f);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.camera = camera;

      // Shader — 计算电偶极子场
      const vert = 'void main(){gl_Position=vec4(position.xy,0.,1.);}';

      const frag = [
        'precision highp float;',
        'uniform float uTime;',
        'uniform vec2 uRes;',
        'uniform float uScale;',
        'uniform float uNorm;',
        'uniform float uMode;',
        'uniform vec2 uOffset;',
        'const float PI=3.14159265359;',
        'const float TAU=6.28318530718;',
        'vec3 field_color(float v){',
        '  v=clamp(v,-1.0,1.0);',
        '  float a=abs(v);',
        '  float b=a*a*(3.0-2.0*a);',
        '  vec3 dark=vec3(0.02,0.025,0.055);',
        '  vec3 red=vec3(1.0,0.22,0.05);',
        '  vec3 blue=vec3(0.08,0.45,1.0);',
        '  vec3 col=(v>=0.0)?mix(dark,red,b):mix(dark,blue,b);',
        '  return col;',
        '}',
        'void main(){',
        '  vec2 fc=gl_FragCoord.xy;',
        '  vec2 ctr=uRes*0.5;',
        '  float ppl=uRes.y*0.5/uScale;',
        '  vec2 w=(fc-ctr)/ppl + uOffset;',
        '  float x=w.x,z=w.y;',
        '  float r=length(w);',
        '  float armLen=0.25,armW=0.012;',
        '  if(abs(x)<armW&&r<armLen+armW){',
        '    float t=abs(z)/(armLen+armW);',
        '    gl_FragColor=vec4(vec3(1.0,0.78,0.2)*mix(1.0,0.5,t),1.0);',
        '    return;',
        '  }',
        '  if(r<0.03){gl_FragColor=vec4(1.0,0.9,0.4,1.0);return;}',
        '  float k=TAU;',
        '  float kr=k*r;',
        '  float tau=uTime-kr;',
        '  float sinT=abs(x)/max(r,1e-5);',
        '  float rr=max(r,0.045);',
        '  float invR=1.0/rr;',
        '  float radiation=sinT*(k*k*cos(tau)*invR);',
        '  float induction=sinT*(-k*sin(tau)*invR*invR);',
        '  float electrostatic=sinT*(-cos(tau)*invR*invR*invR);',
        '  float nearField=induction+electrostatic;',
        '  float farField=radiation;',
        '  float E=nearField+farField;',
        '  if(uMode>1.5){E=farField;}',
        '  else if(uMode>0.5){E=nearField;}',
        '  float disp;',
        '  if(uNorm>0.5){disp=E*r/(k*k);}',
        '  else{disp=E/(k*k*2.0);}',
        '  float v=tanh(disp*2.8);',
        '  vec3 col=field_color(v);',
        '  float edge=1.0-smoothstep(0.82,1.0,',
        '    max(abs(fc.x-ctr.x)/(uRes.x*0.5),abs(fc.y-ctr.y)/(uRes.y*0.5)));',
        '  col*=edge;',
        '  gl_FragColor=vec4(col,1.0);',
        '}'
      ].join('\n');

      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(cssW, cssH) },
        uScale: { value: this.state.scale },
        uNorm: { value: 1.0 },
        uMode: { value: 0.0 },
        uOffset: { value: new THREE.Vector2(0, 0) },
      };
      this.uniforms = uniforms;

      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })
      );
      scene.add(quad);
      this.quadMesh = quad;

      this.startAnim();
      this.setData({ glReady: true });
    });
  },

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

  onTouchStart(e) {
    const touches = e.touches;
    if (touches.length === 1) {
      this._touch.mode = 'pan';
      this._touch.x = touches[0].clientX;
      this._touch.y = touches[0].clientY;
      // 双击检测
      const now = Date.now();
      if (now - this._lastTap < 300) {
        // 双击复位
        this._offset.x = 0; this._offset.y = 0;
        this.state.scale = 3.0;
        if (this.uniforms) {
          this.uniforms.uOffset.value.set(0, 0);
          this.uniforms.uScale.value = 3.0;
        }
        this.setData({ sclSlider: 30, sclVal: '3.0 λ' });
      }
      this._lastTap = now;
    } else if (touches.length === 2) {
      this._touch.mode = 'zoom';
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      this._touch.dist = Math.sqrt(dx * dx + dy * dy);
    }
  },

  onTouchMove(e) {
    const touches = e.touches;
    if (this._touch.mode === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - this._touch.x;
      const dy = touches[0].clientY - this._touch.y;
      this._touch.x = touches[0].clientX;
      this._touch.y = touches[0].clientY;
      // 像素 → 波长偏移（touch 是 CSS 像素，canvas.height 是设备像素）
      const canvas = this.canvasNode;
      if (!canvas) return;
      const dpr = wx.getWindowInfo().pixelRatio || 2;
      const ppl = (canvas.height / 2) / this.state.scale;
      this._offset.x -= dx * dpr / ppl;
      this._offset.y += dy * dpr / ppl;
      if (this.uniforms) this.uniforms.uOffset.value.set(this._offset.x, this._offset.y);
    } else if (this._touch.mode === 'zoom' && touches.length === 2) {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (this._touch.dist > 0) {
        const ratio = this._touch.dist / dist;
        this.state.scale = Math.max(0.8, Math.min(12, this.state.scale * ratio));
        if (this.uniforms) this.uniforms.uScale.value = this.state.scale;
        this.setData({ sclSlider: Math.round(this.state.scale * 10), sclVal: this.state.scale.toFixed(1) + ' λ' });
      }
      this._touch.dist = dist;
    }
  },

  onTouchEnd(e) {
    if (e.touches.length === 0) this._touch.mode = null;
  },

  onPlay() {
    this.state.playing = !this.state.playing;
    this.setData({ playing: this.state.playing, playText: this.state.playing ? '暂停' : '播放' });
  },
  onSpd(e) {
    this.state.speed = e.detail.value / 10;
    this.setData({ spdVal: this.state.speed.toFixed(1) + '×' });
  },
  onScl(e) {
    this.state.scale = e.detail.value / 10;
    this.setData({ sclVal: this.state.scale.toFixed(1) + ' λ' });
    if (this.uniforms) this.uniforms.uScale.value = this.state.scale;
  },
  onSclChanging(e) {
    this.state.scale = e.detail.value / 10;
    this.setData({ sclVal: this.state.scale.toFixed(1) + ' λ' });
    if (this.uniforms) this.uniforms.uScale.value = this.state.scale;
  },
  onNorm() {
    this.state.normalize = !this.state.normalize;
    if (this.uniforms) this.uniforms.uNorm.value = this.state.normalize ? 1 : 0;
    this.setData({ normalize: this.state.normalize });
  },
  onZones() {
    this.state.showZones = !this.state.showZones;
    this.setData({ showZones: this.state.showZones });
  },
  onMode(e) {
    const mode = e.currentTarget.dataset.m;
    this.state.fieldMode = mode;
    const modeVal = mode === 'near' ? 1 : mode === 'far' ? 2 : 0;
    if (this.uniforms) this.uniforms.uMode.value = modeVal;
    this.setData({ fieldMode: mode });
  },
});
