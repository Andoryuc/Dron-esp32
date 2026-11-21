import * as THREE from 'three';
import {
  FRAME_LEVELS,
  MOSFET_BOARD_LAYOUT,
  ESP32_HEADER,
  getEsp32PinZ
} from './config.js';

function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function makeBoard(widthX, thicknessY, lengthZ, topMat, sideMat, bottomMat = sideMat) {
  const geom = new THREE.BoxGeometry(widthX, thicknessY, lengthZ);
  // Orden caras BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
  const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
  return new THREE.Mesh(geom, mats);
}

// Clona y aisla materiales de un componente para controlar su opacidad individualmente
function isolateComponentMaterials(group) {
  const cloneMap = new Map();
  const cloneMat = (mat) => {
    if (!mat) return mat;
    if (cloneMap.has(mat)) return cloneMap.get(mat);
    const cloned = mat.clone();
    cloned.userData = {
      ...(mat.userData || {}),
      baseOpacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
      baseTransparent: Boolean(mat.transparent),
      baseDepthWrite: mat.depthWrite !== false
    };
    cloneMap.set(mat, cloned);
    return cloned;
  };

  group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map(cloneMat);
    } else {
      child.material = cloneMat(child.material);
    }
  });

  group.userData.baseY = group.position.y || 0;
  group.userData.ownMaterials = Array.from(cloneMap.values());
  return group;
}

// Resorte helicoidal metalico real para el polo negativo del portabaterias
function createBatterySpring(mats) {
  const pts = [];
  const turns = 4.5;
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = 4.8 * (1 - t * 0.62);
    const x = -34.2 + t * 5.6;
    const y = 13.0 + Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom = new THREE.TubeGeometry(curve, 64, 0.42, 8, false);
  return new THREE.Mesh(geom, mats.steel);
}

// 1. Portabaterias 18650 + Celda Li-Ion 18650 (en grupo separado para toggle y despiece)
function buildBatterySection(mats) {
  const holderGroup = new THREE.Group();
  holderGroup.name = 'batteryHolderGroup';
  const y0 = FRAME_LEVELS.deckSurfaceLocalY;

  // Base de la caja portabaterias (72.0 x 20.4 x 19.0 mm)
  const base = new THREE.Mesh(new THREE.BoxGeometry(72.0, 2.0, 20.4), mats.absHolder);
  base.position.set(0, y0 + 1.0, 0);
  holderGroup.add(base);

  // Paredes laterales largas (-Z y +Z)
  for (const sz of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(72.0, 17.2, 1.5), mats.absHolder);
    wall.position.set(0, y0 + 10.6, sz * 9.45);
    holderGroup.add(wall);

    // Labio superior interno de retencion
    const lip = new THREE.Mesh(new THREE.BoxGeometry(24.0, 1.4, 1.2), mats.absHolder);
    lip.position.set(0, y0 + 18.8, sz * 8.4);
    holderGroup.add(lip);
  }

  // Paredes extremas (-X resorte, +X polo dorado)
  for (const sx of [-1, 1]) {
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 18.2, 20.4), mats.absHolder);
    endWall.position.set(sx * 35.0, y0 + 10.1, 0);
    holderGroup.add(endWall);
  }

  // Resorte metalico en -X (lado MT3608)
  const springPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10.5, 9.5), mats.steel);
  springPlate.position.set(-33.7, y0 + 10.0, 0);
  holderGroup.add(springPlate);
  holderGroup.add(createBatterySpring(mats));

  // Terminal plano metalico dorado (+) en +X (lado MPU-6050)
  const posPlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 10.5, 9.5), mats.brass);
  posPlate.position.set(33.6, y0 + 10.0, 0);
  holderGroup.add(posPlate);

  const posButton = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 1.2, 16),
    mats.brass
  );
  posButton.rotation.z = Math.PI / 2;
  posButton.position.set(33.0, y0 + 10.5, 0);
  holderGroup.add(posButton);

  // Celda Li-Ion 18650 (65 x 18 mm) en su propio grupo para mostrar/ocultar
  const batteryCellGroup = new THREE.Group();
  batteryCellGroup.name = 'batteryCellGroup';
  const cellBaseY = y0 + 11.2;
  batteryCellGroup.position.set(0, cellBaseY, 0);
  batteryCellGroup.userData.baseY = cellBaseY;

  const cellBody = new THREE.Mesh(
    new THREE.CylinderGeometry(8.9, 8.9, 63.0, 32),
    mats.batteryWrap
  );
  cellBody.rotation.z = -Math.PI / 2;
  batteryCellGroup.add(cellBody);

  // Tapa negativa plana plateada hacia -X
  const negCap = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 7.8, 0.8, 24),
    mats.steel
  );
  negCap.rotation.z = Math.PI / 2;
  negCap.position.x = -31.8;
  batteryCellGroup.add(negCap);

  // Anillo aislante blanco y boton positivo en +X
  const posRing = new THREE.Mesh(
    new THREE.CylinderGeometry(8.2, 8.2, 0.8, 24),
    mats.whitePlastic
  );
  posRing.rotation.z = Math.PI / 2;
  posRing.position.x = 31.6;
  batteryCellGroup.add(posRing);

  const posNipple = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 4.0, 1.8, 20),
    mats.steel
  );
  posNipple.rotation.z = Math.PI / 2;
  posNipple.position.x = 32.3;
  batteryCellGroup.add(posNipple);

  return { holderGroup, batteryCellGroup };
}

