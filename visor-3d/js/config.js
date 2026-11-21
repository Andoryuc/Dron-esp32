// Configuracion geometrica, metrologia STL y constantes del prototipo real (1 unidad = 1 mm)

export const STL_BASE_PATH = '../hardware/chasis-stl/';

export const STL_FILES = {
  lowerPlate: '01_placa-inferior.stl',
  upperDeck: '02_piso-superior-abs.stl',
  armA: '03_brazo-motor-a.stl',
  armB: '04_brazo-motor-b.stl',
  column: '05_columna-malla-36mm.stl'
};

// Altura exacta donde apoyan los pisos (mm)
// Placa inferior: Y_placa = [0.60 .. 5.10]
// Brazos arm-a/arm-b: Y = [5.10 .. 23.10]
// Columnas V (H=36 mm): Y_local = [0 .. 36] -> Y_mundo = [23.10 .. 59.10]
// Deck superior V6: Y_local = [0 .. 8.00] -> Y_mundo_base = 59.10
export const FRAME_LEVELS = {
  floorGroundY: -12.0,
  lowerPlateRotY: Math.PI, // Escotilla alineada en +Z bajo baquelita MOSFET
  armTopY: 23.1,
  columnHeight: 36.0,
  upperDeckBaseY: 59.1,
  deckSurfaceLocalY: 3.0,
  mosfetPostsLocalY: 8.0
};

// Anclajes de las 4 columnas V (rotacion Y orienta +X local hacia el centro (0, 0))
export const COLUMN_ANCHORS = [
  { id: 'M4', label: 'Tras. Der. (+X, +Z)', x:  24.2, z:  24.2, rotY:  (3 * Math.PI) / 4 },
  { id: 'M3', label: 'Tras. Izq. (-X, +Z)', x: -24.2, z:  24.2, rotY:  (1 * Math.PI) / 4 },
  { id: 'M1', label: 'Del. Izq. (-X, -Z)',  x: -24.2, z: -24.2, rotY: -(1 * Math.PI) / 4 },
  { id: 'M2', label: 'Del. Der. (+X, -Z)',  x:  24.2, z: -24.2, rotY: -(3 * Math.PI) / 4 }
];

// Orificios externos de brazos con pernos pasantes y patas/topes inferiores
export const OUTER_ARM_BOLTS = [
  { id: 'M4', x:  35.6, z:  35.6 },
  { id: 'M3', x: -35.6, z:  35.6 },
  { id: 'M1', x: -35.6, z: -35.6 },
  { id: 'M2', x:  35.6, z: -35.6 }
];

// 4 motores y sentidos reales de giro vistos desde arriba (+Y):
// CW = rotacion horaria (-1 alrededor de +Y), CCW = antihoraria (+1 alrededor de +Y)
export const MOTORS = [
  { id: 'M1', label: 'Del. Izq.',  x: -78.0, z: -78.0, armAnchorX: -54.0, armAnchorZ: -54.0, dir: 'CW',  rotSign: -1, wireColor: 'white' },
  { id: 'M2', label: 'Del. Der.',  x:  78.0, z: -78.0, armAnchorX:  54.0, armAnchorZ: -54.0, dir: 'CCW', rotSign:  1, wireColor: 'lightGray' },
  { id: 'M3', label: 'Tras. Izq.', x: -78.0, z:  78.0, armAnchorX: -54.0, armAnchorZ:  54.0, dir: 'CCW', rotSign:  1, wireColor: 'brown' },
  { id: 'M4', label: 'Tras. Der.', x:  78.0, z:  78.0, armAnchorX:  54.0, armAnchorZ:  54.0, dir: 'CW',  rotSign: -1, wireColor: 'black' }
];

export const MOTOR_Y = {
  hubCenterY: 11.5,
  propSeatY: 31.5,
  propRadius: 61.0
};

export const EXPLODE_OFFSETS = {
  columnsLift: 26.0,
  deckLift: 58.0,
  batteryExtraLift: 28.0,
  propExtraLift: 16.0
};

export const PROP_MODES = {
  off: 0.0,
  idle: 7.5,
  flight: 42.0
};

// Vistas de camara (900 ms smooth ease)
export const CAMERA_PRESETS = {
  general: {
    label: 'General',
    position: [-285, 228, -305],
    target: [14, 34, 6]
  },
  superior: {
    label: 'Superior',
    position: [0, 520, 26],
    target: [0, 40, 6]
  },
  perfil: {
    label: 'Perfil',
    position: [345, 58, 4],
    target: [0, 34, 4]
  },
  esp32: {
    label: 'ESP32',
    position: [-44, 114, -148],
    target: [0, 65, -55]
  },
  mosfets: {
    label: 'MOSFETs',
    position: [-68, 122, 148],
    target: [0, 74, 58]
  },
  mt3608: {
    label: 'MT3608',
    position: [-150, 108, -46],
    target: [-57, 67, 0]
  },
  mpu6050: {
    label: 'MPU-6050',
    position: [145, 108, -48],
    target: [55, 66, 0]
  }
};

