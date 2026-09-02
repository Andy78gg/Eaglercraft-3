const { createApp } = Vue;

createApp({
  data() {
    return {
      ready: false,
      openDropdown: false,
      buildOptions: [
        { value: 'js', label: 'JavaScript Build' },
        { value: 'wasm', label: 'WASM Build' }
      ],
      selectedBuild: { value: 'wasm', label: 'WASM Build' },
      boostEnabled: localStorage.getItem('boostEnabled') !== '0',
    };
  },
  methods: {
    selectBuild(option) {
      this.selectedBuild = option;
      this.openDropdown = false;
    },
    launchSelectedBuild() {
      const route = this.selectedBuild.value === 'wasm' ? './wasm/' : './js/';
      const boost = this.boostEnabled ? '1' : '0';
      localStorage.setItem('boostEnabled', boost);
      const sep = route.indexOf('?') === -1 ? '?' : '&';
      window.location.assign(route + sep + 'boost=' + boost);
    },
    onMouseMove(event) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      this._targetX = event.clientX / w;
      this._targetY = event.clientY / h;
    }
  },
  mounted() {
    requestAnimationFrame(() => { this.ready = true; });

    // Smooth parallax — lerp current position toward mouse target each frame,
    // matching the lazy inertia of the in-game main menu background.
    let curX = 0.5, curY = 0.5;
    this._targetX = 0.5;
    this._targetY = 0.5;
    const bgEl = document.querySelector('.bg-image');
    const LERP = 0.055; // lower = more lag, higher = snappier
    const MAX_X = 28, MAX_Y = 22;

    const tick = () => {
      curX += (this._targetX - curX) * LERP;
      curY += (this._targetY - curY) * LERP;
      const tx = (curX - 0.5) * MAX_X;
      const ty = (curY - 0.5) * MAX_Y;
      if (bgEl) bgEl.style.transform = `translate(${tx}px, ${ty}px) scale(1.15)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    document.addEventListener('click', (e) => {
      const dropdown = document.querySelector('.dropdown');
      if (!dropdown) return;
      if (!dropdown.contains(e.target)) this.openDropdown = false;
    });
  }
}).mount('#app');