// 2. Microcontrolador ESP32-WROOM-32D en ala delantera (-Z)
function buildEsp32(mats) {
  const group = new THREE.Group();
  group.name = 'esp32Group';
  const centerZ = -55.3;
  const pcbY = FRAME_LEVELS.deckSurfaceLocalY + 2.2;

  const pcb = makeBoard(27.0, 1.6, 54.0, mats.esp32Top, mats.pcbBlackSide);
  pcb.position.set(0, pcbY, centerZ);
  group.add(pcb);

  // Blindaje metalico RF plateado orientado hacia el centro (+Z del ala)
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(17.8, 3.0, 17.8),
    [mats.steel, mats.steel, mats.esp32Shield, mats.steel, mats.steel, mats.steel]
  );
  shield.position.set(0, pcbY + 2.3, centerZ + 12.2);
  group.add(shield);

  // Puerto Micro-USB en el extremo exterior (-Z)
  const usbShell = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.8, 5.4), mats.steel);
  usbShell.position.set(0, pcbY + 2.2, centerZ - 24.4);
  group.add(usbShell);

  const usbVoid = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 0.8), mats.blackPlastic);
  usbVoid.position.set(0, pcbY + 2.2, centerZ - 27.0);
  group.add(usbVoid);

  // Botones tactiles EN (-X) y BOOT (+X)
  for (const bx of [-7.6, 7.6]) {
    const btnBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 4.0), mats.steel);
    btnBase.position.set(bx, pcbY + 1.35, centerZ - 21.6);
    group.add(btnBase);

    const btnCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 1.0, 14),
      mats.blackPlastic
    );
    btnCap.position.set(bx, pcbY + 2.1, centerZ - 21.6);
    group.add(btnCap);
  }

  // Regulador AMS1117 + CP2102 USB-UART + LED rojo
  const ams = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 3.8), mats.blackPlastic);
  ams.position.set(-4.5, pcbY + 1.5, centerZ - 14.0);
  group.add(ams);

  const cp2102 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.0, 5.0), mats.blackPlastic);
  cp2102.position.set(0, pcbY + 1.3, centerZ - 14.5);
  group.add(cp2102);

  const pwrLed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.0), mats.ledRed);
  pwrLed.position.set(5.4, pcbY + 1.15, centerZ - 16.5);
  group.add(pwrLed);

  // Dos hileras reales de 19 pines (38 pines totales) atravesando por el deck
  const headerLen = (ESP32_HEADER.pinCount - 1) * ESP32_HEADER.pitch + 3.0;
  for (const px of [ESP32_HEADER.leftX, ESP32_HEADER.rightX]) {
    const headerBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, headerLen), mats.blackPlastic);
    headerBar.position.set(px, pcbY - 1.9, ESP32_HEADER.centerZ);
    group.add(headerBar);

    for (let i = 0; i < ESP32_HEADER.pinCount; i++) {
      const pz = getEsp32PinZ(i);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 9.2, 0.64), mats.steel);
      pin.position.set(px, pcbY - 3.6, pz);
      group.add(pin);
    }
  }

  return group;
}