// Configuracion de despiece individual y retroceso suave de camara por componente
export const COMPONENT_INSPECT_CONFIG = {
  mosfets: {
    label: 'MOSFETs',
    liftHeight: 44.0,
    explodedPosition: [-116, 158, 212],
    explodedTarget: [12, 90, 58]
  },
  mt3608: {
    label: 'MT3608',
    liftHeight: 34.0,
    explodedPosition: [-194, 174, -96],
    explodedTarget: [-58, 82, -2]
  },
  mpu6050: {
    label: 'MPU-6050',
    liftHeight: 30.0,
    explodedPosition: [188, 170, -92],
    explodedTarget: [55, 80, -3]
  },
  esp32: {
    label: 'ESP32',
    liftHeight: 36.0,
    explodedPosition: [-54, 148, -214],
    explodedTarget: [-12, 82, -55]
  }
};

// Topologia real compartida de la baquelita de MOSFETs (ala +Z)
export const MOSFET_BOARD_LAYOUT = {
  centerZ: 58.1,
  channelZ: [35.5, 50.0, 64.5, 79.0],
  channelNames: ['M1', 'M2', 'M3', 'M4'],
  channelGpios: ['GPIO 25', 'GPIO 26', 'GPIO 27', 'GPIO 14'],
  channelDirs: ['Del. Izq. CW', 'Del. Der. CCW', 'Tras. Izq. CCW', 'Tras. Der. CW'],
  mosfetX: -11.4,
  drainTapX: -7.6,
  anodeX: -3.9,
  gndRailLeftX: -1.2,
  gndRailRightX: 1.3,
  cathodeX: 4.0,
  redArchInnerX: 7.5,
  bPlusRailX: 14.2
};

// Peine real de 19+19 pines del ESP32-WROOM-32D (i=0 junto a antena +Z, i=18 junto a USB -Z)
export const ESP32_HEADER = {
  centerZ: -55.3,
  pinCount: 19,
  pitch: 2.54,
  startZ: -32.44,
  leftX: 11.8,   // Lado +X (Pin 1..19 mirando desde antena: 3V3..5V)
  rightX: -11.8  // Lado -X (Pin 38..20: GND..GND)
};

export function getEsp32PinZ(index) {
  return ESP32_HEADER.startZ - index * ESP32_HEADER.pitch;
}

// 9 pines conectados exactamente segun ESP32-WROOM-32D.pdf y el prototipo real
export const ESP32_CONNECTED_PINS = [
  {
    id: '3V3',
    label: '3V3 → VCC MPU-6050',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(0),
    side: 'posX',
    colorKey: 'red',
    hex: '#dc2626'
  },
  {
    id: 'GPIO25',
    label: 'GPIO 25 → Gate M1 (Del. Izq CW)',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(8),
    side: 'posX',
    colorKey: 'cyan',
    hex: '#0284c7'
  },
  {
    id: 'GPIO26',
    label: 'GPIO 26 → Gate M2 (Del. Der CCW)',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(9),
    side: 'posX',
    colorKey: 'cyan',
    hex: '#0284c7'
  },
  {
    id: 'GPIO27',
    label: 'GPIO 27 → Gate M3 (Tras. Izq CCW)',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(10),
    side: 'posX',
    colorKey: 'cyan',
    hex: '#0284c7'
  },
  {
    id: 'GPIO14',
    label: 'GPIO 14 → Gate M4 (Tras. Der CW)',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(11),
    side: 'posX',
    colorKey: 'cyan',
    hex: '#0284c7'
  },
  {
    id: 'VIN',
    label: '5V / VIN ← VOUT+ (5.0V) MT3608',
    x: ESP32_HEADER.leftX,
    z: getEsp32PinZ(18),
    side: 'posX',
    colorKey: 'orange',
    hex: '#ea580c'
  },
  {
    id: 'GPIO22',
    label: 'GPIO 22 (SCL) ↔ Reloj I2C MPU-6050',
    x: ESP32_HEADER.rightX,
    z: getEsp32PinZ(2),
    side: 'negX',
    colorKey: 'green',
    hex: '#16a34a'
  },
  {
    id: 'GPIO21',
    label: 'GPIO 21 (SDA) ↔ Datos I2C MPU-6050',
    x: ESP32_HEADER.rightX,
    z: getEsp32PinZ(5),
    side: 'negX',
    colorKey: 'blue',
    hex: '#2563eb'
  },
  {
    id: 'GND',
    label: 'GND ← VOUT− / B− / Source',
    x: ESP32_HEADER.rightX,
    z: getEsp32PinZ(18),
    side: 'negX',
    colorKey: 'slate',
    hex: '#334155'
  }
];
