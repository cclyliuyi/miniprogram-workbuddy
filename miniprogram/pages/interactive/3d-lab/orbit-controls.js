// pages/interactive/radiation-3d/orbit-controls.js
// 小程序版 OrbitControls — 球面坐标 + 触摸手势 + 阻尼

/**
 * 向 THREE 注册 OrbitControls 类
 * 使用方式：registerOrbitControls(THREE) → new THREE.OrbitControls(camera, canvas)
 *
 * 手势：
 *  - 单指拖动 → 旋转（方位角/俯仰角）
 *  - 双指捏合 → 缩放（半径）
 *  - 双指拖动 → 平移（此版本禁用）
 */
function registerOrbitControls(THREE) {

  if (THREE.OrbitControls) return;

  const { Vector3, Quaternion, Spherical } = THREE;

  class OrbitControls {
    constructor(camera, canvas) {
      this.camera = camera;
      this.canvas = canvas;

      // 球面坐标
      this._spherical = new Spherical();
      this._targetSpherical = new Spherical();

      // 从初始相机位置提取球面坐标
      this._offset = new Vector3();
      this._offset.copy(camera.position);

      // 公开属性 target（兼容 Three.js OrbitControls API）
      // 页面代码用 controls.target.set(x, y, z) 设置观察中心
      this.target = new Vector3(0, 0, 0);
      this._offset.sub(this.target);

      this._spherical.setFromVector3(this._offset);
      // 防护：相机在原点时 radius=0 / phi=NaN，给安全默认值
      if (!this._spherical.radius || this._spherical.radius < 1e-6) {
        this._spherical.set(3.5, Math.PI / 3, Math.PI / 4);
      }
      if (isNaN(this._spherical.phi)) this._spherical.phi = Math.PI / 3;
      if (isNaN(this._spherical.theta)) this._spherical.theta = Math.PI / 4;
      this._targetSpherical.copy(this._spherical);

      // 参数
      this.minDistance = 1.2;
      this.maxDistance = 8;
      this.minPolarAngle = 0.1;
      this.maxPolarAngle = Math.PI - 0.1;

      // 阻尼
      this.enableDamping = true;
      this.dampingFactor = 0.08;

      // 旋转灵敏度
      this.rotateSpeed = 0.006;
      this.zoomSpeed = 1.0;

      // 自动旋转
      this.autoRotate = false;
      this.autoRotateSpeed = 1.2;
      this._autoRotateAngle = 0;

      // 触摸状态
      this._touchState = null;

      // 是否需要在 update 中平移（此版本禁用）
      this.enablePan = false;
    }

    /**
     * 处理 touchstart 事件
     * e 是微信 bindtouchstart 事件对象
     */
    onTouchStart(e) {
      const touches = e.touches;
      if (touches.length === 1) {
        this._touchState = {
          mode: 'rotate',
          x: touches[0].clientX,
          y: touches[0].clientY,
        };
      } else if (touches.length === 2) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        this._touchState = {
          mode: 'zoom',
          dist: Math.sqrt(dx * dx + dy * dy),
        };
      }
    }

    /**
     * 处理 touchmove 事件
     */
    onTouchMove(e) {
      if (!this._touchState) return;
      const touches = e.touches;

      if (this._touchState.mode === 'rotate' && touches.length === 1) {
        const dx = touches[0].clientX - this._touchState.x;
        const dy = touches[0].clientY - this._touchState.y;

        this._targetSpherical.theta -= dx * this.rotateSpeed;
        this._targetSpherical.phi -= dy * this.rotateSpeed;

        // 限制 phi
        this._targetSpherical.phi = Math.max(this.minPolarAngle,
          Math.min(this.maxPolarAngle, this._targetSpherical.phi));

        this._touchState.x = touches[0].clientX;
        this._touchState.y = touches[0].clientY;
      } else if (this._touchState.mode === 'zoom' && touches.length === 2) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const prevDist = this._touchState.dist;
        if (prevDist > 0) {
          // 比例缩放：手指距离变化比，体验更自然
          const scale = prevDist / dist;
          this._targetSpherical.radius *= Math.pow(scale, this.zoomSpeed);
          this._targetSpherical.radius = Math.max(this.minDistance,
            Math.min(this.maxDistance, this._targetSpherical.radius));
        }
        this._touchState.dist = dist;
      }
    }

    /**
     * 处理 touchend 事件
     */
    onTouchEnd(e) {
      const touches = e.touches || [];
      if (touches.length === 1) {
        // 双指→单指：平滑过渡到旋转模式
        this._touchState = {
          mode: 'rotate',
          x: touches[0].clientX,
          y: touches[0].clientY,
        };
      } else {
        this._touchState = null;
      }
    }

    /**
     * 每帧更新 — 由动画循环调用
     */
    update() {
      // 自动旋转
      if (this.autoRotate) {
        this._autoRotateAngle = this.autoRotateSpeed * 0.016;
        this._targetSpherical.theta -= this._autoRotateAngle;
      }

      // 阻尼插值
      if (this.enableDamping) {
        this._spherical.theta += (this._targetSpherical.theta - this._spherical.theta) * this.dampingFactor;
        this._spherical.phi += (this._targetSpherical.phi - this._spherical.phi) * this.dampingFactor;
        this._spherical.radius += (this._targetSpherical.radius - this._spherical.radius) * this.dampingFactor;
      } else {
        this._spherical.copy(this._targetSpherical);
      }

      // 将球面坐标转回相机位置
      this._offset.setFromSpherical(this._spherical);
      this.camera.position.copy(this.target).add(this._offset);
      this.camera.lookAt(this.target);
    }

    /**
     * 销毁
     */
    dispose() {
      this._touchState = null;
      this.camera = null;
      this.canvas = null;
    }

    /**
     * 从外部设置的 camera.position 重新同步内部球面坐标
     * 用于页面代码在 _camInit 中动态计算相机位置后调用
     */
    syncFromCamera() {
      this._offset.copy(this.camera.position).sub(this.target);
      this._spherical.setFromVector3(this._offset);
      if (!this._spherical.radius || this._spherical.radius < 1e-6) {
        this._spherical.set(3.5, Math.PI / 3, Math.PI / 4);
      }
      if (isNaN(this._spherical.phi)) this._spherical.phi = Math.PI / 3;
      if (isNaN(this._spherical.theta)) this._spherical.theta = Math.PI / 4;
      // 钳制到合法范围
      this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));
      this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));
      this._targetSpherical.copy(this._spherical);
    }

    /**
     * 重置视角
     */
    reset() {
      this._targetSpherical.set(3.5, Math.PI / 3, Math.PI / 4);
    }
  }

  THREE.OrbitControls = OrbitControls;
}

module.exports = { registerOrbitControls };