// Pestana metalica TO-220 con perforacion circular real
function createMosfetTabGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-4.8, 0);
  shape.lineTo(4.8, 0);
  shape.lineTo(4.8, 5.4);
  shape.lineTo(-4.8, 5.4);
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 2.9, 1.75, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1.25,
    bevelEnabled: false,
    curveSegments: 16
  });
  geom.rotateY(Math.PI / 2);
  return geom;
}

// 3. Baquelita de Potencia (cara sup. ocre + cara inf. verde, riel B+, aritos rojos, 4 diodos transversales y doble riel central B-)
function buildMosfetBoard(mats) {
  const group = new THREE.Group();
  group.name = 'mosfetBoardGroup';
  const centerZ = MOSFET_BOARD_LAYOUT.centerZ;
  const boardY = FRAME_LEVELS.mosfetPostsLocalY + 0.8;

  const board = makeBoard(33.0, 1.6, 70.0, mats.bakeliteTop, mats.bakeliteEdge, mats.bakeliteBottom);
  board.position.set(0, boardY, centerZ);
  group.add(board);

  // Tornillos en los 4 postes (grandes arandelas verdosas en las 2 esquinas del lado -X)
  const corners = [
    { x: -12.8, z: 26.4, washer: true },
    { x: -12.8, z: 89.8, washer: true },
    { x:  12.8, z: 26.4, washer: false },
    { x:  12.8, z: 89.8, washer: false }
  ];
  for (const c of corners) {
    if (c.washer) {
      const washer = new THREE.Mesh(
        new THREE.CylinderGeometry(4.4, 4.4, 0.7, 24),
        mats.greenishWasher
      );
      washer.position.set(c.x, boardY + 1.15, c.z);
      group.add(washer);
    }

    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.3, 1.3, 16),
      mats.steel
    );
    head.position.set(c.x, boardY + (c.washer ? 2.0 : 1.35), c.z);
    group.add(head);
  }

  // 4 MOSFETs IRFZ44N alineados en X = -11.4 (frente negro hacia -X, pestana metalica hacia +X)
  const tabGeom = createMosfetTabGeometry();
  const zPositions = MOSFET_BOARD_LAYOUT.channelZ;
  const solderDomeGeom = new THREE.SphereGeometry(0.85, 10, 8);

  const addSolderDot = (x, y, z) => {
    const dot = new THREE.Mesh(solderDomeGeom, mats.steel);
    dot.scale.set(1, 0.45, 1);
    dot.position.set(x, y, z);
    group.add(dot);
  };

  zPositions.forEach((mz) => {
    const mosfet = new THREE.Group();
    mosfet.position.set(MOSFET_BOARD_LAYOUT.mosfetX, boardY + 0.8, mz);

    // Cuerpo plastico negro (frente hacia -X, lado del MT3608)
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 9.2, 10.0), mats.blackPlastic);
    body.position.set(-0.6, 6.2, 0);
    mosfet.add(body);

    // Pestana metalica trasera perforada (hacia +X)
    const tab = new THREE.Mesh(tabGeom, mats.steel);
    tab.position.set(0.85, 8.8, 0);
    mosfet.add(tab);

    // 3 pines metalicos: Pata 1 Gate (-2.54), Pata 2 Drain (0), Pata 3 Source (+2.54)
    for (const pz of [-2.54, 0, 2.54]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, 0.6), mats.steel);
      leg.position.set(0, 0.9, pz);
      mosfet.add(leg);
    }

    group.add(mosfet);

    // Diodo Flyback transversal en X cruzando el doble riel central (8 / 7):
    // Anodo (sin franja) hacia Drain (-X), Catodo (CON franja plateada) hacia +X (B+)
    const diodeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 5.2, 16),
      mats.blackPlastic
    );
    diodeBody.rotation.z = Math.PI / 2;
    diodeBody.position.set(0.05, boardY + 2.5, mz);
    group.add(diodeBody);

    const cathodeBand = new THREE.Mesh(
      new THREE.CylinderGeometry(1.28, 1.28, 1.05, 16),
      mats.steel
    );
    cathodeBand.rotation.z = Math.PI / 2;
    cathodeBand.position.set(1.75, boardY + 2.5, mz);
    group.add(cathodeBand);

    // Patas de anodo (-3.9) y catodo (+4.0) bajando a la placa
    const anodeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.5, boardY + 2.5, mz),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.anodeX, boardY + 2.35, mz),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.anodeX, boardY + 0.55, mz)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(anodeCurve, 10, 0.34, 8, false), mats.steel));

    const cathodeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.6, boardY + 2.5, mz),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.cathodeX, boardY + 2.35, mz),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.cathodeX, boardY + 0.55, mz)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(cathodeCurve, 10, 0.34, 8, false), mats.steel));

    // Arito rojo en arco: riel largo externo B+ (+14.2) -> tira del catodo (+7.5)
    const redArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.bPlusRailX, boardY + 0.65, mz + 0.9),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.bPlusRailX - 0.6, boardY + 3.2, mz + 0.7),
      new THREE.Vector3(10.8, boardY + 4.5, mz + 0.4),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.redArchInnerX + 0.6, boardY + 3.0, mz + 0.1),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.redArchInnerX, boardY + 0.65, mz)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(redArchCurve, 16, 0.45, 8, false), mats.wires.red));

    // Puente negro corto: Pata 3 Source (tira -6.4, mz+2.54) -> doble riel central B-/GND (-1.2, mz+2.54)
    const blackJumperCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.4, boardY + 0.65, mz + 2.54),
      new THREE.Vector3(-5.8, boardY + 2.5, mz + 2.54),
      new THREE.Vector3(-3.8, boardY + 3.3, mz + 2.54),
      new THREE.Vector3(-1.8, boardY + 2.4, mz + 2.54),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.gndRailLeftX, boardY + 0.65, mz + 2.54)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(blackJumperCurve, 14, 0.44, 8, false), mats.wires.black));

    // Puntos de soldadura superiores en B+, catodo, doble riel B- y Drain
    addSolderDot(MOSFET_BOARD_LAYOUT.bPlusRailX, boardY + 0.85, mz);
    addSolderDot(MOSFET_BOARD_LAYOUT.bPlusRailX, boardY + 0.85, mz + 0.9);
    addSolderDot(MOSFET_BOARD_LAYOUT.cathodeX, boardY + 0.85, mz);
    addSolderDot(MOSFET_BOARD_LAYOUT.redArchInnerX, boardY + 0.85, mz);
    addSolderDot(MOSFET_BOARD_LAYOUT.gndRailLeftX, boardY + 0.85, mz + 2.54);
    addSolderDot(MOSFET_BOARD_LAYOUT.anodeX, boardY + 0.85, mz);
    addSolderDot(MOSFET_BOARD_LAYOUT.drainTapX, boardY + 0.85, mz);
  });

  // Llegadas de potencia en riel externo B+ y doble riel central B-/GND
  addSolderDot(MOSFET_BOARD_LAYOUT.bPlusRailX, boardY + 0.85, 30.0);
  addSolderDot(MOSFET_BOARD_LAYOUT.bPlusRailX, boardY + 0.85, 32.2);
  addSolderDot(MOSFET_BOARD_LAYOUT.gndRailLeftX, boardY + 0.85, 31.0);
  addSolderDot(MOSFET_BOARD_LAYOUT.gndRailRightX, boardY + 0.85, 31.0);

  return group;
}

