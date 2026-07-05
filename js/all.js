// ========================================
// LittleChefRecipes — Combined Script
// ========================================
(function () {
  'use strict';

  // ========================================
  // COOKBOOK — Three.js 3D Interactive Book
  // ========================================

  class Cookbook3D {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.options = Object.assign({
        autoRotate: true,
        autoRotateSpeed: 0.005,
        dragRotationSpeed: 0.8,
        momentumDamping: 0.92,
        hoverLift: 0.3,
      }, options);

      this.isDragging = false;
      this.isHovering = false;
      this.isOpen = false;
      this.currentPage = 0;
      this.totalPages = 8;
      this.targetRotationY = 0;
      this.targetRotationX = 0;
      this.velocityY = 0;
      this.velocityX = 0;
      this.prevMouseX = 0;
      this.prevMouseY = 0;
      this.mouseX = 0;
      this.mouseY = 0;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.bookGroup = null;
      this.coverLeft = null;
      this.coverRight = null;
      this.spine = null;
      this.pages = [];
      this.pageMeshes = [];
      this.goldEdges = [];
      this.bookmark = null;

      this.raycaster = new THREE.Raycaster();
      this.mouseVec = new THREE.Vector2();
      this.clock = new THREE.Clock();

      this.init();
    }

    init() {
      var rect = this.container.getBoundingClientRect();
      var width = rect.width || 600;
      var height = rect.height || 500;

      this.scene = new THREE.Scene();

      var aspect = width / height;
      this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
      this.camera.position.set(0, 1.5, 6);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (typeof THREE.SRGBColorSpace !== 'undefined') {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if (typeof THREE.sRGBEncoding !== 'undefined') {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      this.container.appendChild(this.renderer.domElement);

      this.setupLighting();
      this.buildBook();
      this.createGroundShadow();
      this.setupEvents();
      this.animate();
    }

    setupLighting() {
      var ambient = new THREE.AmbientLight(0xfff5e6, 0.5);
      this.scene.add(ambient);

      var mainLight = new THREE.DirectionalLight(0xffe4c4, 1.8);
      mainLight.position.set(3, 5, 4);
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 1024;
      mainLight.shadow.mapSize.height = 1024;
      this.scene.add(mainLight);

      var fillLight = new THREE.DirectionalLight(0xc4d4ff, 0.6);
      fillLight.position.set(-3, 2, -2);
      this.scene.add(fillLight);

      var rimLight = new THREE.DirectionalLight(0xffeedd, 0.4);
      rimLight.position.set(0, -1, -4);
      this.scene.add(rimLight);

      var backLight = new THREE.DirectionalLight(0xfff0e0, 0.3);
      backLight.position.set(0, 2, -5);
      this.scene.add(backLight);

      var pointLight = new THREE.PointLight(0xff8844, 0.3, 8);
      pointLight.position.set(0, 2, 2);
      this.scene.add(pointLight);

      var hemi = new THREE.HemisphereLight(0xffeedd, 0x443322, 0.6);
      this.scene.add(hemi);
    }

    makeMat(color, opts) {
      return new THREE.MeshPhysicalMaterial(Object.assign({
        color: color,
        roughness: 0.4,
        metalness: 0.0,
        clearcoat: 0.0,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.5,
        side: THREE.DoubleSide,
      }, opts));
    }

    makeTexturedCover(w, h, d, topMat) {
      var geo = new THREE.BoxGeometry(w, h, d);
      var bottomMat = this.makeMat(0x8B5E3C, { roughness: 0.6, metalness: 0.05 });
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z
      var mats = [bottomMat, bottomMat, topMat, bottomMat, bottomMat, bottomMat];
      return new THREE.Mesh(geo, mats);
    }

    buildBook() {
      this.bookGroup = new THREE.Group();
      this.bookGroup.position.y = 0;

      var bw = 2.4, bh = 0.3, bd = 1.8;
      var pt = 0.02, ct = 0.06, co = 0.08;
      var halfW = bw / 2;

      // Load cover and inside textures
      var texLoader = new THREE.TextureLoader();
      var coverTex = texLoader.load('book.png');
      var insideTex = texLoader.load('book2.png');
      coverTex.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
      insideTex.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
      this._insideTex = insideTex;

      // Pages block
      var pagesGeo = new THREE.BoxGeometry(bw - co * 2, bh - ct, bd - co * 2);
      var pagesMat = new THREE.MeshPhysicalMaterial({
        color: 0xfff8f0, roughness: 0.7, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.8,
      });
      var pagesMesh = new THREE.Mesh(pagesGeo, pagesMat);
      pagesMesh.castShadow = true;
      this.bookGroup.add(pagesMesh);

      // Page lines
      for (var i = 0; i < 20; i++) {
        var t = (i / 20) - 0.5;
        var lineGeo = new THREE.BoxGeometry(0.002, bh - ct - 0.02, bd - co * 2 - 0.05);
        var lineMat = new THREE.MeshPhysicalMaterial({ color: 0xf0e0d0, roughness: 0.9, metalness: 0 });
        var line = new THREE.Mesh(lineGeo, lineMat);
        line.position.x = t * (bw - co * 2 - 0.05);
        line.position.y = 0;
        this.bookGroup.add(line);
      }

      // Cover texture material for top covers
      var coverMat = new THREE.MeshPhysicalMaterial({
        map: coverTex,
        roughness: 0.4,
        metalness: 0.05,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
      });

      // Bottom covers (plain brown)
      var cmat = this.makeMat(0x8B5E3C, { roughness: 0.6, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4 });
      var lGeo = new THREE.BoxGeometry(halfW + co, ct, bd + co * 2);
      this.coverLeft = new THREE.Mesh(lGeo, cmat.clone());
      this.coverLeft.position.set(-halfW / 2 - co / 2, -bh / 2 + ct / 2, 0);
      this.coverLeft.castShadow = true;
      this.coverLeft.receiveShadow = true;
      this.bookGroup.add(this.coverLeft);

      var rGeo = new THREE.BoxGeometry(halfW + co, ct, bd + co * 2);
      this.coverRight = new THREE.Mesh(rGeo, cmat.clone());
      this.coverRight.position.set(halfW / 2 + co / 2, -bh / 2 + ct / 2, 0);
      this.coverRight.castShadow = true;
      this.coverRight.receiveShadow = true;
      this.bookGroup.add(this.coverRight);

      // TOP COVERS with book.png texture
      // Front cover (right side) — book.png mapped to top face
      this.topRightCover = this.makeTexturedCover(halfW + co, ct, bd + co * 2, coverMat);
      this.topRightCover.position.set(halfW / 2 + co / 2, bh / 2 - ct / 2, 0);
      this.topRightCover.castShadow = true;
      this.bookGroup.add(this.topRightCover);

      // Back cover (left side) — book.png mapped to top face
      this.topLeftCover = this.makeTexturedCover(halfW + co, ct, bd + co * 2, coverMat);
      this.topLeftCover.position.set(-halfW / 2 - co / 2, bh / 2 - ct / 2, 0);
      this.topLeftCover.castShadow = true;
      this.bookGroup.add(this.topLeftCover);

      // Spine
      var spineGeo = new THREE.BoxGeometry(ct, bh + ct, bd + co * 2);
      var spineMat = this.makeMat(0x7A4E30, { roughness: 0.7, metalness: 0.05 });
      this.spine = new THREE.Mesh(spineGeo, spineMat);
      this.spine.position.set(-bw / 2 - co, 0, 0);
      this.spine.castShadow = true;
      this.bookGroup.add(this.spine);

      // Gold edges
      var gmat = new THREE.MeshPhysicalMaterial({
        color: 0xD4A574, roughness: 0.3, metalness: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.0,
      });
      var geGeo = new THREE.BoxGeometry(bw - co * 2 + 0.05, 0.01, bd - co * 2 + 0.05);
      var geTop = new THREE.Mesh(geGeo, gmat);
      geTop.position.set(0, bh / 2 - ct + 0.005, 0);
      this.bookGroup.add(geTop);
      var geBot = new THREE.Mesh(geGeo, gmat);
      geBot.position.set(0, -bh / 2 + ct - 0.005, 0);
      this.bookGroup.add(geBot);

      // Embossed details
      var embMat = new THREE.MeshPhysicalMaterial({
        color: 0xD4A574, roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.4,
      });
      var bGeo = new THREE.BoxGeometry(halfW - 0.3, 0.02, bd - 0.3);
      var bL = new THREE.Mesh(bGeo, embMat.clone());
      bL.position.set(-halfW / 2 - co / 2, bh / 2 - ct + 0.01, 0);
      this.bookGroup.add(bL);
      var bR = new THREE.Mesh(bGeo, embMat.clone());
      bR.position.set(halfW / 2 + co / 2, bh / 2 - ct + 0.01, 0);
      this.bookGroup.add(bR);

      // Page curl meshes
      for (var j = 0; j < 5; j++) {
        var pgGeo = new THREE.PlaneGeometry(bw - co * 2 - 0.1, bd - co * 2 - 0.1);
        var pgMat = new THREE.MeshPhysicalMaterial({
          color: 0xfffaf5, roughness: 0.8, metalness: 0, side: THREE.DoubleSide,
          transparent: true, opacity: 0.15 + (j * 0.05), clearcoat: 0.02,
        });
        var pg = new THREE.Mesh(pgGeo, pgMat);
        pg.position.set(0, (bh / 2 - ct - 0.02) * (1 - j / 5) - 0.01, 0);
        pg.rotation.x = -Math.PI / 2;
        pg.position.z = ((j / 5) * 0.3 - 0.15) * 0.05;
        this.bookGroup.add(pg);
        this.pageMeshes.push(pg);
      }

      // Bookmark
      var bmGeo = new THREE.BoxGeometry(0.06, 0.6, 0.005);
      var bmMat = new THREE.MeshPhysicalMaterial({ color: 0xC4956A, roughness: 0.5, metalness: 0.1 });
      this.bookmark = new THREE.Mesh(bmGeo, bmMat);
      this.bookmark.position.set(0.8, 0.6, -bd / 2 + co + 0.1);
      this.bookGroup.add(this.bookmark);

      // Inside pages (book2.png) — hidden, shown on open
      var ipMat = new THREE.MeshPhysicalMaterial({
        map: insideTex,
        roughness: 0.6,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      var pw = (bw - co * 2) / 2 - 0.08;
      var ph = bd - co * 2 - 0.1;

      this.insidePageLeft = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), ipMat.clone());
      // Map left half of book2.png
      var uvsL = this.insidePageLeft.geometry.attributes.uv;
      for (var ui = 0; ui < uvsL.count; ui++) {
        uvsL.setXY(ui, uvsL.getX(ui) * 0.5, uvsL.getY(ui));
      }
      uvsL.needsUpdate = true;
      this.insidePageLeft.position.set(-(bw - co * 2) / 4, (bh - ct) / 2 + 0.002, 0);
      this.insidePageLeft.rotation.x = -Math.PI / 2;
      this.bookGroup.add(this.insidePageLeft);

      this.insidePageRight = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), ipMat.clone());
      // Map right half of book2.png
      var uvsR = this.insidePageRight.geometry.attributes.uv;
      for (var ui = 0; ui < uvsR.count; ui++) {
        uvsR.setXY(ui, uvsR.getX(ui) * 0.5 + 0.5, uvsR.getY(ui));
      }
      uvsR.needsUpdate = true;
      this.insidePageRight.position.set((bw - co * 2) / 4, (bh - ct) / 2 + 0.002, 0);
      this.insidePageRight.rotation.x = -Math.PI / 2;
      this.bookGroup.add(this.insidePageRight);

      this.bookGroup.rotation.x = -0.1;
      this.bookGroup.position.y = -0.3;
      this.scene.add(this.bookGroup);
    }

    createGroundShadow() {
      var sg = new THREE.PlaneGeometry(6, 4);
      var sm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
      this.groundShadow = new THREE.Mesh(sg, sm);
      this.groundShadow.rotation.x = -Math.PI / 2;
      this.groundShadow.position.y = -0.6;
      this.scene.add(this.groundShadow);
    }

    setupEvents() {
      var self = this;
      var canvas = this.renderer.domElement;

      canvas.addEventListener('mousedown', function (e) { self.onDragStart(e); });
      window.addEventListener('mousemove', function (e) { self.onDragMove(e); });
      window.addEventListener('mouseup', function () { self.onDragEnd(); });
      canvas.addEventListener('mouseenter', function () { self.onMouseEnter(); });
      canvas.addEventListener('mouseleave', function () { self.onMouseLeave(); });
      canvas.addEventListener('touchstart', function (e) { self.onTouchStart(e); }, { passive: false });
      window.addEventListener('touchmove', function (e) { self.onTouchMove(e); }, { passive: false });
      window.addEventListener('touchend', function () { self.onTouchEnd(); });
      window.addEventListener('resize', function () { self.onResize(); });
      canvas.addEventListener('click', function () { self.onClick(); });
    }

    onDragStart(e) {
      this.isDragging = true;
      this.velocityY = 0;
      this.velocityX = 0;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      this.container.style.cursor = 'grabbing';
      this.options.autoRotate = false;
    }

    onDragMove(e) {
      if (!this.isDragging) {
        this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        return;
      }
      var dx = e.clientX - this.prevMouseX;
      var dy = e.clientY - this.prevMouseY;
      this.velocityY = dx * this.options.dragRotationSpeed * 0.02;
      this.velocityX = dy * this.options.dragRotationSpeed * 0.01;
      this.targetRotationY += this.velocityY;
      this.targetRotationX = Math.max(-0.4, Math.min(0.4, this.targetRotationX - dy * 0.003));
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    }

    onDragEnd() {
      this.isDragging = false;
      this.container.style.cursor = 'grab';
      var self = this;
      setTimeout(function () { self.options.autoRotate = true; }, 3000);
    }

    onMouseEnter() { this.isHovering = true; this.container.style.cursor = 'grab'; }
    onMouseLeave() {
      this.isHovering = false; this.isDragging = false;
      this.container.style.cursor = 'default';
      this.mouseX = 0; this.mouseY = 0;
    }

    onTouchStart(e) {
      e.preventDefault();
      var t = e.touches[0];
      this.isDragging = true;
      this.velocityY = 0; this.velocityX = 0;
      this.prevMouseX = t.clientX; this.prevMouseY = t.clientY;
      this.options.autoRotate = false;
    }

    onTouchMove(e) {
      if (!this.isDragging) return;
      e.preventDefault();
      var t = e.touches[0];
      var dx = t.clientX - this.prevMouseX;
      var dy = t.clientY - this.prevMouseY;
      this.velocityY = dx * this.options.dragRotationSpeed * 0.02;
      this.velocityX = dy * this.options.dragRotationSpeed * 0.01;
      this.targetRotationY += this.velocityY;
      this.targetRotationX = Math.max(-0.4, Math.min(0.4, this.targetRotationX - dy * 0.003));
      this.prevMouseX = t.clientX;
      this.prevMouseY = t.clientY;
    }

    onTouchEnd() {
      this.isDragging = false;
      var self = this;
      setTimeout(function () { self.options.autoRotate = true; }, 3000);
    }

    onClick() {
      if (Math.abs(this.velocityY) > 0.5) return;
      this.toggleOpen();
    }

    toggleOpen() {
      if (this.isOpen) this.closeBook();
      else this.openBook();
    }

    openBook() {
      this.isOpen = true;
      var hint = document.getElementById('book-hint');
      if (hint) hint.classList.add('hidden');

      gsap.to(this.camera.position, { z: 4.5, y: 1.8, duration: 1.2, ease: 'power3.inOut' });
      gsap.to(this.camera.position, { x: 0.5, duration: 1.2, ease: 'power3.inOut' });
      gsap.to(this.topRightCover.rotation, { y: -0.2, z: -0.1, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(this.topRightCover.position, { y: 0.35, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(this.spine.rotation, { y: 0.05, duration: 1.5, ease: 'power2.inOut' });
      // Fade in inside pages
      if (this.insidePageLeft) {
        gsap.to(this.insidePageLeft.material, { opacity: 1, duration: 0.8, ease: 'power2.inOut', delay: 0.3 });
      }
      if (this.insidePageRight) {
        gsap.to(this.insidePageRight.material, { opacity: 1, duration: 0.8, ease: 'power2.inOut', delay: 0.3 });
      }
    }

    closeBook() {
      this.isOpen = false;
      gsap.to(this.camera.position, { z: 6, y: 1.5, x: 0, duration: 1.2, ease: 'power3.inOut' });
      gsap.to(this.topRightCover.rotation, { y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(this.topRightCover.position, { y: 0.12, duration: 1.5, ease: 'power2.inOut' });
      gsap.to(this.spine.rotation, { y: 0, duration: 1.5, ease: 'power2.inOut' });
      // Fade out inside pages
      if (this.insidePageLeft) {
        gsap.to(this.insidePageLeft.material, { opacity: 0, duration: 0.4, ease: 'power2.inOut' });
      }
      if (this.insidePageRight) {
        gsap.to(this.insidePageRight.material, { opacity: 0, duration: 0.4, ease: 'power2.inOut' });
      }
    }

    turnPage(dir) {
      if (!this.isOpen) return;
      var target = this.currentPage + dir;
      if (target < 0 || target >= this.totalPages) return;
      this.currentPage = target;
      var idx = Math.min(this.currentPage, this.pageMeshes.length - 1);
      var page = this.pageMeshes[idx];
      if (page) {
        gsap.to(page.rotation, { z: dir * Math.PI, duration: 0.8, ease: 'power2.inOut' });
        gsap.to(page.position, { x: dir * 0.3, duration: 0.8, ease: 'power2.inOut' });
      }
      this.pageMeshes.forEach(function (p, i) {
        if (i < this.currentPage) { gsap.to(p.material, { opacity: 0.05, duration: 0.5 }); }
        else if (i === this.currentPage) { gsap.to(p.material, { opacity: 0.3, duration: 0.5 }); }
        else { gsap.to(p.material, { opacity: 0.15 + (i * 0.05), duration: 0.5 }); }
      }.bind(this));
      var indicator = document.getElementById('page-indicator');
      if (indicator) indicator.textContent = this.currentPage + 1;
    }

    onResize() {
      var rect = this.container.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    update() {
      if (!this.isDragging) {
        this.targetRotationY += this.velocityY;
        this.velocityY *= this.options.momentumDamping;
        this.targetRotationX += this.velocityX;
        this.velocityX *= this.options.momentumDamping;
        if (Math.abs(this.velocityY) < 0.0001) this.velocityY = 0;
        if (Math.abs(this.velocityX) < 0.0001) this.velocityX = 0;
        if (this.options.autoRotate && !this.isOpen) {
          this.targetRotationY += this.options.autoRotateSpeed;
        }
        if (Math.abs(this.velocityX) < 0.001) {
          this.targetRotationX += (0 - this.targetRotationX) * 0.02;
        }
      }
      if (this.bookGroup) {
        this.bookGroup.rotation.y += (this.targetRotationY - this.bookGroup.rotation.y) * 0.1;
        this.bookGroup.rotation.x += (this.targetRotationX - this.bookGroup.rotation.x) * 0.1;
        var liftTarget = this.isHovering && !this.isDragging ? this.options.hoverLift : 0;
        this.bookGroup.position.y += (-0.3 + liftTarget - this.bookGroup.position.y) * 0.05;
      }
      if (this.groundShadow) {
        var lift = this.bookGroup.position.y + 0.3;
        this.groundShadow.material.opacity = Math.max(0.03, 0.08 - lift * 0.1);
      }
      if (!this.isDragging && !this.isOpen) {
        var tx = this.mouseX * 0.1;
        var ty = 1.5 + this.mouseY * 0.05;
        this.camera.position.x += (tx - this.camera.position.x) * 0.02;
        this.camera.position.y += (ty - this.camera.position.y) * 0.02;
        this.camera.lookAt(0, 0, 0);
      }
    }

    animate() {
      var self = this;
      requestAnimationFrame(function () { self.animate(); });
      this.update();
      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      this.renderer.dispose();
      this.scene.clear();
      this.container.removeChild(this.renderer.domElement);
    }
  }

  function initBook(containerId) {
    var book = new Cookbook3D(containerId);
    window.__cookbook = book;
    return book;
  }

  // ========================================
  // EFFECTS — Particles, Steam, Cursor, etc.
  // ========================================

  function createParticles() {
    var container = document.getElementById('particles-container');
    if (!container) return;
    var ingredients = ['🍅', '🌿', '🧄', '🌶️', '🫚', '🫘', '🧂', '✨', '🌾', '🍃'];
    for (var i = 0; i < 20; i++) {
      var el = document.createElement('div');
      el.textContent = ingredients[i % ingredients.length];
      el.style.cssText = 'position:absolute;font-size:' + (Math.random() * 16 + 10) + 'px;opacity:' + (Math.random() * 0.15 + 0.04) + ';left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;pointer-events:none;animation:float-particle ' + (Math.random() * 15 + 12) + 's ease-in-out infinite;animation-delay:' + (Math.random() * 10) + 's;will-change:transform;';
      container.appendChild(el);
    }
    var s = document.createElement('style');
    s.textContent = '@keyframes float-particle{0%,100%{transform:translateY(0) rotate(0deg) scale(1)}25%{transform:translateY(-30px) rotate(10deg) scale(1.1)}50%{transform:translateY(-15px) rotate(-5deg) scale(0.95)}75%{transform:translateY(-40px) rotate(8deg) scale(1.05)}}';
    document.head.appendChild(s);
  }

  function createSteam() {
    var container = document.getElementById('steam-container');
    if (!container) return;
    for (var i = 0; i < 15; i++) {
      var s = document.createElement('div');
      s.className = 'steam-particle';
      s.style.cssText = 'position:absolute;background:radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 70%);border-radius:50%;pointer-events:none;width:' + (Math.random() * 40 + 20) + 'px;height:' + (Math.random() * 40 + 20) + 'px;left:' + (Math.random() * 80 + 10) + '%;bottom:' + (Math.random() * 30 + 10) + '%;animation:steam-rise ' + (Math.random() * 4 + 3) + 's ease-out infinite;animation-delay:' + (Math.random() * 5) + 's;';
      container.appendChild(s);
    }
  }

  function createSparkles() {
    var container = document.getElementById('hero');
    if (!container) return;
    for (var i = 0; i < 12; i++) {
      var s = document.createElement('div');
      s.className = 'sparkle';
      s.style.cssText = 'position:absolute;width:' + (Math.random() * 4 + 2) + 'px;height:' + (Math.random() * 4 + 2) + 'px;border-radius:50%;background:rgba(196,149,106,' + (Math.random() * 0.4 + 0.2) + ');pointer-events:none;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;animation:sparkle-anim ' + (Math.random() * 4 + 3) + 's ease-in-out infinite;animation-delay:' + (Math.random() * 5) + 's;box-shadow:0 0 ' + (Math.random() * 4 + 2) + 'px rgba(196,149,106,0.3);';
      container.appendChild(s);
    }
  }

  function initCursor() {
    var cursorMain = document.getElementById('cursor-main');
    var cursorDot = document.getElementById('cursor-dot');
    var cursorGlow = document.getElementById('cursor-glow');
    if (!cursorMain || !cursorDot || !cursorGlow) return;

    var mx = 0, my = 0, dx = 0, dy = 0, gx = 0, gy = 0;

    document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });

    function anim() {
      gx += (mx - gx) * 0.3; gy += (my - gy) * 0.3;
      cursorDot.style.left = gx + 'px'; cursorDot.style.top = gy + 'px';
      dx += (mx - dx) * 0.12; dy += (my - dy) * 0.12;
      cursorMain.style.left = dx + 'px'; cursorMain.style.top = dy + 'px';
      var gix = mx, giy = my;
      cursorGlow.style.left = gix + 'px'; cursorGlow.style.top = giy + 'px';
      requestAnimationFrame(anim);
    }
    anim();

    document.querySelectorAll('a, button, .cursor-hover, .recipe-card, .category-card, .feature-card').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        cursorMain.style.width = '40px'; cursorMain.style.height = '40px';
        cursorMain.style.background = 'rgba(196,149,106,0.1)';
        cursorMain.style.borderColor = '#D4A574';
        cursorDot.style.background = '#D4A574';
        cursorGlow.style.width = '120px'; cursorGlow.style.height = '120px';
      });
      el.addEventListener('mouseleave', function () {
        cursorMain.style.width = '20px'; cursorMain.style.height = '20px';
        cursorMain.style.background = 'transparent';
        cursorMain.style.borderColor = '#C4956A';
        cursorDot.style.background = '#C4956A';
        cursorGlow.style.width = '80px'; cursorGlow.style.height = '80px';
      });
    });
  }

  function rippleEffect(e) {
    var btn = e.currentTarget;
    var rect = btn.getBoundingClientRect();
    var r = document.createElement('span');
    r.className = 'ripple';
    var size = Math.max(rect.width, rect.height);
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size / 2) + 'px';
    r.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(r);
    setTimeout(function () { r.remove(); }, 600);
  }

  function initMagneticButtons() {
    document.querySelectorAll('.magnetic-btn').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        var s = 1.05;
        if (btn.classList.contains('btn-primary')) s = 1.06;
        btn.style.transform = 'translate(' + (x / 8) + 'px, ' + (y / 8) + 'px) scale(' + s + ')';
      });
      btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
      btn.addEventListener('click', rippleEffect);
    });
  }

  function initFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); btn.classList.toggle('active'); });
    });
  }

  function initCounters() {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var c = entry.target;
          var target = parseInt(c.dataset.target);
          var current = 0;
          var inc = Math.ceil(target / 60);
          var timer = setInterval(function () {
            current += inc;
            if (current >= target) { current = target; clearInterval(timer); }
            c.textContent = current + (target >= 100 ? 'k+' : '');
          }, 25);
          observer.unobserve(c);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.counter').forEach(function (c) { observer.observe(c); });
  }

  // ========================================
  // ANIMATIONS — GSAP, Scroll, Parallax, etc.
  // ========================================

  function initSmoothScroll() {
    if (typeof Lenis === 'undefined') return;
    var lenis = new Lenis({
      duration: 1.2,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
  }

  function initScrollReveals() {
    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.reveal').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: function () { el.classList.add('revealed'); } });
    });
    document.querySelectorAll('.reveal-left').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: function () { el.classList.add('revealed'); } });
    });
    document.querySelectorAll('.reveal-right').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: function () { el.classList.add('revealed'); } });
    });
    document.querySelectorAll('.reveal-scale').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: function () { el.classList.add('revealed'); } });
    });

    var featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length) {
      gsap.from(featureCards, { scrollTrigger: { trigger: '#features', start: 'top 70%' }, y: 60, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
    }

    var categoryCards = document.querySelectorAll('.category-card');
    if (categoryCards.length) {
      gsap.from(categoryCards, { scrollTrigger: { trigger: '#categories', start: 'top 75%' }, y: 50, opacity: 0, scale: 0.9, duration: 0.7, stagger: 0.05, ease: 'power2.out' });
    }

    var recipeCards = document.querySelectorAll('.recipe-card');
    if (recipeCards.length) {
      gsap.from(recipeCards, { scrollTrigger: { trigger: '#recipes', start: 'top 75%' }, y: 60, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' });
    }

    var testimonialCards = document.querySelectorAll('.testimonial-card');
    if (testimonialCards.length) {
      gsap.from(testimonialCards, { scrollTrigger: { trigger: '#testimonials', start: 'top 75%' }, x: 60, opacity: 0, duration: 0.7, stagger: 0.15, ease: 'power2.out' });
    }
  }

  function initParallax() {
    var layers = document.querySelectorAll('.parallax-layer');
    document.addEventListener('mousemove', function (e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 2;
      var y = (e.clientY / window.innerHeight - 0.5) * 2;
      layers.forEach(function (layer) {
        var speed = parseFloat(layer.dataset.speed) || 0.05;
        gsap.to(layer, { x: x * speed * 50, y: y * speed * 50, duration: 1, ease: 'power2.out', overwrite: 'auto' });
      });
    });
    gsap.utils.toArray('.floating-ingredient').forEach(function (el) {
      gsap.to(el, { scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.5 }, y: 60, ease: 'none' });
    });
  }

  function initNavbar() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: function (self) {
        if (self.progress > 0) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
      },
    });
    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.querySelector(link.getAttribute('href'));
        if (target && window.lenis) window.lenis.scrollTo(target);
      });
    });
  }

  function initStickyCTA() {
    var cta = document.getElementById('sticky-cta');
    if (!cta) return;
    ScrollTrigger.create({
      trigger: '#recipes', start: 'top center', end: 'bottom top',
      onEnter: function () { cta.style.transform = 'translateY(0)'; },
      onLeaveBack: function () { cta.style.transform = 'translateY(100%)'; },
    });
  }

  function initTextReveals() {
    if (typeof SplitType === 'undefined') return;
    document.querySelectorAll('.split-text').forEach(function (headline) {
      var split = new SplitType(headline, { types: 'lines,chars' });
      if (split.chars) {
        gsap.from(split.chars, { scrollTrigger: { trigger: headline, start: 'top 80%' }, y: 50, opacity: 0, rotateX: -30, duration: 0.6, stagger: 0.03, ease: 'power2.out' });
      }
    });
  }

  function initSectionAnimations() {
    // Auto-scroll testimonials
    var carousel = document.querySelector('.testimonials-carousel');
    if (!carousel || typeof gsap === 'undefined') return;

    var scrollWidth = carousel.scrollWidth - carousel.clientWidth;
    if (scrollWidth <= 0) return;

    var tl = gsap.to(carousel, {
      scrollLeft: scrollWidth,
      duration: 20,
      ease: 'none',
      repeat: -1,
    });

    carousel.addEventListener('mouseenter', function () { tl.pause(); });
    carousel.addEventListener('mouseleave', function () { tl.resume(); });
    carousel.addEventListener('touchstart', function () { tl.pause(); });
    carousel.addEventListener('touchend', function () { tl.resume(); });
  }

  function initBookPreview() {
    var prevBtn = document.getElementById('prev-page-btn');
    var nextBtn = document.getElementById('next-page-btn');
    var indicator = document.getElementById('page-indicator');
    if (!prevBtn || !nextBtn) return;
    var current = 1, total = 8;

    function update() { if (indicator) indicator.textContent = current; }

    function animPageTurn(btn) {
      gsap.fromTo(btn, { scale: 1, rotate: 0 }, { scale: 0.9, rotate: btn === nextBtn ? -10 : 10, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 1 });
      var mc = document.getElementById('mini-book-container');
      if (mc) gsap.fromTo(mc, { scaleX: 0.98 }, { scaleX: 1, duration: 0.4, ease: 'power2.out' });
    }

    prevBtn.addEventListener('click', function () { if (current > 1) { current--; update(); animPageTurn(prevBtn); } });
    nextBtn.addEventListener('click', function () { if (current < total) { current++; update(); animPageTurn(nextBtn); } });
  }

  function initLoader() {
    var loader = document.getElementById('loader');
    var loaderBar = document.getElementById('loader-bar');
    var loaderText = document.getElementById('loader-text');
    if (!loader || !loaderBar) return;

    var progress = 0;
    var messages = ['Loading...', 'Preparing recipes...', 'Sharpening knives...', 'Heating the oven...', 'Chopping ingredients...', 'Setting the table...', 'Almost ready...'];

    function update() {
      progress += Math.random() * 8 + 2;
      if (progress > 100) progress = 100;
      loaderBar.style.width = progress + '%';
      if (loaderText) {
        var idx = Math.floor((progress / 100) * messages.length);
        loaderText.textContent = messages[Math.min(idx, messages.length - 1)];
      }
      if (progress < 100) {
        setTimeout(update, Math.random() * 200 + 100);
      } else {
        setTimeout(function () {
          gsap.to(loader, {
            opacity: 0, duration: 0.8, ease: 'power2.inOut',
            onComplete: function () {
              loader.style.display = 'none';
              document.body.style.overflow = '';
            },
          });
        }, 500);
      }
    }
    update();
  }

  // ========================================
  // BOOT — Main Entry Point
  // ========================================

  function boot() {
    document.body.style.overflow = 'hidden';
    initLoader();

    setTimeout(function () {
      createParticles();
      createSteam();
      createSparkles();

      var book = initBook('three-canvas-container');

      var check = setInterval(function () {
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
          clearInterval(check);
          initSmoothScroll();
          initScrollReveals();
          initParallax();
          initNavbar();
          initStickyCTA();
          initTextReveals();
          initSectionAnimations();
          initBookPreview();
          setTimeout(function () { ScrollTrigger.refresh(); }, 500);
        }
      }, 100);

      setTimeout(function () {
        initCursor();
        initMagneticButtons();
        initFavoriteButtons();
        initCounters();
      }, 300);

      var heroBtn = document.getElementById('heroOpenBook');
      if (heroBtn && book) {
        heroBtn.addEventListener('click', function () { book.toggleOpen(); });
      }

      // VanillaTilt init
      if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll('[data-tilt]'));
      }

      // Hero floating ingredient labels
      if (typeof gsap !== 'undefined') {
        gsap.utils.toArray('.floating-ingredient').forEach(function (el, i) {
          gsap.to(el, {
            y: -15 + Math.random() * 10,
            rotation: Math.random() * 10 - 5,
            duration: 2 + Math.random() * 2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: i * 0.3,
          });
        });
      }

      // Scroll-based mini book rotate (book preview)
      if (typeof ScrollTrigger !== 'undefined') {
        var miniBook = document.getElementById('mini-book-container');
        if (miniBook) {
          gsap.to(miniBook, {
            scrollTrigger: {
              trigger: '#book-preview',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.5,
            },
            rotationY: 15,
            ease: 'none',
          });
        }
      }
    }, 100);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
