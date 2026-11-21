import * as THREE from 'three';
import {
  FRAME_LEVELS,
  COMPONENT_INSPECT_CONFIG,
  MOSFET_BOARD_LAYOUT,
  ESP32_CONNECTED_PINS
} from './config.js';

// Generador de etiquetas flotantes 3D nítidas sobre fondo blanco y chasis negro
function createLabelSprite(text, options = {}) {
  const {
    accent = '#38bdf8',
    bg = 'rgba(15, 23, 42, 0.92)',
    textColor = '#f8fafc',
    borderColor = 'rgba(255, 255, 255, 0.22)',
    fontSize = 34,
    worldHeight = 4.6,
    showDot = true,
    depthTest = false,
    renderOrder = 25
  } = options;

  const padX = 22;
  const dotR = showDot ? 9 : 0;
  const dotGap = showDot ? 16 : 0;
  const font = `700 ${fontSize}px "Segoe UI", -apple-system, Roboto, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  mCtx.font = font;
  const textWidth = Math.ceil(mCtx.measureText(text).width);

  const width = Math.max(128, padX * 2 + (showDot ? dotR * 2 + dotGap : 0) + textWidth);
  const height = 80;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Rectangulo redondeado (pastilla tecnica)
  const r = 22;
  const bw = width - 8;
  const bh = height - 8;
  ctx.beginPath();
  ctx.moveTo(4 + r, 4);
  ctx.arcTo(4 + bw, 4, 4 + bw, 4 + bh, r);
  ctx.arcTo(4 + bw, 4 + bh, 4, 4 + bh, r);
  ctx.arcTo(4, 4 + bh, 4, 4, r);
  ctx.arcTo(4, 4, 4 + bw, 4, r);
  ctx.closePath();

  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  let textX = padX + 4;
  if (showDot) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(padX + dotR + 2, height / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
    textX = padX + dotR * 2 + dotGap + 2;
  }

  ctx.font = font;
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, textX, height / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthTest,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = renderOrder;
  sprite.scale.set(worldHeight * (width / height), worldHeight, 1);
  return { sprite, mat };
}

function createRoundedSlabGeometry(w, h, radius) {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw * 0.45, hh * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return new THREE.ShapeGeometry(shape, 10);
}

function createCircuitToolkit(matList) {
  function regMat(mat, baseOpacity = 1) {
    mat.transparent = true;
    mat.opacity = 0;
    matList.push({ mat, baseOpacity });
    return mat;
  }

  function makeMat(hex, opts = {}) {
    const {
      baseOpacity = 1,
      emissive = hex,
      emissiveIntensity = 0.25,
      roughness = 0.35,
      metalness = 0.1,
      depthWrite = true,
      side = THREE.FrontSide
    } = opts;
    return regMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive,
        emissiveIntensity,
        roughness,
        metalness,
        depthWrite,
        side
      }),
      baseOpacity
    );
  }

  function addLabel(parent, text, pos, opts = {}) {
    const { sprite, mat } = createLabelSprite(text, opts);
    sprite.position.set(pos[0], pos[1], pos[2]);
    parent.add(sprite);
    matList.push({ mat, baseOpacity: 1 });
    return sprite;
  }

  function addSlab(parent, width, height, pos, opts = {}) {
    const {
      color = 0xf8fafc,
      borderColor = 0x94a3b8,
      baseOpacity = 0.88,
      rotX = -Math.PI / 2,
      radius = 3.0
    } = opts;
    const holder = new THREE.Group();
    holder.position.set(pos[0], pos[1], pos[2]);
    holder.rotation.x = rotX;

    const fillMat = regMat(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      baseOpacity
    );
    const slabMesh = new THREE.Mesh(createRoundedSlabGeometry(width, height, radius), fillMat);
    slabMesh.renderOrder = 2;
    holder.add(slabMesh);

    const edgesMat = regMat(
      new THREE.LineBasicMaterial({ color: borderColor, transparent: true }),
      0.65
    );

    // Borde limpio sobre contorno de la placa
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hh = height / 2;
    const r = Math.min(radius, hw * 0.45, hh * 0.45);
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    const borderGeom = new THREE.BufferGeometry().setFromPoints(shape.getPoints(36));
    const borderLine = new THREE.LineLoop(borderGeom, edgesMat);
    borderLine.position.z = 0.05;
    holder.add(borderLine);

    parent.add(holder);
    return holder;
  }

  function addTrack(parent, pts, radius, hex, opts = {}) {
    const {
      tension = 0.25,
      segments = 36,
      emissiveIntensity = 0.28,
      baseOpacity = 1
    } = opts;
    const vectors = pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', tension);
    const geom = new THREE.TubeGeometry(curve, segments, radius, 8, false);
    const mat = makeMat(hex, { emissiveIntensity, baseOpacity });
    const mesh = new THREE.Mesh(geom, mat);
    parent.add(mesh);
    return mesh;
  }

  function addNode(parent, pos, radius, hex) {
    const mat = makeMat(hex, { emissiveIntensity: 0.35 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
    sphere.position.set(pos[0], pos[1], pos[2]);
    parent.add(sphere);
    return sphere;
  }

  function addBox(parent, size, pos, hex, opts = {}) {
    const mat = makeMat(hex, opts);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    parent.add(mesh);
    return mesh;
  }

  function addDiode3D(parent, pos, dirVec, bodyLen = 4.6, bodyRad = 1.0) {
    const diode = new THREE.Group();
    diode.position.set(pos[0], pos[1], pos[2]);

    const bodyMat = makeMat(0x1e293b, { emissive: 0x0f172a, emissiveIntensity: 0.15 });
    const bandMat = makeMat(0xe2e8f0, { emissive: 0x94a3b8, emissiveIntensity: 0.25, metalness: 0.7 });
    const arrowMat = makeMat(0xf59e0b, { emissiveIntensity: 0.4 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRad, bodyRad, bodyLen, 16), bodyMat);
    diode.add(body);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRad * 1.05, bodyRad * 1.05, bodyLen * 0.22, 16),
      bandMat
    );
    band.position.y = bodyLen * 0.34;
    diode.add(band);

    // Cono direccional discreto indicando sentido Anodo -> Catodo (franja)
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(bodyRad * 1.35, bodyLen * 0.38, 3),
      arrowMat
    );
    tip.position.y = bodyLen * 0.02;
    diode.add(tip);

    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(dirVec[0], dirVec[1], dirVec[2]).normalize();
    diode.quaternion.setFromUnitVectors(up, dir);

    parent.add(diode);
    return diode;
  }

  return { regMat, makeMat, addLabel, addSlab, addTrack, addNode, addBox, addDiode3D };
}

// 1. Circuito MOSFETs: 1 Canal (fiel al dibujo a mano) + 4 Canales (topologia real de baquelita)
function buildMosfetsOverlay(rootGroup) {
  const container = new THREE.Group();
  container.name = 'mosfetsCircuitOverlay';

  const singleGroup = new THREE.Group();
  const singleMats = [];
  const fourGroup = new THREE.Group();
  const fourMats = [];

  container.add(singleGroup, fourGroup);
  rootGroup.add(container);

  const centerZ = MOSFET_BOARD_LAYOUT.centerZ;
  const restBoardY = FRAME_LEVELS.mosfetPostsLocalY + 0.8;

  // ---- A. 1 Canal (Detalle) basado en el dibujo a mano (sin los circulos a lapiz) ----
  {
    const tk = createCircuitToolkit(singleMats);
    const panel = new THREE.Group();
    panel.position.set(0, 24.5, centerZ);
    panel.rotation.order = 'YXZ';
    panel.rotation.y = -0.62;
    panel.rotation.x = -0.52;
    panel.scale.setScalar(0.9);
    singleGroup.add(panel);

    tk.addSlab(panel, 46, 38, [0, 0, 0], {
      rotX: 0,
      color: 0xf8fafc,
      borderColor: 0x64748b,
      baseOpacity: 0.92,
      radius: 3.5
    });

    const zPlane = 0.6;

    // Coordenadas dentro del plano XY del diagrama:
    // Y = -12: patas Gate (-6), Drain (0), Source (+8)
    // Y = +13: Riel B+ rojo superior
    const gateX = -6.0;
    const drainX = 0.0;
    const sourceX = 8.5;

    // Bloque simbolo 3D del MOSFET IRFZ44N abajo
    tk.addBox(panel, [18.5, 4.4, 1.8], [1.2, -13.5, zPlane + 0.4], 0x1e293b, {
      emissive: 0x0f172a,
      emissiveIntensity: 0.2
    });
    tk.addBox(panel, [16.5, 1.4, 0.8], [1.2, -16.0, zPlane + 0.2], 0xcbd5e1, { metalness: 0.7 });
    tk.addLabel(panel, 'IRFZ44N (Canal N)', [1.2, -18.5, zPlane + 1.0], {
      accent: '#94a3b8',
      fontSize: 28,
      worldHeight: 3.6,
      showDot: false
    });

    // Pata 1: Gate (recta hacia arriba -> Pin ESP32 PWM)
    tk.addTrack(panel, [
      [gateX, -11.3, zPlane],
      [gateX, 3.8, zPlane]
    ], 0.42, 0x0284c7, { segments: 14 });
    tk.addNode(panel, [gateX, -11.3, zPlane], 0.75, 0x0284c7);
    tk.addNode(panel, [gateX, 3.8, zPlane], 0.75, 0x0284c7);
    tk.addLabel(panel, 'Gate', [gateX - 0.8, -9.2, zPlane + 1.1], {
      accent: '#0284c7',
      fontSize: 26,
      worldHeight: 3.3
    });
    tk.addLabel(panel, 'Pin ESP32 (PWM)', [gateX - 1.5, 6.2, zPlane + 1.1], {
      accent: '#0284c7',
      fontSize: 27,
      worldHeight: 3.5
    });

    // Pata 2: Drain -> sube a diodo (anodo) + puente en arco saltando Gate hacia M-
    tk.addTrack(panel, [
      [drainX, -11.3, zPlane],
      [drainX, -2.5, zPlane],
      [drainX, 3.2, zPlane]
    ], 0.46, 0x334155, { segments: 14 });
    tk.addNode(panel, [drainX, -11.3, zPlane], 0.75, 0x334155);
    tk.addNode(panel, [drainX, -2.5, zPlane], 0.8, 0x334155);

    // Arco 3D saltando la linea de Gate hacia M-
    tk.addTrack(panel, [
      [drainX, -2.5, zPlane],
      [-3.5, -2.5, zPlane],
      [-6.0, -2.5, zPlane + 2.8], // Salto sobre Gate
      [-8.5, -2.5, zPlane],
      [-14.5, -2.5, zPlane],
      [-14.5, 1.2, zPlane]
    ], 0.44, 0x334155, { segments: 32, tension: 0.25 });
    tk.addNode(panel, [-14.5, 1.2, zPlane], 0.8, 0x334155);
    tk.addLabel(panel, 'Drain', [drainX + 3.2, -8.5, zPlane + 1.0], {
      accent: '#64748b',
      fontSize: 26,
      worldHeight: 3.3
    });
    tk.addLabel(panel, 'M−', [-16.6, 1.2, zPlane + 1.1], {
      accent: '#475569',
      fontSize: 30,
      worldHeight: 3.7
    });

    // Simbolo 3D Diodo Flyback (vertical: Anodo abajo en Drain, Catodo CON franja arriba en B+)
    tk.addDiode3D(panel, [drainX, 6.8, zPlane + 0.3], [0, 1, 0], 5.6, 1.15);
    tk.addTrack(panel, [
      [drainX, 9.6, zPlane],
      [drainX, 13.0, zPlane]
    ], 0.42, 0xdc2626, { segments: 10 });
    tk.addLabel(panel, 'Diodo Flyback (Cátodo ▬)', [9.5, 7.2, zPlane + 1.1], {
      accent: '#f59e0b',
      fontSize: 26,
      worldHeight: 3.4
    });

    // Linea roja superior B+ (3.7V) + derivacion M+
    tk.addTrack(panel, [
      [-11.0, 13.0, zPlane],
      [0.0, 13.0, zPlane],
      [11.0, 13.0, zPlane]
    ], 0.52, 0xdc2626, { segments: 16 });
    tk.addNode(panel, [drainX, 13.0, zPlane], 0.85, 0xdc2626);
    tk.addLabel(panel, 'B+ (3.7V)', [-15.2, 13.0, zPlane + 1.1], {
      accent: '#dc2626',
      fontSize: 28,
      worldHeight: 3.6
    });

    // Puente a M+ desde riel B+ (fiel al trazo superior izquierdo del dibujo)
    tk.addTrack(panel, [
      [-4.2, 13.0, zPlane],
      [-4.2, 16.4, zPlane],
      [-16.5, 16.4, zPlane],
      [-16.5, 7.0, zPlane],
      [-14.5, 7.0, zPlane]
    ], 0.46, 0xdc2626, { segments: 24, tension: 0.1 });
    tk.addNode(panel, [-4.2, 13.0, zPlane], 0.8, 0xdc2626);
    tk.addNode(panel, [-14.5, 7.0, zPlane], 0.8, 0xdc2626);
    tk.addLabel(panel, 'M+', [-16.6, 7.0, zPlane + 1.1], {
      accent: '#dc2626',
      fontSize: 30,
      worldHeight: 3.7
    });

    // Pata 3: Source -> B- / GND
    tk.addTrack(panel, [
      [sourceX, -11.3, zPlane],
      [sourceX, -2.5, zPlane],
      [14.5, -2.5, zPlane]
    ], 0.48, 0x1e293b, { segments: 16, tension: 0.1 });
    tk.addNode(panel, [sourceX, -11.3, zPlane], 0.75, 0x1e293b);
    tk.addNode(panel, [14.5, -2.5, zPlane], 0.85, 0x1e293b);
    tk.addLabel(panel, 'Source', [sourceX + 3.8, -8.5, zPlane + 1.0], {
      accent: '#334155',
      fontSize: 26,
      worldHeight: 3.3
    });
    tk.addLabel(panel, 'B− / GND', [16.5, -0.2, zPlane + 1.1], {
      accent: '#334155',
      fontSize: 28,
      worldHeight: 3.6
    });
  }

  // ---- B. 4 Canales (Placa) alineados 1:1 bajo la baquelita real ----
  const fourRisers = [];
  {
    const tk = createCircuitToolkit(fourMats);
    const diagY = 18.0;
    const plane = new THREE.Group();
    plane.position.set(0, diagY, centerZ);
    fourGroup.add(plane);

    tk.addSlab(plane, 38.0, 74.0, [0, -0.2, 0], {
      rotX: -Math.PI / 2,
      color: 0xf8fafc,
      borderColor: 0x64748b,
      baseOpacity: 0.9,
      radius: 3.0
    });

    const localChZ = MOSFET_BOARD_LAYOUT.channelZ.map((z) => z - centerZ);
    const bPlusX = MOSFET_BOARD_LAYOUT.bPlusRailX;
    const gndLX = MOSFET_BOARD_LAYOUT.gndRailLeftX;
    const gndRX = MOSFET_BOARD_LAYOUT.gndRailRightX;

    // Riel largo externo positivo B+ (+14.2)
    tk.addTrack(plane, [
      [bPlusX, 0.4, -31.0],
      [bPlusX, 0.4,  31.0]
    ], 0.56, 0xdc2626, { segments: 16 });
    tk.addLabel(plane, 'Riel B+ (3.7V) · Bat / VIN+ / 4× M+', [bPlusX + 5.5, 5.2, -32.5], {
      accent: '#dc2626',
      fontSize: 25,
      worldHeight: 3.5
    });

    // Doble riel central longitudinal B- / GND (-1.2 y +1.3)
    tk.addTrack(plane, [
      [gndLX, 0.4, -30.0],
      [gndLX, 0.4,  30.0]
    ], 0.48, 0x1e293b, { segments: 16 });
    tk.addTrack(plane, [
      [gndRX, 0.4, -30.0],
      [gndRX, 0.4,  30.0]
    ], 0.48, 0x1e293b, { segments: 16 });
    tk.addLabel(plane, 'Doble Riel B− / GND (Bat / VIN−)', [0.0, 5.2, 33.8], {
      accent: '#475569',
      fontSize: 25,
      worldHeight: 3.5
    });

    // 4 Canales paralelos
    localChZ.forEach((lz, idx) => {
      const mId = MOSFET_BOARD_LAYOUT.channelNames[idx];
      const gpio = MOSFET_BOARD_LAYOUT.channelGpios[idx];

      // Bloque simbolico del IRFZ44N
      tk.addBox(plane, [2.8, 2.2, 7.6], [MOSFET_BOARD_LAYOUT.mosfetX, 1.1, lz], 0x1e293b);

      // Gate (-2.54) -> salida hacia GPIO ESP32
      tk.addTrack(plane, [
        [MOSFET_BOARD_LAYOUT.mosfetX, 0.5, lz - 2.54],
        [-21.5, 0.5, lz - 2.54]
      ], 0.36, 0x0284c7, { segments: 8 });
      tk.addNode(plane, [MOSFET_BOARD_LAYOUT.mosfetX, 0.6, lz - 2.54], 0.6, 0x0284c7);
      tk.addLabel(plane, `${mId} · ${gpio}`, [-27.5, 2.2 + (idx % 2) * 1.4, lz - 2.54], {
        accent: '#0284c7',
        fontSize: 25,
        worldHeight: 3.4
      });

      // Drain (0) + Anodo Diodo (-3.9) + toma M-
      tk.addTrack(plane, [
        [MOSFET_BOARD_LAYOUT.mosfetX, 0.5, lz],
        [MOSFET_BOARD_LAYOUT.anodeX, 0.5, lz]
      ], 0.42, 0x475569, { segments: 8 });
      tk.addNode(plane, [MOSFET_BOARD_LAYOUT.drainTapX, 0.7, lz], 0.65, 0x334155);

      // Simbolo 3D del diodo cruzando el doble riel central (Anodo -X -> Catodo +X)
      tk.addDiode3D(plane, [0.05, 1.8, lz], [1, 0, 0], 4.4, 0.85);
      tk.addTrack(plane, [
        [MOSFET_BOARD_LAYOUT.anodeX, 0.5, lz],
        [MOSFET_BOARD_LAYOUT.anodeX, 1.8, lz],
        [-2.2, 1.8, lz]
      ], 0.28, 0x94a3b8, { segments: 8 });
      tk.addTrack(plane, [
        [2.2, 1.8, lz],
        [MOSFET_BOARD_LAYOUT.cathodeX, 1.8, lz],
        [MOSFET_BOARD_LAYOUT.cathodeX, 0.5, lz],
        [MOSFET_BOARD_LAYOUT.redArchInnerX, 0.5, lz]
      ], 0.28, 0x94a3b8, { segments: 10 });

      // Arito rojo B+ (+14.2) -> tira del catodo (+7.5)
      tk.addTrack(plane, [
        [bPlusX, 0.5, lz + 0.8],
        [10.8, 3.6, lz + 0.4],
        [MOSFET_BOARD_LAYOUT.redArchInnerX, 0.5, lz]
      ], 0.42, 0xdc2626, { segments: 14 });

      // Puente negro corto Source (+2.54) -> Doble riel central B-
      tk.addTrack(plane, [
        [MOSFET_BOARD_LAYOUT.mosfetX, 0.5, lz + 2.54],
        [-6.4, 0.5, lz + 2.54],
        [-3.8, 2.8, lz + 2.54],
        [gndLX, 0.5, lz + 2.54]
      ], 0.4, 0x1e293b, { segments: 14 });
      tk.addNode(plane, [gndLX, 0.6, lz + 2.54], 0.6, 0x1e293b);

      // Indicador M+ en borde +X
      tk.addNode(plane, [bPlusX, 0.7, lz], 0.7, 0xdc2626);
      tk.addLabel(plane, `${mId}+`, [bPlusX + 2.8, 1.4, lz], {
        accent: '#dc2626',
        fontSize: 23,
        worldHeight: 2.9
      });
    });

    // Guias verticales desde las 4 esquinas de la proyeccion hasta la baquelita elevada
    const stemMat = tk.makeMat(0x94a3b8, { baseOpacity: 0.45, emissiveIntensity: 0.1 });
    for (const [rx, rz] of [[-13.5, -31], [13.5, -31], [-13.5, 31], [13.5, 31]]) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8), stemMat);
      stem.position.set(rx, diagY, centerZ + rz);
      fourGroup.add(stem);
      fourRisers.push({ stem, diagY });
    }
  }

  return {
    update({ reveal, liftT, mosfetMode }) {
      const isSingle = mosfetMode !== 'four';
      container.visible = reveal > 0.01;
      singleGroup.visible = container.visible && isSingle;
      fourGroup.visible = container.visible && !isSingle;

      if (!container.visible) return;
      for (const item of singleMats) {
        item.mat.opacity = item.baseOpacity * reveal;
      }
      for (const item of fourMats) {
        item.mat.opacity = item.baseOpacity * reveal;
      }

      if (!isSingle) {
        const boardNowY = restBoardY + liftT * COMPONENT_INSPECT_CONFIG.mosfets.liftHeight;
        for (const r of fourRisers) {
          const span = Math.max(0.5, boardNowY - r.diagY);
          r.stem.visible = liftT > 0.04;
          r.stem.scale.y = span;
          r.stem.position.y = r.diagY + span * 0.5;
        }
      }
    }
  };
}

// 2. Circuito MT3608 Boost DC-DC (segun MT3608.pdf Fig. 1)
function buildMt3608Overlay(rootGroup) {
  const group = new THREE.Group();
  group.name = 'mt3608CircuitOverlay';
  const mats = [];
  rootGroup.add(group);

  const tk = createCircuitToolkit(mats);
  const centerX = -58.6;
  const baseY = 17.5;

  const panel = new THREE.Group();
  panel.position.set(centerX, baseY + 1.5, -1.5);
  panel.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-0.34, 0.90, -0.24).normalize()
  );
  group.add(panel);

  tk.addSlab(panel, 54.0, 32.0, [0, 0, 0], {
    rotX: -Math.PI / 2,
    color: 0xf8fafc,
    borderColor: 0x3b82f6,
    baseOpacity: 0.92,
    radius: 3.0
  });

  // Coordenadas locales XZ dentro de panel (VIN derecha +X, VOUT izquierda -X)
  const yTop = 0.6;
  const vinX = 21.5;
  const voutX = -21.5;
  const busTopZ = -8.5;
  const busGndZ = 8.5;

  // Entradas VIN+ (3.7V rojo) y VIN- (B- gris oscuro)
  tk.addNode(panel, [vinX, yTop, busTopZ], 0.9, 0xdc2626);
  tk.addLabel(panel, 'VIN+ (3.7V Bat)', [vinX + 1.8, 5.0, busTopZ - 3.2], {
    accent: '#dc2626',
    fontSize: 24,
    worldHeight: 3.1
  });

  tk.addNode(panel, [vinX, yTop, busGndZ], 0.9, 0x334155);
  tk.addLabel(panel, 'VIN− (B−)', [vinX + 2.2, 2.8, busGndZ + 3.2], {
    accent: '#475569',
    fontSize: 24,
    worldHeight: 3.1
  });

  // Capacitor entrada C1 (22 uF) entre VIN+ y GND
  tk.addTrack(panel, [[16.0, yTop, busTopZ], [16.0, yTop, busGndZ]], 0.34, 0x64748b, { segments: 8 });
  tk.addBox(panel, [2.2, 1.8, 3.4], [16.0, yTop + 0.6, 0.5], 0xd97706);
  tk.addLabel(panel, 'C1 22µF', [15.5, 2.5, 1.5], {
    accent: '#d97706',
    fontSize: 21,
    worldHeight: 2.7
  });

  // Inductor L1 (22 uH) desde VIN+ hacia nodo SW
  tk.addTrack(panel, [[vinX, yTop, busTopZ], [11.5, yTop, busTopZ]], 0.48, 0xdc2626, { segments: 10 });
  tk.addBox(panel, [6.4, 2.8, 5.4], [8.2, yTop + 1.1, busTopZ], 0x1e293b);
  tk.addLabel(panel, 'L1 (22 µH)', [8.2, 5.6, busTopZ - 3.0], {
    accent: '#f59e0b',
    fontSize: 24,
    worldHeight: 3.1
  });

  // Nodo SW (ambar) -> Integrado MT3608 SOT23-6 (SW, GND, FB, EN, IN)
  tk.addTrack(panel, [[5.0, yTop, busTopZ], [0.5, yTop, busTopZ]], 0.5, 0xf59e0b, { segments: 8 });
  tk.addNode(panel, [1.6, yTop + 0.2, busTopZ], 0.85, 0xf59e0b);

  // Chip SOT23-6 MT3608 centrado en X = 1.6, Z = 0.2
  tk.addBox(panel, [7.6, 2.0, 7.6], [1.6, yTop + 0.8, 0.2], 0x0f172a, { emissiveIntensity: 0.15 });
  tk.addTrack(panel, [[1.6, yTop, -3.6], [1.6, yTop, busTopZ]], 0.4, 0xf59e0b, { segments: 6 }); // SW
  tk.addTrack(panel, [[5.4, yTop, -1.6], [12.8, yTop, -1.6], [12.8, yTop, busTopZ]], 0.36, 0xdc2626, { segments: 10 }); // IN / EN
  tk.addTrack(panel, [[1.6, yTop, 4.0], [1.6, yTop, busGndZ]], 0.4, 0x334155, { segments: 6 }); // GND
  tk.addTrack(panel, [[-2.2, yTop, 1.2], [-9.2, yTop, 1.2]], 0.4, 0x16a34a, { segments: 8 }); // FB

  tk.addLabel(panel, 'MT3608 (SOT23-6)', [1.2, 4.4, -1.2], {
    accent: '#38bdf8',
    fontSize: 23,
    worldHeight: 3.0
  });
  tk.addLabel(panel, 'SW · GND · FB · EN · IN', [3.6, 1.5, 7.6], {
    accent: '#94a3b8',
    fontSize: 20,
    worldHeight: 2.6,
    showDot: false
  });

  // Diodo Schottky D1 desde SW -> VOUT+ (5.0V naranja)
  tk.addDiode3D(panel, [-5.6, yTop + 1.0, busTopZ], [-1, 0, 0], 4.8, 1.0);
  tk.addTrack(panel, [[0.5, yTop, busTopZ], [-2.8, yTop, busTopZ]], 0.46, 0xf59e0b, { segments: 8 });
  tk.addTrack(panel, [[-8.4, yTop, busTopZ], [voutX, yTop, busTopZ]], 0.52, 0xea580c, { segments: 12 });
  tk.addLabel(panel, 'Schottky D1', [-6.2, 5.6, busTopZ - 3.2], {
    accent: '#f59e0b',
    fontSize: 23,
    worldHeight: 3.0
  });

  // Divisor resistivo / Potenciometro R1/R2 -> FB (0.6V)
  tk.addTrack(panel, [[-9.2, yTop, busTopZ], [-9.2, yTop, busGndZ]], 0.38, 0x16a34a, { segments: 10 });
  tk.addBox(panel, [2.6, 2.2, 4.0], [-9.2, yTop + 0.9, -2.5], 0x2563eb); // Pot/R1
  tk.addBox(panel, [2.2, 1.4, 3.0], [-9.2, yTop + 0.6, 4.8], 0x475569);  // R2
  tk.addNode(panel, [-9.2, yTop + 0.2, 1.2], 0.8, 0x16a34a);
  tk.addLabel(panel, 'Pot R1/R2 → FB (0.6V)', [-9.2, 4.4, 2.6], {
    accent: '#16a34a',
    fontSize: 22,
    worldHeight: 2.9
  });

  // Capacitor salida C2 (22 uF)
  tk.addTrack(panel, [[-16.2, yTop, busTopZ], [-16.2, yTop, busGndZ]], 0.34, 0x64748b, { segments: 8 });
  tk.addBox(panel, [2.2, 1.8, 3.4], [-16.2, yTop + 0.6, 0.5], 0xd97706);
  tk.addLabel(panel, 'C2 22µF', [-16.4, 2.2, 5.2], {
    accent: '#d97706',
    fontSize: 20,
    worldHeight: 2.6
  });

  // Linea de tierra comun inferior VIN- <-> VOUT-
  tk.addTrack(panel, [[vinX, yTop, busGndZ], [voutX, yTop, busGndZ]], 0.5, 0x334155, { segments: 16 });

  // Salidas VOUT+ (5.0V -> ESP32 5V/VIN) y VOUT- (GND ESP32)
  tk.addNode(panel, [voutX, yTop, busTopZ], 0.9, 0xea580c);
  tk.addLabel(panel, 'VOUT+ (5.0V → ESP32 5V/VIN)', [voutX - 2.5, 5.4, busTopZ - 3.2], {
    accent: '#ea580c',
    fontSize: 24,
    worldHeight: 3.1
  });

  tk.addNode(panel, [voutX, yTop, busGndZ], 0.9, 0x334155);
  tk.addLabel(panel, 'VOUT− (GND ESP32)', [voutX - 2.5, 2.6, busGndZ + 3.2], {
    accent: '#475569',
    fontSize: 24,
    worldHeight: 3.1
  });

  // Risers sutiles hacia la placa MT3608 elevada
  const risers = [];
  const riserMat = tk.makeMat(0x60a5fa, { baseOpacity: 0.42, emissiveIntensity: 0.1 });
  for (const [rx, rz] of [[centerX + 15.6, -4.6], [centerX + 15.6, 4.6], [centerX - 15.6, -4.6], [centerX - 15.6, 4.6]]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8), riserMat);
    stem.position.set(rx, baseY + 6, rz);
    group.add(stem);
    risers.push({ stem, baseY: baseY + 2 });
  }

  return {
    update({ reveal, liftT }) {
      group.visible = reveal > 0.01;
      if (!group.visible) return;
      for (const item of mats) {
        item.mat.opacity = item.baseOpacity * reveal;
      }
      const pcbTopY = FRAME_LEVELS.deckSurfaceLocalY + 0.8 + liftT * COMPONENT_INSPECT_CONFIG.mt3608.liftHeight;
      for (const r of risers) {
        const span = Math.max(0.5, pcbTopY - r.baseY);
        r.stem.visible = liftT > 0.05;
        r.stem.scale.y = span;
        r.stem.position.y = r.baseY + span * 0.5;
      }
    }
  };
}

// 3. Esquema I2C + Bloque MEMS del MPU-6050 (segun MPU-6000.pdf)
function buildMpu6050Overlay(rootGroup) {
  const group = new THREE.Group();
  group.name = 'mpu6050CircuitOverlay';
  const mats = [];
  rootGroup.add(group);

  const tk = createCircuitToolkit(mats);
  const centerX = 55.3;
  const baseY = 14.5;

  const panel = new THREE.Group();
  panel.position.set(centerX, baseY + 1.0, -4.5);
  panel.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0.32, 0.91, -0.24).normalize()
  );
  group.add(panel);

  tk.addSlab(panel, 39.0, 32.0, [0, 0, 0], {
    rotX: -Math.PI / 2,
    color: 0xf8fafc,
    borderColor: 0x3b82f6,
    baseOpacity: 0.92,
    radius: 3.0
  });

  const yTop = 0.6;

  // Bloque interno minimalista en 3 etapas (+Z tras el peine):
  // MEMS 6-Ejes (Gyro + Accel) -> ADC 16-bit -> Bus I2C (0x68)
  tk.addBox(panel, [8.2, 2.2, 6.2], [-10.0, yTop + 0.9, 7.6], 0x1e3a8a);
  tk.addLabel(panel, 'MEMS 6-Ejes (Gyro+Accel)', [-10.0, 3.8, 8.2], {
    accent: '#38bdf8',
    fontSize: 21,
    worldHeight: 2.8
  });

  tk.addTrack(panel, [[-5.6, yTop + 0.6, 7.6], [-2.0, yTop + 0.6, 7.6]], 0.32, 0x0ea5e9, { segments: 6 });

  tk.addBox(panel, [7.0, 2.2, 6.2], [1.8, yTop + 0.9, 7.6], 0x0f172a);
  tk.addLabel(panel, 'ADC 16-bit', [1.8, 3.8, 8.2], {
    accent: '#0ea5e9',
    fontSize: 22,
    worldHeight: 2.9
  });

  tk.addTrack(panel, [[5.4, yTop + 0.6, 7.6], [8.8, yTop + 0.6, 7.6]], 0.32, 0x0ea5e9, { segments: 6 });

  tk.addBox(panel, [7.6, 2.2, 6.2], [12.6, yTop + 0.9, 7.6], 0x0369a1);
  tk.addLabel(panel, 'I2C (0x68)', [12.6, 3.8, 8.2], {
    accent: '#22c55e',
    fontSize: 23,
    worldHeight: 3.0
  });

  // Peine 8 pines reales alineado con buildMpu6050 (X_local = -7.7 + i * 2.2)
  const connectedPins = [
    { idx: 0, label: 'VCC → 3V3',       hex: '#dc2626', color: 0xdc2626, targetX: -15.5, labelY: 6.8, labelZ: -12.5 },
    { idx: 1, label: 'GND → GND',       hex: '#475569', color: 0x334155, targetX:  -6.0, labelY: 2.6, labelZ: -13.2 },
    { idx: 2, label: 'SCL → GPIO 22',   hex: '#16a34a', color: 0x16a34a, targetX:   3.8, labelY: 6.8, labelZ: -12.5 },
    { idx: 3, label: 'SDA → GPIO 21',   hex: '#2563eb', color: 0x2563eb, targetX:  13.5, labelY: 2.6, labelZ: -13.2 }
  ];

  for (const pin of connectedPins) {
    const px = -7.7 + pin.idx * 2.2;
    tk.addNode(panel, [px, yTop + 0.2, -1.6], 0.72, pin.color);
    tk.addTrack(panel, [
      [px, yTop + 0.4, 4.2],
      [px, yTop + 0.4, -2.5],
      [pin.targetX, yTop + 0.4, -7.8],
      [pin.targetX, yTop + 0.4, -10.8]
    ], 0.44, pin.color, { segments: 18, emissiveIntensity: 0.42 });
    tk.addNode(panel, [pin.targetX, yTop + 0.4, -10.8], 0.78, pin.color);
    tk.addLabel(panel, pin.label, [pin.targetX, pin.labelY, pin.labelZ], {
      accent: pin.hex,
      fontSize: 23,
      worldHeight: 3.0
    });
  }

  // 4 pines sin conectar indicados discretamente en gris: XDA, XCL, AD0, INT (Libres)
  for (let i = 4; i < 8; i++) {
    const px = -7.7 + i * 2.2;
    tk.addNode(panel, [px, yTop + 0.1, -1.6], 0.48, 0x94a3b8);
    tk.addTrack(panel, [
      [px, yTop + 0.2, -1.6],
      [px + 2.0, yTop + 0.2, -4.8]
    ], 0.24, 0x94a3b8, { segments: 6, baseOpacity: 0.65, emissiveIntensity: 0.05 });
  }
  tk.addLabel(panel, 'XDA · XCL · AD0 · INT (Libres)', [13.5, 5.2, -3.2], {
    accent: '#94a3b8',
    bg: 'rgba(51, 65, 85, 0.82)',
    textColor: '#e2e8f0',
    fontSize: 20,
    worldHeight: 2.6
  });

  // Risers hacia modulo elevado
  const risers = [];
  const riserMat = tk.makeMat(0x60a5fa, { baseOpacity: 0.42, emissiveIntensity: 0.1 });
  for (const px of [centerX - 7.7, centerX - 1.1, centerX + 7.7]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 8), riserMat);
    stem.position.set(px, baseY + 5, -6.2);
    group.add(stem);
    risers.push({ stem, baseY: baseY + 2 });
  }

  return {
    update({ reveal, liftT }) {
      group.visible = reveal > 0.01;
      if (!group.visible) return;
      for (const item of mats) {
        item.mat.opacity = item.baseOpacity * reveal;
      }
      const pcbTopY = FRAME_LEVELS.deckSurfaceLocalY + 0.8 + liftT * COMPONENT_INSPECT_CONFIG.mpu6050.liftHeight;
      for (const r of risers) {
        const span = Math.max(0.5, pcbTopY - r.baseY);
        r.stem.visible = liftT > 0.05;
        r.stem.scale.y = span;
        r.stem.position.y = r.baseY + span * 0.5;
      }
    }
  };
}

// 4. ESP32: Elevacion limpia y mapa 3D peinado de los 9 pines exactos conectados (SIN circuito interno)
function buildEsp32Overlay(rootGroup) {
  const group = new THREE.Group();
  group.name = 'esp32PinoutOverlay';
  const mats = [];
  rootGroup.add(group);

  const tk = createCircuitToolkit(mats);
  const deckBaseY = FRAME_LEVELS.deckSurfaceLocalY;
  const maxLift = COMPONENT_INSPECT_CONFIG.esp32.liftHeight;

  // Destinos peinados y escalonados para evitar solapamientos y despejar el panel derecho
  const layoutByPinId = {
    '3V3':    { outX:  16.5, outY: 32.0, outZ: -25.0, yRatio: 0.92 },
    'GPIO25': { outX:  26.5, outY: 29.0, outZ: -41.5, yRatio: 0.72 },
    'GPIO26': { outX:  27.5, outY: 22.5, outZ: -51.5, yRatio: 0.54 },
    'GPIO27': { outX:  26.5, outY: 16.0, outZ: -61.5, yRatio: 0.34 },
    'GPIO14': { outX:  27.5, outY:  9.5, outZ: -71.5, yRatio: 0.16 },
    'VIN':    { outX:  24.0, outY: 16.5, outZ: -81.5, yRatio: 0.36 },
    'GPIO22': { outX: -16.5, outY: 20.0, outZ: -39.0, yRatio: 0.42 },
    'GPIO21': { outX: -17.5, outY: 14.5, outZ: -48.5, yRatio: 0.24 },
    'GND':    { outX: -17.5, outY: 12.5, outZ: -78.2, yRatio: 0.18 }
  };

  const pinRigEntries = [];

  for (const pin of ESP32_CONNECTED_PINS) {
    const cfg = layoutByPinId[pin.id];
    const colorHex = new THREE.Color(pin.hex).getHex();

    // Pad luminoso en el chasis inferior
    const baseBead = tk.addNode(group, [pin.x, deckBaseY + 0.4, pin.z], 0.9, colorHex);

    // Tallo vertical que acompana al pin elevado desde el chasis hasta la placa ESP32
    const stemMat = tk.makeMat(colorHex, { emissiveIntensity: 0.4, baseOpacity: 0.92 });
    const vStem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 10), stemMat);
    vStem.position.set(pin.x, deckBaseY + 1, pin.z);
    group.add(vStem);

    // Linea peinada horizontal/diagonal desde el tallo vertical hacia la etiqueta exterior
    const combMat = tk.makeMat(colorHex, { emissiveIntensity: 0.38, baseOpacity: 0.92 });
    const combGroup = new THREE.Group();
    group.add(combGroup);

    const endSphere = tk.addNode(combGroup, [cfg.outX, cfg.outY, cfg.outZ], 0.72, colorHex);
    const labelOffsetX = cfg.outX > 0 ? 10.5 : -7.8;
    const labelSprite = tk.addLabel(combGroup, pin.label, [cfg.outX + labelOffsetX, cfg.outY, cfg.outZ], {
      accent: pin.hex,
      fontSize: 24,
      worldHeight: 3.3
    });

    pinRigEntries.push({
      pin,
      cfg,
      baseBead,
      vStem,
      combMat,
      combMesh: null,
      combGroup,
      endSphere,
      labelSprite,
      labelOffsetX,
      lastLiftBucket: -1
    });
  }

  return {
    update({ reveal, liftT }) {
      group.visible = reveal > 0.01;
      if (!group.visible) return;

      for (const item of mats) {
        item.mat.opacity = item.baseOpacity * reveal;
      }

      const liftedPinBottomY = deckBaseY + 1.2 + liftT * maxLift;
      const liftBucket = Math.round(liftT * 80);

      for (const entry of pinRigEntries) {
        const { pin, cfg, vStem, combMat, combGroup, endSphere, labelSprite, labelOffsetX } = entry;

        // 1. Estirar tallo vertical entre alojamiento del chasis y el ESP32 levantado
        const baseAnchorY = deckBaseY + 0.4;
        const vSpan = Math.max(1.0, liftedPinBottomY - baseAnchorY);
        vStem.scale.y = vSpan;
        vStem.position.y = baseAnchorY + vSpan * 0.5;

        // 2. Actualizar linea guia peinada si cambio liftT
        if (entry.lastLiftBucket !== liftBucket) {
          entry.lastLiftBucket = liftBucket;
          const effectiveRise = Math.max(18.0, liftedPinBottomY - baseAnchorY);
          const midY = baseAnchorY + effectiveRise * cfg.yRatio;
          const outY = midY + 1.8;
          const outX = cfg.outX;
          const outZ = cfg.outZ;

          endSphere.position.set(outX, outY, outZ);
          labelSprite.position.set(outX + labelOffsetX, outY, outZ);

          if (entry.combMesh) {
            combGroup.remove(entry.combMesh);
            entry.combMesh.geometry.dispose();
          }
          const dirX = Math.sign(outX);
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(pin.x, midY, pin.z),
            new THREE.Vector3(pin.x + dirX * 5.0, midY, pin.z),
            new THREE.Vector3(outX - dirX * 4.0, outY, outZ),
            new THREE.Vector3(outX, outY, outZ)
          ], false, 'catmullrom', 0.25);

          entry.combMesh = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 18, 0.28, 8, false),
            combMat
          );
          combGroup.add(entry.combMesh);
        }
      }
    }
  };
}

export function buildComponentCircuits() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'componentCircuitsGroup';

  const controllers = {
    mosfets: buildMosfetsOverlay(rootGroup),
    mt3608: buildMt3608Overlay(rootGroup),
    mpu6050: buildMpu6050Overlay(rootGroup),
    esp32: buildEsp32Overlay(rootGroup)
  };

  // Arrancar ocultos hasta entrar en modo de inspeccion de componente
  for (const key of Object.keys(controllers)) {
    controllers[key].update({ reveal: 0, liftT: 0, mosfetMode: 'single' });
  }

  return {
    rootGroup,
    updateComponent(key, params) {
      const ctrl = controllers[key];
      if (ctrl) ctrl.update(params);
    }
  };
}
