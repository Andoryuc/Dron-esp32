import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  FRAME_LEVELS,
  EXPLODE_OFFSETS,
  PROP_MODES,
  CAMERA_PRESETS,
  COMPONENT_INSPECT_CONFIG
} from './config.js';
import { createMaterialLibrary } from './materials.js';
import { buildDroneFrame } from './drone-frame.js';
import { buildElectronics } from './electronics.js';
import { buildWiring } from './wiring.js';
import { buildComponentCircuits } from './component-circuits.js';
import { createCameraAnimator } from './camera-presets.js';
import { initPanelsSlot } from './panels-slot.js';

const canvas = document.getElementById('drone-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// 1. Escena sobre fondo blanco puro #FFFFFF
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// 2. Camara y Renderizador PBR de estudio
const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  1,
  2500
);
const initPreset = CAMERA_PRESETS.general;
camera.position.set(...initPreset.position);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 3. OrbitControls libre 360 grados con amortiguacion suave
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 65;
controls.maxDistance = 680;
controls.maxPolarAngle = Math.PI * 0.96;
controls.target.set(...initPreset.target);
controls.update();

// 4. Iluminacion de estudio de producto + sombra sutil sobre plano transparente
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8edf5, 1.35);
hemiLight.position.set(0, 260, 0);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfffdf9, 2.35);
keyLight.position.set(-140, 290, -165);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 60;
keyLight.shadow.camera.far = 650;
keyLight.shadow.camera.left = -180;
keyLight.shadow.camera.right = 180;
keyLight.shadow.camera.top = 180;
keyLight.shadow.camera.bottom = -180;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xeef4ff, 1.05);
fillLight.position.set(170, 120, -110);
scene.add(fillLight);