// 4. Elevador MT3608 en ala izquierda (-X, junto al resorte)
function buildMt3608(mats) {
  const group = new THREE.Group();
  group.name = 'mt3608Group';
  const centerX = -58.6;
  const pcbY = FRAME_LEVELS.deckSurfaceLocalY + 0.8;

  const pcb = makeBoard(36.0, 1.6, 16.0, mats.mt3608Top, mats.pcbBlueSide);
  pcb.position.set(centerX, pcbY, 0);
  group.add(pcb);

  // Inductor negro cuadrado con nucleo cilindrico (220) hacia el interior (+X)
  const indBase = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.4, 8.2), mats.blackPlastic);
  indBase.position.set(centerX + 6.8, pcbY + 3.0, 0.2);
  group.add(indBase);

  const indCore = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 4.6, 18),
    mats.absMatte
  );
  indCore.position.set(centerX + 6.8, pcbY + 3.0, 0.2);
  group.add(indCore);

  // Potenciometro multivuelta azul hacia el borde exterior (-X) con tornillo dorado en +Z
  const potBody = new THREE.Mesh(new THREE.BoxGeometry(9.4, 7.6, 4.8), mats.bluePot);
  potBody.position.set(centerX - 8.2, pcbY + 4.6, 0.0);
  group.add(potBody);

  const potScrew = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 1.4, 14),
    mats.brass
  );
  potScrew.rotation.x = Math.PI / 2;
  potScrew.position.set(centerX - 10.6, pcbY + 6.4, 2.8);
  group.add(potScrew);

  // Diodo Schottky SS34 y capacitores SMD
  const diode = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 2.6), mats.blackPlastic);
  diode.position.set(centerX - 0.5, pcbY + 1.9, -3.5);
  group.add(diode);

  for (const cz of [-1.2, 2.4]) {
    const smd = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 1.4), mats.bakeliteEdge);
    smd.position.set(centerX + 0.5, pcbY + 1.45, cz);
    group.add(smd);
  }

  // Brida negra de sujecion sobre el MT3608 (como en las fotos reales)
  const strap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 8.8, 17.6), mats.blackPlastic);
  strap.position.set(centerX - 8.2, pcbY + 4.6, 0);
  group.add(strap);

  // Cabezales DuPont en VIN+/VIN- (interior) y VOUT+/VOUT- (exterior)
  const termCoords = [
    { x: centerX + 15.6, z: -4.6 },
    { x: centerX + 15.6, z:  4.6 },
    { x: centerX - 15.6, z: -4.6 },
    { x: centerX - 15.6, z:  4.6 }
  ];
  for (const t of termCoords) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.4, 2.6), mats.blackPlastic);
    housing.position.set(t.x, pcbY + 3.0, t.z);
    group.add(housing);
  }

  return group;
}

