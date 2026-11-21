import * as THREE from 'three';
import {
  FRAME_LEVELS,
  EXPLODE_OFFSETS,
  COLUMN_ANCHORS,
  MOTORS,
  MOTOR_Y,
  MOSFET_BOARD_LAYOUT,
  ESP32_HEADER,
  getEsp32PinZ
} from './config.js';

function createTube(points, radius, material, tubularSegments = 48) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
  const geom = new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false);
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCableClamp(pos, size, rotY, material) {
  const clamp = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material
  );
  clamp.position.set(pos[0], pos[1], pos[2]);
  clamp.rotation.y = rotY;
  clamp.castShadow = true;
  return clamp;
}

export function buildWiring(mats) {
  // Cables fijos montados sobre el 2.o piso (acompanan al deck al explotar)
  const deckWiringGroup = new THREE.Group();
  deckWiringGroup.name = 'deckWiringGroup';

  // Cables dinamicos entre 2.o piso -> columnas V -> brazos -> 4 motores
  const motorWiringGroup = new THREE.Group();
  motorWiringGroup.name = 'motorWiringGroup';

  const rPower = 0.65;
  const rSignal = 0.48;
  const rI2C = 0.42;
  const rMotor = 0.56;

  // 1. Alimentacion B+ / VIN+ (naranja MT3608 -> riel B+ baquelita pasando por polo + bateria)
  //    y VIN- (gris oscuro MT3608 -> doble riel central B-/GND pasando por polo - bateria)
  deckWiringGroup.add(createTube([
    new THREE.Vector3(-43.0, 7.6, -4.6),
    new THREE.Vector3(-39.0, 8.2, -7.8),
    new THREE.Vector3(-24.0, 6.2, -11.4),
    new THREE.Vector3(  6.0, 6.2, -11.4),
    new THREE.Vector3( 31.5, 8.8, -9.8),
    new THREE.Vector3( 34.0, 12.8, -3.2),
    new THREE.Vector3( 24.5,  6.8, 12.5),
    new THREE.Vector3( 17.5,  7.4, 22.0),
    new THREE.Vector3(MOSFET_BOARD_LAYOUT.bPlusRailX, 9.6, 30.0)
  ], rPower, mats.wires.orange, 72));

  deckWiringGroup.add(createTube([
    new THREE.Vector3(-43.0, 7.6,  4.6),
    new THREE.Vector3(-39.5, 8.5,  5.8),
    new THREE.Vector3(-36.2, 11.2, 4.6),
    new THREE.Vector3(-34.0, 12.8, 2.2),
    new THREE.Vector3(-28.0,  7.2, 11.0),
    new THREE.Vector3(-16.0,  6.2, 19.5),
    new THREE.Vector3( -6.5,  7.8, 26.5),
    new THREE.Vector3(MOSFET_BOARD_LAYOUT.gndRailLeftX, 9.5, 31.0)
  ], rPower, mats.wires.darkGray, 60));

  // Abrazadera en el costado -Z del portabaterias
  deckWiringGroup.add(createCableClamp([-8.0, 6.2, -11.4], [2.4, 2.6, 2.4], 0, mats.blackPlastic));

  // 2. Alimentacion MT3608 -> ESP32 (VOUT+ naranja a 5V/VIN +11.8, VOUT- gris oscuro a GND -11.8)
  const espUsbRowZ = getEsp32PinZ(18);
  deckWiringGroup.add(createTube([
    new THREE.Vector3(-74.2,  7.6,  -4.6),
    new THREE.Vector3(-73.0,  6.2, -10.8),
    new THREE.Vector3(-54.0,  5.2, -11.5),
    new THREE.Vector3(-34.0,  0.4, -18.5),
    new THREE.Vector3(-23.5, -2.6, -36.0),
    new THREE.Vector3(-18.0, -3.2, -62.0),
    new THREE.Vector3( -7.0, -4.4, -82.0),
    new THREE.Vector3(ESP32_HEADER.leftX, -3.2, espUsbRowZ - 1.5),
    new THREE.Vector3(ESP32_HEADER.leftX, -2.2, espUsbRowZ)
  ], rPower, mats.wires.orange, 76));

  deckWiringGroup.add(createTube([
    new THREE.Vector3(-74.2,  7.6,   4.6),
    new THREE.Vector3(-76.5,  6.2,  -2.5),
    new THREE.Vector3(-73.5,  5.6, -12.0),
    new THREE.Vector3(-54.0,  4.6, -12.8),
    new THREE.Vector3(-34.5, -0.2, -20.0),
    new THREE.Vector3(-24.8, -3.0, -36.0),
    new THREE.Vector3(-19.2, -3.0, -60.0),
    new THREE.Vector3(ESP32_HEADER.rightX, -2.2, espUsbRowZ)
  ], rPower, mats.wires.darkGray, 68));

  deckWiringGroup.add(createCableClamp([-63.0, 5.2, -12.1], [2.4, 2.8, 3.2], 0, mats.blackPlastic));
  deckWiringGroup.add(createCableClamp([-44.0, 4.8, -12.2], [2.4, 2.8, 3.2], 0, mats.blackPlastic));

  // 3. Potencia principal B+ / B- (rojo y negro) portabaterias -> rieles baquelita MOSFET
  deckWiringGroup.add(createTube([
    new THREE.Vector3( 34.0, 11.8,  2.4),
    new THREE.Vector3( 31.5,  7.4,  9.5),
    new THREE.Vector3( 22.0,  5.4, 16.5),
    new THREE.Vector3( 17.0,  7.6, 25.0),
    new THREE.Vector3(MOSFET_BOARD_LAYOUT.bPlusRailX, 9.6, 32.2)
  ], rPower, mats.wires.red, 44));

  deckWiringGroup.add(createTube([
    new THREE.Vector3(-34.0, 11.8, -2.4),
    new THREE.Vector3(-30.5,  7.2,  9.8),
    new THREE.Vector3(-21.2,  5.4, 15.8),
    new THREE.Vector3(-10.5,  7.4, 24.5),
    new THREE.Vector3(MOSFET_BOARD_LAYOUT.gndRailRightX, 9.5, 31.0)
  ], rPower, mats.wires.black, 44));

  // 4. Cinta paralela de 4 hilos PWM blancos (ESP32 GPIO 25, 26, 27, 14 -> 4 Gates MOSFET)
  const pwmStartZ = [getEsp32PinZ(8), getEsp32PinZ(9), getEsp32PinZ(10), getEsp32PinZ(11)];
  const mosfetZ = MOSFET_BOARD_LAYOUT.channelZ;

  for (let i = 0; i < 4; i++) {
    const laneOffset = (i - 1.5) * 1.1;
    deckWiringGroup.add(createTube([
      new THREE.Vector3(ESP32_HEADER.leftX, -2.2, pwmStartZ[i]),
      new THREE.Vector3(14.5 + laneOffset * 0.3, -2.4, pwmStartZ[i] + 6.0),
      new THREE.Vector3( 4.0 + laneOffset, -2.2, -26.0),
      new THREE.Vector3(-6.0 + laneOffset, -1.8,   0.0),
      new THREE.Vector3(-9.0 + laneOffset, -1.4,  21.0),
      new THREE.Vector3(-12.8,  5.2, mosfetZ[i] - 5.2),
      new THREE.Vector3(-10.2,  8.8, mosfetZ[i] - 2.6),
      new THREE.Vector3(MOSFET_BOARD_LAYOUT.mosfetX + 2.5, 9.5, mosfetZ[i] - 2.54)
    ], rSignal, mats.wires.white, 76));
  }

  // Micro-abrazaderas para la cinta PWM bajo el deck
  deckWiringGroup.add(createCableClamp([ 4.0, -2.2, -26.0], [6.0, 2.0, 2.4], 0.35, mats.blackPlastic));
  deckWiringGroup.add(createCableClamp([-6.0, -1.8,   0.0], [6.0, 2.0, 2.4], 0.15, mats.blackPlastic));
  deckWiringGroup.add(createCableClamp([-9.0, -1.4,  21.0], [6.0, 2.0, 2.4], 0, mats.blackPlastic));

  // 5. Bus I2C MPU-6050 -> ESP32 (VCC rojo->3V3, GND negro->GND, SCL verde->GPIO22, SDA azul->GPIO21)
  const i2cSpecs = [
    { pinX: 47.6, espX: ESP32_HEADER.leftX,  espZ: getEsp32PinZ(0),  mat: mats.wires.red,   off: -1.35, cross: false },
    { pinX: 49.8, espX: ESP32_HEADER.rightX, espZ: getEsp32PinZ(0),  mat: mats.wires.black, off: -0.45, cross: true },
    { pinX: 52.0, espX: ESP32_HEADER.rightX, espZ: getEsp32PinZ(2),  mat: mats.wires.green, off:  0.45, cross: true },
    { pinX: 54.2, espX: ESP32_HEADER.rightX, espZ: getEsp32PinZ(5),  mat: mats.wires.blue,  off:  1.35, cross: true }
  ];

  for (const wire of i2cSpecs) {
    const midPts = wire.cross
      ? [
          new THREE.Vector3( 5.0, -2.8, wire.espZ + 2.2),
          new THREE.Vector3(wire.espX - 2.2, -2.5, wire.espZ + 0.8),
          new THREE.Vector3(wire.espX, -2.2, wire.espZ)
        ]
      : [
          new THREE.Vector3(16.5 + wire.off, -2.0, -34.0),
          new THREE.Vector3(wire.espX, -2.2, wire.espZ)
        ];

    deckWiringGroup.add(createTube([
      new THREE.Vector3(wire.pinX, 5.0, -11.8),
      new THREE.Vector3(wire.pinX - 3.0, 4.6, -15.5 - wire.off),
      new THREE.Vector3(28.0, -1.6, -19.5 - wire.off),
      new THREE.Vector3(21.5 + wire.off, -1.8, -28.0),
      ...midPts
    ], rI2C, wire.mat, 60));
  }
  deckWiringGroup.add(createCableClamp([21.5, -1.8, -28.0], [5.4, 2.0, 2.4], 0.35, mats.blackPlastic));

  // 6. Ocho cables de motores (4 pares M+ desde riel B+ en +X y M- desde Drain en -X) dinamicos con el despiece
  const motorAssignments = [
    { motor: MOTORS[0], anchor: COLUMN_ANCHORS[2], drainZ: MOSFET_BOARD_LAYOUT.channelZ[0] },
    { motor: MOTORS[1], anchor: COLUMN_ANCHORS[3], drainZ: MOSFET_BOARD_LAYOUT.channelZ[1] },
    { motor: MOTORS[2], anchor: COLUMN_ANCHORS[1], drainZ: MOSFET_BOARD_LAYOUT.channelZ[2] },
    { motor: MOTORS[3], anchor: COLUMN_ANCHORS[0], drainZ: MOSFET_BOARD_LAYOUT.channelZ[3] }
  ];

  function rebuildMotorWiring(explodeT) {
    // Liberar geometrias anteriores para evitar fugas en el slider
    while (motorWiringGroup.children.length > 0) {
      const child = motorWiringGroup.children[0];
      motorWiringGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const deckY = FRAME_LEVELS.upperDeckBaseY + explodeT * EXPLODE_OFFSETS.deckLift;
    const colBaseY = FRAME_LEVELS.armTopY + explodeT * EXPLODE_OFFSETS.columnsLift;
    const armY = 12.2;

    for (const item of motorAssignments) {
      const { motor, anchor, drainZ } = item;
      const sx = Math.sign(motor.x);
      const sz = Math.sign(motor.z);
      const wireMat = mats.wires[motor.wireColor];
      const darkReturnMat = mats.wires.black;

      // Posicion de la rodilla de la columna V en XZ (~9.17, 9.17)
      const colTopX = sx * 16.4;
      const colTopZ = sz * 16.4;
      const colKneeX = sx * 11.0;
      const colKneeZ = sz * 11.0;
      const colBotX = anchor.x - sx * 2.2;
      const colBotZ = anchor.z - sz * 2.2;

      const pairConfigs = [
        { offset: -0.75, startX: MOSFET_BOARD_LAYOUT.bPlusRailX, mat: wireMat },
        { offset:  0.75, startX: MOSFET_BOARD_LAYOUT.drainTapX,  mat: darkReturnMat }
      ];

      for (const pair of pairConfigs) {
        const perpX = -sz * pair.offset;
        const perpZ = sx * pair.offset;

        const pts = [
          // Salida bajo la baquelita MOSFET del 2.o piso (M+ en B+, M- en Drain)
          new THREE.Vector3(pair.startX, deckY + 7.4, drainZ),
          new THREE.Vector3(sx * 10.0 + perpX, deckY - 0.8, Math.min(45, drainZ - 8)),
          new THREE.Vector3(colTopX + perpX, deckY - 1.5, colTopZ + perpZ),
          // Desciende cenido por el interior de la columna V
          new THREE.Vector3(colKneeX + perpX, colBaseY + 18.0, colKneeZ + perpZ),
          new THREE.Vector3(colBotX + perpX, colBaseY + 2.5, colBotZ + perpZ),
          // Entra por el canal interior del brazo hacia el motor
          new THREE.Vector3(sx * 32.0 + perpX, armY, sz * 32.0 + perpZ),
          new THREE.Vector3(motor.armAnchorX + perpX, armY - 1.5, motor.armAnchorZ + perpZ),
          new THREE.Vector3(motor.x - sx * 11.5 + perpX, MOTOR_Y.hubCenterY, motor.z - sz * 11.5 + perpZ)
        ];

        motorWiringGroup.add(createTube(pts, rMotor, pair.mat, 54));
      }
    }
  }

  rebuildMotorWiring(0);

  return {
    deckWiringGroup,
    motorWiringGroup,
    updateMotorWiring: rebuildMotorWiring
  };
}