// Luz de contorno (rim light) trasera para perfilar aristas del ABS negro mate
const rimLight = new THREE.DirectionalLight(0xffffff, 1.45);
rimLight.position.set(130, 145, 220);
scene.add(rimLight);

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(540, 540),
  new THREE.ShadowMaterial({ opacity: 0.09 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = FRAME_LEVELS.floorGroundY - 0.2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// 5. Estado de animacion e interfaz
const componentKeys = Object.keys(COMPONENT_INSPECT_CONFIG);
const compStates = {};
for (const key of componentKeys) {
  compStates[key] = {
    liftTarget: 0,
    liftCurrent: 0,
    visible: true,
    opacityTarget: 1,
    opacityCurrent: 1,
    revealCurrent: 0
  };
}

const state = {
  propMode: 'idle',
  currentPropSpeed: PROP_MODES.idle,
  explodeTarget: 0,
  explodeCurrent: 0,
  batteryVisible: true,
  autoRotate: false,
  cleanMode: false,
  activeComponent: null,
  mosfetMode: 'single'
};

const camAnimator = createCameraAnimator(camera, controls);

// Elementos UI
const camButtons = Array.from(document.querySelectorAll('.cam-btn'));
const propButtons = Array.from(document.querySelectorAll('[data-prop-mode]'));
const explodeLabel = document.getElementById('explode-label');
const explodeSlider = document.getElementById('explode-slider');
const explodeValue = document.getElementById('explode-value');
const explodeToggle = document.getElementById('explode-toggle');
const componentInspector = document.getElementById('component-inspector');
const mosfetModeGroup = document.getElementById('mosfet-mode-group');
const mosfetModeButtons = Array.from(document.querySelectorAll('[data-mosfet-mode]'));
const compVisibilityToggle = document.getElementById('comp-visibility-toggle');
const compVisibilityLabel = document.getElementById('comp-visibility-label');
const compVisibilityPill = document.getElementById('comp-visibility-pill');
const compOpacitySlider = document.getElementById('comp-opacity-slider');
const compOpacityValue = document.getElementById('comp-opacity-value');
const batteryToggle = document.getElementById('battery-toggle');
const autoRotateToggle = document.getElementById('autorotate-toggle');
const cleanModeBtn = document.getElementById('clean-mode-btn');
const cleanToast = document.getElementById('clean-toast');
let toastTimer = null;

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function syncExplodeControls(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  explodeSlider.value = String(clamped);
  explodeValue.textContent = `${clamped}%`;
  const isOpen = clamped > 0;
  explodeToggle.textContent = isOpen ? 'Cerrar' : 'Abrir';
  explodeToggle.setAttribute('aria-pressed', String(isOpen));
}

function syncComponentInspectorUI() {
  const key = state.activeComponent;
  if (!key) {
    componentInspector.hidden = true;
    mosfetModeGroup.hidden = true;
    explodeLabel.textContent = 'Despiece';
    syncExplodeControls(state.explodeTarget * 100);
    return;
  }

  const cfg = COMPONENT_INSPECT_CONFIG[key];
  const cs = compStates[key];
  componentInspector.hidden = false;
  mosfetModeGroup.hidden = key !== 'mosfets';
  explodeLabel.textContent = `Separar ${cfg.label}`;
  syncExplodeControls(cs.liftTarget * 100);

  compVisibilityLabel.textContent = `Ocultar ${cfg.label}`;
  compVisibilityToggle.classList.toggle('active', cs.visible);
  compVisibilityToggle.setAttribute('aria-pressed', String(!cs.visible));
  compVisibilityPill.textContent = cs.visible ? 'Visible' : 'Oculto';

  const opPct = Math.round(cs.opacityTarget * 100);
  compOpacitySlider.value = String(opPct);
  compOpacityValue.textContent = `${opPct}%`;
}

function setActiveCamButton(presetKey) {
  for (const btn of camButtons) {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  }
}

function selectViewPreset(key) {
  setActiveCamButton(key);

  if (state.activeComponent && state.activeComponent !== key) {
    const prev = compStates[state.activeComponent];
    prev.liftTarget = 0;
    prev.visible = true;
    prev.opacityTarget = 1;
  }

  if (key in COMPONENT_INSPECT_CONFIG) {
    state.explodeTarget = 0;
    state.activeComponent = key;
  } else {
    state.activeComponent = null;
  }

  syncComponentInspectorUI();
  return camAnimator.goToPreset(key, 900);
}

for (const btn of camButtons) {
  btn.addEventListener('click', () => {
    selectViewPreset(btn.dataset.preset);
  });
}

for (const btn of mosfetModeButtons) {
  btn.addEventListener('click', () => {
    state.mosfetMode = btn.dataset.mosfetMode;
    for (const b of mosfetModeButtons) {
      b.classList.toggle('active', b === btn);
    }
  });
}

for (const btn of propButtons) {
  btn.addEventListener('click', () => {
    state.propMode = btn.dataset.propMode;
    for (const b of propButtons) {
      b.classList.toggle('active', b === btn);
    }
  });
}

function setGlobalExplodeTarget(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  state.explodeTarget = clamped / 100;
  if (!state.activeComponent) {
    syncExplodeControls(clamped);
  }
}

function handleExplodePercentInput(percent, animateCamera = false) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (!state.activeComponent) {
    setGlobalExplodeTarget(clamped);
    return;
  }

  const key = state.activeComponent;
  const cs = compStates[key];
  const cfg = COMPONENT_INSPECT_CONFIG[key];
  const base = CAMERA_PRESETS[key];
  const prevTarget = cs.liftTarget;
  const nextTarget = clamped / 100;
  cs.liftTarget = nextTarget;
  syncExplodeControls(clamped);

  if (animateCamera) {
    const pos = [
      base.position[0] + (cfg.explodedPosition[0] - base.position[0]) * nextTarget,
      base.position[1] + (cfg.explodedPosition[1] - base.position[1]) * nextTarget,
      base.position[2] + (cfg.explodedPosition[2] - base.position[2]) * nextTarget
    ];
    const tgt = [
      base.target[0] + (cfg.explodedTarget[0] - base.target[0]) * nextTarget,
      base.target[1] + (cfg.explodedTarget[1] - base.target[1]) * nextTarget,
      base.target[2] + (cfg.explodedTarget[2] - base.target[2]) * nextTarget
    ];
    camAnimator.goToView(pos, tgt, 750);
  } else {
    const delta = nextTarget - prevTarget;
    if (Math.abs(delta) > 1e-4) {
      const posDelta = new THREE.Vector3(...cfg.explodedPosition)
        .sub(new THREE.Vector3(...base.position))
        .multiplyScalar(delta);
      const targetDelta = new THREE.Vector3(...cfg.explodedTarget)
        .sub(new THREE.Vector3(...base.target))
        .multiplyScalar(delta);
      camAnimator.nudgeByDelta(posDelta, targetDelta);
    }
  }
}

explodeSlider.addEventListener('input', (e) => {
  handleExplodePercentInput(Number(e.target.value), false);
});

explodeToggle.addEventListener('click', () => {
  if (!state.activeComponent) {
    handleExplodePercentInput(state.explodeTarget > 0.05 ? 0 : 100, false);
  } else {
    const cs = compStates[state.activeComponent];
    handleExplodePercentInput(cs.liftTarget > 0.05 ? 0 : 100, true);
  }
});

compVisibilityToggle.addEventListener('click', () => {
  if (!state.activeComponent) return;
  const cs = compStates[state.activeComponent];
  cs.visible = !cs.visible;
  syncComponentInspectorUI();
});

compOpacitySlider.addEventListener('input', (e) => {
  if (!state.activeComponent) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
  compStates[state.activeComponent].opacityTarget = clamped / 100;
  compOpacityValue.textContent = `${clamped}%`;
});

function setAutoRotate(enabled) {
  state.autoRotate = enabled;
  controls.autoRotate = enabled;
  controls.autoRotateSpeed = 1.4;
  autoRotateToggle.classList.toggle('active', enabled);
  autoRotateToggle.setAttribute('aria-pressed', String(enabled));
  autoRotateToggle.querySelector('.state-pill').textContent = enabled ? 'ON' : 'OFF';
}

autoRotateToggle.addEventListener('click', () => {
  setAutoRotate(!state.autoRotate);
});

function toggleCleanMode(force) {
  state.cleanMode = typeof force === 'boolean' ? force : !state.cleanMode;
  document.body.classList.toggle('clean-mode', state.cleanMode);

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (state.cleanMode) {
    cleanToast.classList.add('visible');
    toastTimer = setTimeout(() => {
      cleanToast.classList.remove('visible');
    }, 2200);
  } else {
    cleanToast.classList.remove('visible');
  }
}

cleanModeBtn.addEventListener('click', () => toggleCleanMode());

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }
  if (e.key === 'h' || e.key === 'H') {
    toggleCleanMode();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 6. Ensamblaje completo del prototipo real
const droneRoot = new THREE.Group();
droneRoot.name = 'droneRoot';
scene.add(droneRoot);

async function initPrototype() {
  const mats = createMaterialLibrary();
  const frame = await buildDroneFrame(mats);
  const electronics = buildElectronics(mats);
  const wiring = buildWiring(mats);
  const circuits = buildComponentCircuits();

  // Electrónica, arnés superior y circuitos 3D montados dentro del 2.º piso
  frame.upperDeckGroup.add(
    electronics.deckElectronicsGroup,
    electronics.batteryCellGroup,
    wiring.deckWiringGroup,
    circuits.rootGroup
  );

  droneRoot.add(
    frame.lowerChassisGroup,
    frame.columnsGroup,
    frame.upperDeckGroup,
    frame.propellersGroup,
    wiring.motorWiringGroup
  );

  function applyComponentAppearance(key) {
    const group = electronics.components[key];
    const cs = compStates[key];
    if (!group) return;

    const rawAlpha = cs.visible ? cs.opacityCurrent : 0;
    // Curva rayos-X suave para que niveles 25%-60% muestren transparencia nitida incluso en mallas superpuestas
    const visualAlpha = rawAlpha <= 0.01 ? 0 : Math.pow(rawAlpha, 1.45);
    group.visible = cs.visible && visualAlpha > 0.01;

    group.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData.origCastShadow === undefined) {
        child.userData.origCastShadow = child.castShadow;
      }
      child.castShadow = rawAlpha > 0.88 ? child.userData.origCastShadow : false;
    });

    const ownMats = group.userData.ownMaterials || [];
    for (const mat of ownMats) {
      const baseOpacity = mat.userData?.baseOpacity ?? 1;
      const baseTransparent = Boolean(mat.userData?.baseTransparent);
      const baseDepthWrite = mat.userData?.baseDepthWrite !== false;

      const nextTransparent = rawAlpha < 0.999 || baseTransparent;
      if (mat.transparent !== nextTransparent) {
        mat.transparent = nextTransparent;
        mat.needsUpdate = true;
      }

      mat.opacity = baseOpacity * visualAlpha;
      mat.depthWrite = nextTransparent ? (rawAlpha > 0.88 ? baseDepthWrite : false) : baseDepthWrite;
    }
  }

  function setBatteryVisible(visible) {
    state.batteryVisible = visible;
    electronics.batteryCellGroup.visible = visible;
    batteryToggle.classList.toggle('active', visible);
    batteryToggle.setAttribute('aria-pressed', String(visible));
    batteryToggle.querySelector('.state-pill').textContent = visible ? 'Visible' : 'Oculta';
  }

  batteryToggle.addEventListener('click', () => {
    setBatteryVisible(!state.batteryVisible);
  });

  // Exponer API limpia para panels-slot.js
  initPanelsSlot({
    goToPreset: (k) => selectViewPreset(k),
    setPropMode: (m) => {
      if (m in PROP_MODES) state.propMode = m;
    },
    setExplode: (pct) => handleExplodePercentInput(pct, true),
    setBatteryVisible
  });

  loadingOverlay.classList.add('hidden');

  let lastTime = performance.now();
  let lastWiredExplode = -1;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // 1. Transicion suave de camara (900 ms)
    camAnimator.update(now);
    controls.update();

    // 2. Giro real de helices CW / CCW con aceleracion y frenado suaves
    const targetSpeed = PROP_MODES[state.propMode] ?? 0;
    state.currentPropSpeed += (targetSpeed - state.currentPropSpeed) * Math.min(1, dt * 5.0);

    const blurOpacity =
      state.currentPropSpeed > 18
        ? Math.min(0.24, ((state.currentPropSpeed - 18) / (PROP_MODES.flight - 18)) * 0.24)
        : 0;

    for (const rotor of frame.rotors) {
      if (state.currentPropSpeed > 0.01) {
        rotor.rotation.y += rotor.userData.rotSign * state.currentPropSpeed * dt;
      }
      if (rotor.userData.blurDisc) {
        rotor.userData.blurDisc.material.opacity = blurOpacity;
      }
    }

    // 3. Vista explosionada vertical global suave (0% -> 100%)
    const diff = state.explodeTarget - state.explodeCurrent;
    if (Math.abs(diff) > 0.0005) {
      state.explodeCurrent += diff * Math.min(1, dt * 8.0);
    } else {
      state.explodeCurrent = state.explodeTarget;
    }

    const t = state.explodeCurrent;
    frame.columnsGroup.position.y = t * EXPLODE_OFFSETS.columnsLift;
    frame.upperDeckGroup.position.y = FRAME_LEVELS.upperDeckBaseY + t * EXPLODE_OFFSETS.deckLift;
    electronics.batteryCellGroup.position.y =
      electronics.batteryCellGroup.userData.baseY + t * EXPLODE_OFFSETS.batteryExtraLift;
    frame.propellersGroup.position.y = t * EXPLODE_OFFSETS.propExtraLift;

    if (Math.abs(t - lastWiredExplode) > 0.002) {
      wiring.updateMotorWiring(t);
      lastWiredExplode = t;
    }

    // 4. Despiece individual, opacidad rayos-X y revelacion de circuitos 3D por componente
    for (const key of componentKeys) {
      const cs = compStates[key];
      const cfg = COMPONENT_INSPECT_CONFIG[key];
      const compGroup = electronics.components[key];

      const liftDiff = cs.liftTarget - cs.liftCurrent;
      if (Math.abs(liftDiff) > 0.0005) {
        cs.liftCurrent += liftDiff * Math.min(1, dt * 8.0);
      } else {
        cs.liftCurrent = cs.liftTarget;
      }

      const opDiff = cs.opacityTarget - cs.opacityCurrent;
      if (Math.abs(opDiff) > 0.001) {
        cs.opacityCurrent += opDiff * Math.min(1, dt * 10.0);
      } else {
        cs.opacityCurrent = cs.opacityTarget;
      }

      if (compGroup) {
        const baseY = compGroup.userData.baseY || 0;
        compGroup.position.y = baseY + cs.liftCurrent * cfg.liftHeight;
        applyComponentAppearance(key);
      }

      let revealTarget = 0;
      if (state.activeComponent === key) {
        const liftReveal = smoothstep(0.05, 0.35, cs.liftCurrent);
        const xrayReveal = !cs.visible ? 1 : (1 - cs.opacityCurrent) * 0.95;
        revealTarget = Math.max(liftReveal, xrayReveal);
      }
      const revDiff = revealTarget - cs.revealCurrent;
      if (Math.abs(revDiff) > 0.001) {
        cs.revealCurrent += revDiff * Math.min(1, dt * 9.0);
      } else {
        cs.revealCurrent = revealTarget;
      }

      circuits.updateComponent(key, {
        reveal: cs.revealCurrent,
        liftT: cs.liftCurrent,
        mosfetMode: state.mosfetMode
      });
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}

initPrototype().catch((err) => {
  console.error(err);
  loadingText.textContent = `Error al inicializar el visor 3D: ${err.message}`;
});