// 5. Giroscopio MPU-6050 en ala derecha (+X, junto al terminal dorado +)
function buildMpu6050(mats) {
  const group = new THREE.Group();
  group.name = 'mpu6050Group';
  const centerX = 55.3;
  const pcbY = FRAME_LEVELS.deckSurfaceLocalY + 0.8;

  const pcb = makeBoard(20.0, 1.6, 15.5, mats.mpu6050Top, mats.pcbBlueSide);
  pcb.position.set(centerX, pcbY, 0);
  group.add(pcb);

  // Chip QFN-24 negro central
  const qfn = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 4.2), mats.blackPlastic);
  qfn.position.set(centerX, pcbY + 1.25, 1.2);
  group.add(qfn);

  // Regulador LDO y LED verde SMD
  const ldo = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 1.8), mats.blackPlastic);
  ldo.position.set(centerX - 4.8, pcbY + 1.3, 3.8);
  group.add(ldo);

  const led = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.9), mats.ledGreen);
  led.position.set(centerX + 5.2, pcbY + 1.1, 4.2);
  group.add(led);

  // Peine horizontal de 8 pines metalicos hacia el borde -Z (apuntando hacia el ESP32)
  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(18.0, 2.4, 2.4), mats.blackPlastic);
  headerBar.position.set(centerX, pcbY + 2.0, -6.2);
  group.add(headerBar);

  for (let i = 0; i < 8; i++) {
    const px = centerX - 7.7 + i * 2.2;
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 6.2), mats.steel);
    pin.position.set(px, pcbY + 2.0, -9.2);
    group.add(pin);
  }

  return group;
}

export function buildElectronics(mats) {
  const { holderGroup, batteryCellGroup } = buildBatterySection(mats);
  const esp32Group = isolateComponentMaterials(buildEsp32(mats));
  const mosfetBoardGroup = isolateComponentMaterials(buildMosfetBoard(mats));
  const mt3608Group = isolateComponentMaterials(buildMt3608(mats));
  const mpu6050Group = isolateComponentMaterials(buildMpu6050(mats));

  const deckElectronicsGroup = new THREE.Group();
  deckElectronicsGroup.name = 'deckElectronicsGroup';
  deckElectronicsGroup.add(
    holderGroup,
    esp32Group,
    mosfetBoardGroup,
    mt3608Group,
    mpu6050Group
  );

  enableShadows(deckElectronicsGroup);
  enableShadows(batteryCellGroup);

  return {
    deckElectronicsGroup,
    batteryCellGroup,
    components: {
      esp32: esp32Group,
      mosfets: mosfetBoardGroup,
      mt3608: mt3608Group,
      mpu6050: mpu6050Group
    }
  };
}
