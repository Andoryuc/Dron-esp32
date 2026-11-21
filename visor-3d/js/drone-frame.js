import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import {
  STL_BASE_PATH,
  STL_FILES,
  FRAME_LEVELS,
  COLUMN_ANCHORS,
  OUTER_ARM_BOLTS,
  MOTORS,
  MOTOR_Y
} from './config.js';

function loadSTLGeometry(loader, filename) {
  return new Promise((resolve, reject) => {
    loader.load(
      STL_BASE_PATH + filename,
      (geom) => {
        geom.computeVertexNormals();
        resolve(geom);
      },
      undefined,
      (err) => reject(new Error(`No se pudo cargar ${filename}: ${err?.message || err}`))
    );
  });
}

function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh && !child.userData?.noShadow) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

// Tornillo Phillips plateado reutilizable (cabeza bombeada + ranura en cruz)
function createPhillipsScrew(mats, headRadius = 2.6, headHeight = 1.4, shaftLength = 0, shaftRadius = 1.45) {
  const g = new THREE.Group();

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(headRadius * 0.86, headRadius, headHeight, 20),
    mats.steel
  );
  head.position.y = headHeight * 0.5;
  g.add(head);

  const slotA = new THREE.Mesh(
    new THREE.BoxGeometry(headRadius * 1.15, 0.35, 0.45),
    mats.steelDark
  );
  slotA.position.y = headHeight + 0.02;
  g.add(slotA);

  const slotB = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.35, headRadius * 1.15),
    mats.steelDark
  );
  slotB.position.y = headHeight + 0.02;
  g.add(slotB);

  if (shaftLength > 0) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 14),
      mats.steel
    );
    shaft.position.y = -shaftLength * 0.5;
    g.add(shaft);
  }

  return g;
}

// Modulo de motor DC con caja reductora acoplado sobre la lengueta exterior del brazo
function createMotorPod(motor, mats) {
  const pod = new THREE.Group();
  const dirX = Math.sign(motor.x);
  const dirZ = Math.sign(motor.z);
  const angleToCorner = Math.atan2(dirX, dirZ);

  // Carcasa cilindrica principal del motor/reductora en el extremo (motor.x, motor.z)
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(11.6, 12.2, 17.5, 28),
    mats.absHolder
  );
  housing.position.set(motor.x, MOTOR_Y.hubCenterY, motor.z);
  pod.add(housing);

  // Tapa superior redondeada de la reductora
  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(10.6, 11.6, 2.0, 28),
    mats.absMatte
  );
  topCap.position.set(motor.x, MOTOR_Y.hubCenterY + 9.4, motor.z);
  pod.add(topCap);

  // Tapa inferior del compartimento del motor
  const bottomRing = new THREE.Mesh(
    new THREE.CylinderGeometry(11.0, 10.2, 2.2, 24),
    mats.absMatte
  );
  bottomRing.position.set(motor.x, MOTOR_Y.hubCenterY - 9.4, motor.z);
  pod.add(bottomRing);

  // Cuello estructural que abraza la lengueta del brazo desde r=76 hasta el motor
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(16.0, 12.0, 28.0),
    mats.absHolder
  );
  bridge.position.set(motor.x - dirX * 13.0, 11.0, motor.z - dirZ * 13.0);
  bridge.rotation.y = angleToCorner;
  pod.add(bridge);

  // Torreta del motor brushed vertical en la parte interna del pod (fiel a las fotos reales)
  const turretX = motor.x - dirX * 11.5;
  const turretZ = motor.z - dirZ * 11.5;
  const turret = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.6, 16.0, 16),
    mats.absHolder
  );
  turret.position.set(turretX, 16.5, turretZ);
  pod.add(turret);

  const turretCap = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 4.6, 2.5, 16),
    mats.absMatte
  );
  turretCap.position.set(turretX, 25.5, turretZ);
  pod.add(turretCap);

  // Abrazadera/brida plastica negra alrededor del cuello del brazo (como en las fotos)
  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(18.0, 11.5, 2.4),
    mats.blackPlastic
  );
  tie.position.set(motor.x - dirX * 26.5, 13.2, motor.z - dirZ * 26.5);
  tie.rotation.y = angleToCorner;
  pod.add(tie);

  // Eje vertical y collarin blanco-metalico visible bajo el buje de la helice
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 4.5, 16),
    mats.whitePlastic
  );
  collar.position.set(motor.x, 22.8, motor.z);
  pod.add(collar);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.35, 11.5, 14),
    mats.steel
  );
  shaft.position.set(motor.x, 26.2, motor.z);
  pod.add(shaft);

  return pod;
}

