export class GeoGebraManager {
  constructor(containerId = 'ggbApplet') {
    this.containerId = containerId;
    this.ggbApplet = null;
    this.mode = '2D';
    this.isReady = false;
    this._readyTimer = null;
  }

  async init(mode = '2D') {
    this.mode = mode;
    this.isReady = false;

    const wrapper = document.getElementById(this.containerId);
    if (!wrapper) throw new Error(`GeoGebra 容器 ${this.containerId} 未找到`);
    wrapper.innerHTML = '';

    const cfg = {
      appName: mode === '3D' ? '3d' : 'classic',
      width: wrapper.clientWidth,
      height: Math.max(window.innerHeight * 0.6, 420),
      showToolBar: true,
      showAlgebraInput: true,
      language: 'zh-CN',
      showResetIcon: true,
      enableLabelDrags: true,
      enableShiftDragZoom: true,
      enableRightClick: true,
      showMenuBar: true,
      errorDialogsActive: true,
      preventFocus: false,
      useBrowserForJS: false
    };

    this.ggbApplet = new GGBApplet(cfg, "5.0");
    this.ggbApplet.inject(this.containerId);

    return this._waitForReady();
  }

  _waitForReady(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      this._readyTimer = setInterval(() => {
        if (this.ggbApplet && this.ggbApplet.isInitialized()) {
          clearInterval(this._readyTimer);
          this.isReady = true;
          this.fitViewport();
          resolve(this);
          return;
        }
        if (Date.now() - start > timeout) {
          clearInterval(this._readyTimer);
          reject(new Error('GeoGebra 初始化超时')); 
        }
      }, 150);
    });
  }

  fitViewport() {
    if (!this.isReady) return;
    this.ggbApplet.showAllObjects();
  }

  setSize(width, height) {
    if (!this.isReady) return;
    this.ggbApplet.setSize(width, height);
  }

  async evalCommand(command) {
    if (!this.isReady) throw new Error('GeoGebra 未就绪');
    return this.ggbApplet.evalCommand(command);
  }

  async evalCommands(commands) {
    if (!this.isReady) throw new Error('GeoGebra 未就绪');
    const lines = commands.split('\n').map(l => l.trim()).filter(Boolean);
    let success = true;
    for (const line of lines) {
      const result = this.ggbApplet.evalCommand(line);
      if (result === false || result === 'false') {
        console.warn('命令执行失败', line);
        success = false;
      }
    }
    return success;
  }

  getAllObjectNames() {
    if (!this.isReady) return [];
    try {
      const objects = this.ggbApplet.getAllObjectNames();
      return Array.isArray(objects) ? objects : objects.split(',').map(s => s.trim()).filter(Boolean);
    } catch (err) {
      console.error('获取对象列表失败', err);
      return [];
    }
  }

  clear() {
    if (!this.isReady) return;
    this.ggbApplet.reset();
  }

  getXML() {
    if (!this.isReady) return '';
    return this.ggbApplet.getXML();
  }

  setXML(xml) {
    if (!this.isReady) return;
    this.ggbApplet.setXML(xml);
  }

  exportSVG(filename = `geogebra-${Date.now()}.svg`) {
    if (!this.isReady) return;
    this.ggbApplet.exportSVG(svg => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();
    });
  }

  async exportPNG(filename = `geogebra-${Date.now()}.png`) {
    if (!this.isReady) return;
    const data = this.ggbApplet.getPNGBase64();
    if (!data) return;
    const img = data.replace(/^data:image\/png;base64,/, '');
    const byteChars = atob(img);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  setAxesVisible(visible = true) {
    if (!this.isReady) return;
    this.ggbApplet.setAxesVisible(1, visible, visible, true);
  }

  setGridVisible(visible = true) {
    if (!this.isReady) return;
    this.ggbApplet.setGridVisible(1, visible);
  }

  setCoordSystem(xmin, xmax, ymin, ymax, zmin, zmax, yVertical = false) {
    if (!this.isReady) return;
    if (this.mode === '3D') {
      this.ggbApplet.setCoordSystem(xmin, xmax, ymin, ymax, zmin, zmax, yVertical);
    } else {
      this.ggbApplet.setCoordSystem(xmin, xmax, ymin, ymax);
    }
  }

  setAnimation(objName, flag = true) {
    if (!this.isReady) return;
    this.ggbApplet.setAnimating(objName, flag);
  }

  startAnimation() {
    if (!this.isReady) return;
    this.ggbApplet.startAnimation();
  }

  stopAnimation() {
    if (!this.isReady) return;
    this.ggbApplet.stopAnimation();
  }

  registerAddListener(fn) {
    this.ggbApplet?.registerAddListener(fn);
  }

  registerRemoveListener(fn) {
    this.ggbApplet?.registerRemoveListener(fn);
  }

  registerUpdateListener(fn) {
    this.ggbApplet?.registerUpdateListener(fn);
  }
}