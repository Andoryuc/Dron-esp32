import * as THREE from 'three';

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function makeTexture(canvas, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Micro-bump procedural sutil para simular grano fino de impresion ABS mate
function createAbsBumpTexture() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < size; y++) {
    const layerWave = Math.sin((y / size) * Math.PI * 36) * 8;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const grain = (rand() - 0.5) * 32;
      const v = Math.max(0, Math.min(255, Math.round(128 + grain + layerWave)));
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = makeTexture(canvas, false);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function createEsp32PcbTexture() {
  const { canvas, ctx } = createCanvas(512, 1024);
  ctx.fillStyle = '#12151a';
  ctx.fillRect(0, 0, 512, 1024);

  // Pistas finas en cobre bajo mascara negra
  ctx.strokeStyle = '#1f2630';
  ctx.lineWidth = 3;
  for (let i = 0; i < 19; i++) {
    const y = 78 + i * 48.2;
    ctx.beginPath();
    ctx.moveTo(46, y);
    ctx.lineTo(130, y);
    ctx.lineTo(185, y + (i % 2 === 0 ? 16 : -16));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(466, y);
    ctx.lineTo(382, y);
    ctx.lineTo(327, y + (i % 2 === 0 ? -16 : 16));
    ctx.stroke();
  }

  // Zona de antena PCB en el extremo inferior (+Z hacia centro)
  ctx.strokeStyle = '#c8a355';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(150, 1002);
  ctx.lineTo(150, 932);
  ctx.lineTo(220, 932);
  ctx.lineTo(220, 994);
  ctx.lineTo(290, 994);
  ctx.lineTo(290, 932);
  ctx.lineTo(360, 932);
  ctx.lineTo(360, 1002);
  ctx.stroke();

  // Peine real de 19+19 pines (i=0 en antena +Z y=945.5, i=18 en USB -Z y=78.5)
  // Cara +Y: x=482 es +X (lado izquierdo en vista frontal -> 3V3..5V)
  //           x=30  es -X (lado derecho en vista frontal -> GND..GND)
  const posXLabels = ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13', 'D2', 'D3', 'CMD', '5V'];
  const negXLabels = ['GND', '23', '22', 'TX', 'RX', '21', '19', '18', '5', '17', '16', '4', '0', '2', '15', 'D1', 'D0', 'CLK', 'GND'];
  const connectedPosX = new Set([0, 8, 9, 10, 11, 18]); // 3V3, 25, 26, 27, 14, 5V
  const connectedNegX = new Set([2, 5, 18]);            // 22, 21, GND

  ctx.font = 'bold 15px monospace';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 19; i++) {
    const zMm = -32.44 - i * 2.54;
    const py = ((zMm - (-82.3)) / 54.0) * 1024;

    ctx.fillStyle = connectedNegX.has(i) ? '#f0cf7a' : '#c9ccd1';
    ctx.beginPath();
    ctx.arc(30, py, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = connectedPosX.has(i) ? '#f0cf7a' : '#c9ccd1';
    ctx.beginPath();
    ctx.arc(482, py, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f1216';
    ctx.beginPath();
    ctx.arc(30, py, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(482, py, 4.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = connectedNegX.has(i) ? '#ffffff' : '#bfc8d4';
    ctx.textAlign = 'left';
    ctx.fillText(negXLabels[i], 46, py);

    ctx.fillStyle = connectedPosX.has(i) ? '#ffffff' : '#bfc8d4';
    ctx.textAlign = 'right';
    ctx.fillText(posXLabels[i], 466, py);
  }

  // Etiquetas EN (+X) y BOOT (-X) junto al Micro-USB (-Z exterior)
  ctx.fillStyle = '#e6ebf2';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOOT', 112, 182);
  ctx.fillText('EN', 398, 182);
  ctx.font = 'bold 19px sans-serif';
  ctx.fillStyle = '#aeb7c4';
  ctx.fillText('ESP32 DEVKIT 38P', 256, 392);

  return makeTexture(canvas, true);
}

function createEsp32ShieldTexture() {
  const { canvas, ctx } = createCanvas(512, 512);
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#cfd5dc');
  grad.addColorStop(0.5, '#dde2e8');
  grad.addColorStop(1, '#bcc3cc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#9aa2ad';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, 476, 476);

  ctx.fillStyle = '#525a64';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ESP-WROOM-32D', 256, 150);

  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('CE', 256, 250);

  ctx.font = '24px monospace';
  ctx.fillText('FCC ID: 2AC7Z-ESPWROOM32D', 256, 330);
  ctx.fillText('Wi-Fi + BLE MCU', 256, 385);

  return makeTexture(canvas, true);
}

function getBakeliteGridCoords() {
  const colsX = [];
  for (let c = 0; c < 12; c++) {
    colsX.push(-13.97 + c * 2.54);
  }
  const rowsZ = [];
  for (let r = 0; r < 25; r++) {
    rowsZ.push(27.6 + r * 2.54);
  }
  const toPxX = (xMm) => ((xMm + 16.5) / 33.0) * 512;
  const toPxZTop = (zMm) => ((zMm - 23.1) / 70.0) * 1024;
  const toPxZBottom = (zMm) => (1 - (zMm - 23.1) / 70.0) * 1024;
  return { colsX, rowsZ, toPxX, toPxZTop, toPxZBottom };
}

function createBakeliteTopTexture() {
  const { canvas, ctx } = createCanvas(512, 1024);
  const { colsX, rowsZ, toPxX, toPxZTop } = getBakeliteGridCoords();

  // Cara superior ocre fenolica fiel a las fotos reales
  ctx.fillStyle = '#c59c57';
  ctx.fillRect(0, 0, 512, 1024);

  // Veta sutil fenolica
  ctx.fillStyle = 'rgba(130, 88, 30, 0.08)';
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 1024;
    ctx.fillRect(x, y, 22, 6);
  }

  // Guias suaves indicando el riel largo B+ (+X) y el doble riel central B-/GND (8, 7)
  ctx.fillStyle = 'rgba(214, 40, 40, 0.14)';
  ctx.fillRect(toPxX(colsX[11]) - 14, 34, 28, 956);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.09)';
  ctx.fillRect(toPxX(colsX[5]) - 12, 34, 24, 956);
  ctx.fillRect(toPxX(colsX[6]) - 12, 34, 24, 956);

  // Rejilla de perforaciones (2.54 mm -> 12 columnas x 25 filas)
  for (let r = 0; r < rowsZ.length; r++) {
    const cy = toPxZTop(rowsZ[r]);
    for (let c = 0; c < colsX.length; c++) {
      const cx = toPxX(colsX[c]);

      ctx.fillStyle = '#b97e38';
      ctx.beginPath();
      ctx.arc(cx, cy, 8.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#332414';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Serigrafia blanca fiel a las fotos (X W V U | 8 7 | T S R Q + <--- P3 --->)
  ctx.fillStyle = '#f8f3e6';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  const labels = ['X', 'W', 'V', 'U', '8', '7', 'T', 'S', 'R', 'Q'];
  for (let i = 0; i < labels.length; i++) {
    const px = toPxX(colsX[i + 1]);
    ctx.fillText(labels[i], px, 982);
  }
  ctx.fillText('P4      P3', toPxX(-4.0), 46);

  ctx.save();
  ctx.translate(toPxX(15.2), 512);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 17px monospace';
  ctx.fillText('<--- P3 / B+ --->', 0, 0);
  ctx.restore();

  return makeTexture(canvas, true);
}

function createBakeliteBottomTexture() {
  const { canvas, ctx } = createCanvas(512, 1024);
  const { colsX, rowsZ, toPxX, toPxZBottom } = getBakeliteGridCoords();

  // Cara inferior verde con mascara antisoldante fiel a la foto real (8.44.46 AM.jpeg)
  ctx.fillStyle = '#1e7a34';
  ctx.fillRect(0, 0, 512, 1024);

  // Sutil textura de fibra de vidrio FR4/fenolica
  ctx.fillStyle = 'rgba(12, 60, 22, 0.16)';
  for (let i = 0; i < 280; i++) {
    ctx.fillRect((i * 89) % 512, (i * 151) % 1024, 30, 5);
  }

  // Pistas de cobre doradas:
  // 1. Tiras cortas transversales lado MOSFET (X-W-V-U) y lado diodo/B+ (T-S-R-Q)
  ctx.strokeStyle = '#d39f42';
  ctx.lineCap = 'round';
  ctx.lineWidth = 17;

  const leftStripStart = toPxX(colsX[1]);
  const leftStripEnd = toPxX(colsX[4]);
  const rightStripStart = toPxX(colsX[7]);
  const rightStripEnd = toPxX(colsX[10]);

  for (let r = 0; r < rowsZ.length; r++) {
    const cy = toPxZBottom(rowsZ[r]);
    ctx.beginPath();
    ctx.moveTo(leftStripStart, cy);
    ctx.lineTo(leftStripEnd, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightStripStart, cy);
    ctx.lineTo(rightStripEnd, cy);
    ctx.stroke();
  }

  // 2. Doble riel central longitudinal continuo (columnas 8 y 7 = B- / GND)
  //    y riel largo externo continuo en +X (columna 11 = B+)
  const topY = toPxZBottom(rowsZ[rowsZ.length - 1]);
  const botY = toPxZBottom(rowsZ[0]);
  for (const railCol of [5, 6, 11]) {
    const rx = toPxX(colsX[railCol]);
    ctx.beginPath();
    ctx.moveTo(rx, topY);
    ctx.lineTo(rx, botY);
    ctx.stroke();
  }

  // Pads cobrizos y perforaciones
  for (let r = 0; r < rowsZ.length; r++) {
    const cy = toPxZBottom(rowsZ[r]);
    for (let c = 0; c < colsX.length; c++) {
      const cx = toPxX(colsX[c]);

      ctx.fillStyle = '#e0b153';
      ctx.beginPath();
      ctx.arc(cx, cy, 8.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#153a1d';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Puntos y puentes brillantes de estano en los 4 canales reales + buses B+ / B-
  const drawSolderBlob = (x1Mm, x2Mm, z1Mm, z2Mm, radius = 9.5) => {
    const p1x = toPxX(x1Mm);
    const p1y = toPxZBottom(z1Mm);
    const p2x = toPxX(x2Mm);
    const p2y = toPxZBottom(z2Mm);

    ctx.strokeStyle = '#cfd8e3';
    ctx.lineWidth = radius * 1.45;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = radius * 0.55;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();
  };

  for (const mz of [35.5, 50.0, 64.5, 79.0]) {
    // Gate -> cable PWM
    drawSolderBlob(-11.4, -8.9, mz - 2.54, mz - 2.54, 8.0);
    // Drain + M- + Anodo Diodo
    drawSolderBlob(-11.4, -3.9, mz, mz, 9.5);
    // Source + puente negro hacia riel central 8
    drawSolderBlob(-11.4, -6.4, mz + 2.54, mz + 2.54, 8.5);
    drawSolderBlob(-1.2, -1.2, mz + 2.54, mz + 2.54, 10.0);
    // Catodo Diodo + arito rojo en tira T-S-R-Q
    drawSolderBlob(4.0, 8.5, mz, mz, 9.0);
    // Conexiones de arito rojo + M+ sobre riel largo externo B+
    drawSolderBlob(14.0, 14.0, mz, mz + 1.0, 10.0);
  }
  // Llegadas de potencia B+ / VIN+ y B- / VIN-
  drawSolderBlob(14.0, 14.0, 30.0, 32.0, 11.0);
  drawSolderBlob(-1.2, 1.3, 31.0, 31.0, 10.5);

  return makeTexture(canvas, true);
}

function createMt3608PcbTexture() {
  const { canvas, ctx } = createCanvas(512, 256);
  ctx.fillStyle = '#1258a8';
  ctx.fillRect(0, 0, 512, 256);

  // Borde serigrafico blanco
  ctx.strokeStyle = '#e7eff8';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  // Pines en los 4 extremos (izquierda VOUT, derecha VIN)
  const pads = [
    { x: 34, y: 54, label: 'VOUT+' },
    { x: 34, y: 202, label: 'VOUT-' },
    { x: 478, y: 54, label: 'VIN+' },
    { x: 478, y: 202, label: 'VIN-' }
  ];
  ctx.font = 'bold 22px monospace';
  ctx.textBaseline = 'middle';

  for (const p of pads) {
    ctx.fillStyle = '#d3d9e2';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#102948';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = p.x < 256 ? 'left' : 'right';
    ctx.fillText(p.label, p.x < 256 ? p.x + 24 : p.x - 24, p.y);
  }

  ctx.fillStyle = '#dce9f8';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('MT3608 DC-DC', 265, 224);

  return makeTexture(canvas, true);
}

function createMpu6050PcbTexture() {
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = '#145ab0';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#e6eef8';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 240, 240);

  // Peine de 8 pines en la parte superior (-Z en mapa)
  const pinNames = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'];
  ctx.font = 'bold 14px monospace';
  for (let i = 0; i < 8; i++) {
    const px = 28 + i * 28;
    ctx.fillStyle = '#d4dae2';
    ctx.beginPath();
    ctx.arc(px, 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f2744';
    ctx.beginPath();
    ctx.arc(px, 26, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(px, 56);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(pinNames[i], 0, 0);
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MPU-6050', 128, 224);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('GY-521', 128, 200);

  return makeTexture(canvas, true);
}

function createBatteryWrapTexture() {
  const { canvas, ctx } = createCanvas(512, 256);
  // Envoltorio rojo metalico brillante fiel a la celda real de las fotos (v=1 +X, v=0 -X)
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#7f1d1d');
  grad.addColorStop(0.14, '#b91c1c');
  grad.addColorStop(0.5, '#ef4444');
  grad.addColorStop(0.86, '#dc2626');
  grad.addColorStop(1.0, '#7f1d1d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Bandas circunferenciales negras/plateadas como en la celda real
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 26, 512, 16);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 42, 512, 4);
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 222, 512, 10);

  // Franja de especificaciones alineada a u=0.75 (cara superior +Y visible)
  for (const cx of [128, 384]) {
    ctx.save();
    ctx.translate(cx, 134);
    ctx.rotate(Math.PI / 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('18650  3.7V  Li-Ion', 0, -14);

    ctx.fillStyle = '#fee2e2';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('HIGH DRAIN CELL', 0, 12);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('+', -88, 0);
    ctx.fillText('-', 88, 0);
    ctx.restore();
  }

  return makeTexture(canvas, true);
}

export function createMaterialLibrary() {
  const absBump = createAbsBumpTexture();

  const absMatte = new THREE.MeshStandardMaterial({
    color: 0x181b20,
    roughness: 0.56,
    metalness: 0.08,
    bumpMap: absBump,
    bumpScale: 0.14
  });

  const absHolder = new THREE.MeshStandardMaterial({
    color: 0x15181d,
    roughness: 0.52,
    metalness: 0.06
  });

  const propBlack = new THREE.MeshStandardMaterial({
    color: 0x191c22,
    roughness: 0.42,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const propStripeWhite = new THREE.MeshStandardMaterial({
    color: 0xf6f8fb,
    roughness: 0.35,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const propMotionBlur = new THREE.MeshBasicMaterial({
    color: 0x20252d,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const steel = new THREE.MeshStandardMaterial({
    color: 0xd8dde4,
    metalness: 0.88,
    roughness: 0.24
  });

  const steelDark = new THREE.MeshStandardMaterial({
    color: 0x8f97a3,
    metalness: 0.82,
    roughness: 0.32
  });

  const brass = new THREE.MeshStandardMaterial({
    color: 0xd9aa3c,
    metalness: 0.86,
    roughness: 0.24
  });

  const greenishWasher = new THREE.MeshStandardMaterial({
    color: 0xb7c879,
    metalness: 0.66,
    roughness: 0.32
  });

  const blackPlastic = new THREE.MeshStandardMaterial({
    color: 0x1b1e24,
    roughness: 0.45,
    metalness: 0.08
  });

  const whitePlastic = new THREE.MeshStandardMaterial({
    color: 0xf1f4f8,
    roughness: 0.4,
    metalness: 0.04
  });

  const bluePot = new THREE.MeshStandardMaterial({
    color: 0x1565c0,
    roughness: 0.38,
    metalness: 0.08
  });

  const pcbBlackSide = new THREE.MeshStandardMaterial({
    color: 0x13161b,
    roughness: 0.52,
    metalness: 0.08
  });

  const pcbBlueSide = new THREE.MeshStandardMaterial({
    color: 0x1254a0,
    roughness: 0.46,
    metalness: 0.08
  });

  const esp32Top = new THREE.MeshStandardMaterial({
    map: createEsp32PcbTexture(),
    roughness: 0.44,
    metalness: 0.1
  });

  const esp32Shield = new THREE.MeshStandardMaterial({
    map: createEsp32ShieldTexture(),
    roughness: 0.28,
    metalness: 0.82
  });

  const bakeliteTop = new THREE.MeshStandardMaterial({
    map: createBakeliteTopTexture(),
    roughness: 0.54,
    metalness: 0.06
  });

  const bakeliteBottom = new THREE.MeshStandardMaterial({
    map: createBakeliteBottomTexture(),
    roughness: 0.44,
    metalness: 0.14
  });

  const bakeliteEdge = new THREE.MeshStandardMaterial({
    color: 0xb98d47,
    roughness: 0.58,
    metalness: 0.05
  });

  const mt3608Top = new THREE.MeshStandardMaterial({
    map: createMt3608PcbTexture(),
    roughness: 0.42,
    metalness: 0.1
  });

  const mpu6050Top = new THREE.MeshStandardMaterial({
    map: createMpu6050PcbTexture(),
    roughness: 0.42,
    metalness: 0.1
  });

  const batteryWrap = new THREE.MeshStandardMaterial({
    map: createBatteryWrapTexture(),
    roughness: 0.24,
    metalness: 0.42
  });

  const ledRed = new THREE.MeshStandardMaterial({
    color: 0xff2b2b,
    emissive: 0xcc1414,
    emissiveIntensity: 0.65,
    roughness: 0.3
  });

  const ledGreen = new THREE.MeshStandardMaterial({
    color: 0x22e564,
    emissive: 0x10a840,
    emissiveIntensity: 0.6,
    roughness: 0.3
  });

  const wires = {
    orange: new THREE.MeshStandardMaterial({ color: 0xee6c1c, roughness: 0.42, metalness: 0.04 }),
    darkGray: new THREE.MeshStandardMaterial({ color: 0x4f555e, roughness: 0.46, metalness: 0.05 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.42, metalness: 0.04 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1e2229, roughness: 0.46, metalness: 0.06 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1f4f8, roughness: 0.38, metalness: 0.04 }),
    lightGray: new THREE.MeshStandardMaterial({ color: 0xa4abb5, roughness: 0.42, metalness: 0.05 }),
    brown: new THREE.MeshStandardMaterial({ color: 0x7b634b, roughness: 0.45, metalness: 0.05 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42, metalness: 0.04 }),
    green: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.42, metalness: 0.04 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe6b81c, roughness: 0.42, metalness: 0.04 })
  };

  return {
    absMatte,
    absHolder,
    propBlack,
    propStripeWhite,
    propMotionBlur,
    steel,
    steelDark,
    brass,
    greenishWasher,
    blackPlastic,
    whitePlastic,
    bluePot,
    pcbBlackSide,
    pcbBlueSide,
    esp32Top,
    esp32Shield,
    bakeliteTop,
    bakeliteBottom,
    bakeliteEdge,
    mt3608Top,
    mpu6050Top,
    batteryWrap,
    ledRed,
    ledGreen,
    wires
  };
}