// Pala individual con silueta real (ancha en zona media, punta estilizada) y doble franja blanca
function createPropBlade(mats, rotSign) {
  const bladeGroup = new THREE.Group();

  // Forma 2D en plano XZ (eje de pala hacia +X desde r=4 hasta r=61)
  const shape = new THREE.Shape();
  shape.moveTo(4.0, -3.2);
  shape.bezierCurveTo(15.0, -5.0, 31.0, -7.8, 46.0, -6.2);
  shape.bezierCurveTo(55.0, -5.2, 60.5, -2.6, 61.0, 0.0);
  shape.bezierCurveTo(60.5, 2.8, 54.0, 5.0, 44.0, 5.4);
  shape.bezierCurveTo(28.0, 5.8, 15.0, 4.2, 4.0, 3.0);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 1.05,
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.25,
    bevelSegments: 2,
    curveSegments: 20
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -0.52, 0);

  const bladeMesh = new THREE.Mesh(geom, mats.propBlack);
  bladeGroup.add(bladeMesh);

  // Franja blanca principal y segunda franja fina cerca de la punta (visibles arriba y abajo)
  const stripeMain = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.75, 11.8),
    mats.propStripeWhite
  );
  stripeMain.position.set(49.5, 0.0, -0.4);
  stripeMain.rotation.y = 0.18;
  bladeGroup.add(stripeMain);

  const stripeTip = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.75, 10.0),
    mats.propStripeWhite
  );
  stripeTip.position.set(53.4, 0.0, -0.35);
  stripeTip.rotation.y = 0.18;
  bladeGroup.add(stripeTip);

  // Inclinacion aerodinamica coherente con el sentido real CW / CCW
  bladeGroup.rotation.x = rotSign * 0.21;
  return bladeGroup;
}

function createPropellerAssembly(motor, mats) {
  const rotor = new THREE.Group();
  rotor.position.set(motor.x, MOTOR_Y.propSeatY, motor.z);
  rotor.userData = {
    id: motor.id,
    dir: motor.dir,
    rotSign: motor.rotSign,
    baseY: MOTOR_Y.propSeatY
  };

  // Buje cilindrico central (como en las fotos reales donde baja sobre el eje)
  const hubSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.3, 9.2, 18),
    mats.propBlack
  );
  hubSleeve.position.y = -3.4;
  rotor.add(hubSleeve);

  const hubTop = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 2.8, 20),
    mats.propBlack
  );
  hubTop.position.y = 0.2;
  rotor.add(hubTop);

  const centerPin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 3.2, 12),
    mats.steelDark
  );
  centerPin.position.y = 0.3;
  rotor.add(centerPin);

  // Dos palas opuestas a 180 grados
  const blade1 = createPropBlade(mats, motor.rotSign);
  rotor.add(blade1);

  const blade2 = createPropBlade(mats, motor.rotSign);
  blade2.rotation.y = Math.PI;
  rotor.add(blade2);

  // Disco sutil de desenfoque de movimiento (solo visible en modo Vuelo)
  const blurDisc = new THREE.Mesh(
    new THREE.RingGeometry(10, MOTOR_Y.propRadius, 48),
    mats.propMotionBlur.clone()
  );
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = 0.1;
  blurDisc.castShadow = false;
  blurDisc.receiveShadow = false;
  blurDisc.userData.noShadow = true;
  rotor.add(blurDisc);
  rotor.userData.blurDisc = blurDisc;

  // Angulo inicial natural como en las fotografias
  rotor.rotation.y = motor.id === 'M1' || motor.id === 'M4' ? 0.14 : -0.14;

  return rotor;
}

