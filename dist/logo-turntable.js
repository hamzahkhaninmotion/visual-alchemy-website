// <logo-turntable src="path/to/model.glb"> — gold 3D logo that spins on page scroll (turntable).
// Falls back to a blocky gold "HK" placeholder if the GLB is missing.
(() => {
  if (customElements.get('logo-turntable')) return;
  const THREE_URL = 'https://esm.sh/three@0.160.0';
  customElements.define('logo-turntable', class extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      if (!this.style.display) this.style.display = 'block';
      if (!this.style.height) this.style.height = '100%';
      this._init().catch(e => console.warn('logo-turntable:', e));
    }
    disconnectedCallback() { this._dispose && this._dispose(); }
    _placeholder(THREE) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc8a164, metalness: 1, roughness: 0.28 });
      const g = new THREE.Group();
      const bar = (w, h, x, y, rz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), mat);
        m.position.set(x, y, 0); m.rotation.z = rz || 0; g.add(m);
      };
      bar(0.42, 2.2, -1.55, 0); bar(0.42, 2.2, -0.55, 0); bar(0.62, 0.4, -1.05, 0); // H
      bar(0.42, 2.2, 0.45, 0); bar(0.42, 1.4, 1.15, 0.6, -0.72); bar(0.42, 1.4, 1.15, -0.6, 0.72); // K
      return g;
    }
    async _init() {
      const THREE = await import(THREE_URL);
      const { RoomEnvironment } = await import(THREE_URL + '/examples/jsm/environments/RoomEnvironment.js');
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
      this.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff2d0, 2.2); key.position.set(3, 4, 5); scene.add(key);
      const attr = n => { const v = this.getAttribute(n); return (v == null || v === '') ? this.getAttribute(n.replace(/-/g, '')) : v; };
      const num = (n, d) => { const v = parseFloat(attr(n)); return isNaN(v) ? d : v; };
      const placeLight = () => {
        const az = num('light-angle', 35) * Math.PI / 180;
        const el = num('light-elevation', 40) * Math.PI / 180;
        key.position.set(7 * Math.cos(el) * Math.sin(az), 7 * Math.sin(el), 7 * Math.cos(el) * Math.cos(az));
        key.intensity = num('light-intensity', 2.2);
      };
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0.15, 4.4);
      camera.lookAt(0, 0, 0);

      let obj = null;
      const src = this.getAttribute('src');
      if (src) {
        try {
          const { GLTFLoader } = await import(THREE_URL + '/examples/jsm/loaders/GLTFLoader.js');
          obj = (await new GLTFLoader().loadAsync(src)).scene;
        } catch (e) { /* no GLB yet — placeholder below */ }
      }
      if (!obj) obj = this._placeholder(THREE);
      else {
        // match the logo-reveal video's brushed gold regardless of exported materials
        const gold = this.getAttribute('gold-color') || '#c8a164';
        if (gold !== 'off') obj.traverse(n => {
          if (n.isMesh && n.material) {
            n.material.color = new THREE.Color(gold);
            if ('metalness' in n.material) { n.material.metalness = 1; n.material.roughness = 0.3; }
          }
        });
      }

      // center + normalize size
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const pivot = new THREE.Group();
      pivot.add(obj);
      pivot.scale.setScalar(2.4 / Math.max(size.x, size.y, size.z, 0.001));
      scene.add(pivot);

      // rotation maps page scroll progress (0→1) onto [rot-start, rot-end] degrees
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const calcTarget = () => {
        const rs = num('rot-start', 0);
        const reAttr = attr('rot-end');
        const re = (reAttr == null || reAttr === '') ? rs + 360 : (parseFloat(reAttr) || 0);
        if (reduce) return rs * Math.PI / 180;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const p = Math.min(1, Math.max(0, (window.scrollY || 0) / max));
        return (rs + p * (re - rs)) * Math.PI / 180;
      };
      pivot.rotation.y = calcTarget();

      const ro = new ResizeObserver(() => {
        const w = this.clientWidth || 300, h = this.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(this);

      let raf;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        pivot.rotation.y += (calcTarget() - pivot.rotation.y) * 0.08; // vertical-axis turntable spin
        placeLight();
        renderer.render(scene, camera);
      };
      tick();

      this._dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        pmrem.dispose();
      };
    }
  });
})();