export async function buildDroneFrame(mats) {
  const loader = new STLLoader();

  const [lowerGeom, upperGeom, armAGeom, armBGeom, colGeom] = await Promise.all([
    loadSTLGeometry(loader, STL_FILES.lowerPlate),
    loadSTLGeometry(loader, STL_FILES.upperDeck),
    loadSTLGeometry(loader, STL_FILES.armA),
    loadSTLGeometry(loader, STL_FILES.armB),
    loadSTLGeometry(loader, STL_FILES.column)
  ]);

  const lowerChassisGroup = new THREE.Group();
  lowerChassisGroup.name = 'lowerChassisGroup';

  const columnsGroup = new THREE.Group();
  columnsGroup.name = 'columnsGroup';

  const upperDeckGroup = new THREE.Group();
  upperDeckGroup.name = 'upperDeckGroup';
  upperDeckGroup.position.y = FRAME_LEVELS.upperDeckBaseY;

  const propellersGroup = new THREE.Group();
  propellersGroup.name = 'propellersGroup';

  // 1. Placa inferior ligera con escotilla (rotada 180 deg para quedar bajo +Z MOSFETs)
  const lowerPlateMesh = new THREE.Mesh(lowerGeom, mats.absMatte);
  lowerPlateMesh.rotation.y = FRAME_LEVELS.lowerPlateRotY;
  lowerChassisGroup.add(lowerPlateMesh);

  // 2. Cuatro brazos reales (arm-a diagonal A: M4 y M1; arm-b diagonal B: M3 y M2)
  const armM4 = new THREE.Mesh(armAGeom, mats.absMatte);
  armM4.rotation.y = 0;
  lowerChassisGroup.add(armM4);

  const armM1 = new THREE.Mesh(armAGeom, mats.absMatte);
  armM1.rotation.y = Math.PI;
  lowerChassisGroup.add(armM1);

  const armM3 = new THREE.Mesh(armBGeom, mats.absMatte);
  armM3.rotation.y = 0;
  lowerChassisGroup.add(armM3);

  const armM2 = new THREE.Mesh(armBGeom, mats.absMatte);
  armM2.rotation.y = Math.PI;
  lowerChassisGroup.add(armM2);

  // 3. Tornillos externos de los 4 brazos con tuercas y patas/esparragos inferiores (apoyo Y = -12 mm)
  for (const bolt of OUTER_ARM_BOLTS) {
    const screw = createPhillipsScrew(mats, 2.9, 1.5, 35.1, 1.45);
    screw.position.set(bolt.x, FRAME_LEVELS.armTopY, bolt.z);
    lowerChassisGroup.add(screw);

    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 2.2, 6),
      mats.steel
    );
    nut.position.set(bolt.x, -0.5, bolt.z);
    lowerChassisGroup.add(nut);
  }

  // 4. Cuatro columnas V de 36 mm apoyadas en Y = 23.10 y tornillos Phillips de base
  for (const anchor of COLUMN_ANCHORS) {
    const colMesh = new THREE.Mesh(colGeom, mats.absMatte);
    colMesh.position.set(anchor.x, FRAME_LEVELS.armTopY, anchor.z);
    colMesh.rotation.y = anchor.rotY;
    columnsGroup.add(colMesh);

    const baseScrew = createPhillipsScrew(mats, 2.6, 1.4, 24.0, 1.4);
    baseScrew.position.set(anchor.x, FRAME_LEVELS.armTopY + 4.0, anchor.z);
    columnsGroup.add(baseScrew);
  }

  // 5. Piso superior deck V6 ABS + 4 tornillos Phillips centrales sobre las columnas
  const upperDeckMesh = new THREE.Mesh(upperGeom, mats.absMatte);
  upperDeckGroup.add(upperDeckMesh);

  for (const sx of [-16.5, 16.5]) {
    for (const sz of [-16.5, 16.5]) {
      const topScrew = createPhillipsScrew(mats, 2.9, 1.5, 6.0, 1.5);
      topScrew.position.set(sx, FRAME_LEVELS.deckSurfaceLocalY, sz);
      upperDeckGroup.add(topScrew);
    }
  }

  // 6. Motores (en piso inferior) y Helices (en grupo animado independiente)
  const rotors = [];
  for (const motor of MOTORS) {
    const pod = createMotorPod(motor, mats);
    lowerChassisGroup.add(pod);

    const rotor = createPropellerAssembly(motor, mats);
    propellersGroup.add(rotor);
    rotors.push(rotor);
  }

  enableShadows(lowerChassisGroup);
  enableShadows(columnsGroup);
  enableShadows(upperDeckGroup);
  enableShadows(propellersGroup);

  return {
    lowerChassisGroup,
    columnsGroup,
    upperDeckGroup,
    propellersGroup,
    rotors
  };
}
