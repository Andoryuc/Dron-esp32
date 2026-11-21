import * as THREE from 'three';
import { CAMERA_PRESETS } from './config.js';

export function createCameraAnimator(camera, controls) {
  let activeAnim = null;

  const startPos = new THREE.Vector3();
  const startTarget = new THREE.Vector3();
  const endPos = new THREE.Vector3();
  const endTarget = new THREE.Vector3();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function cancel() {
    activeAnim = null;
  }

  // Cancelar transicion automatica si el usuario orbita/hace zoom manualmente
  controls.addEventListener('start', cancel);

  function goToView(positionArr, targetArr, durationMs = 800) {
    if (!positionArr || !targetArr) return false;

    startPos.copy(camera.position);
    startTarget.copy(controls.target);
    endPos.set(positionArr[0], positionArr[1], positionArr[2]);
    endTarget.set(targetArr[0], targetArr[1], targetArr[2]);

    activeAnim = {
      startTime: performance.now(),
      duration: durationMs
    };
    return true;
  }

  function goToPreset(presetKey, durationMs = 900) {
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return false;
    return goToView(preset.position, preset.target, durationMs);
  }

  function nudgeByDelta(posDeltaVec, targetDeltaVec) {
    if (activeAnim) {
      endPos.add(posDeltaVec);
      endTarget.add(targetDeltaVec);
    } else {
      camera.position.add(posDeltaVec);
      controls.target.add(targetDeltaVec);
    }
  }

  function update(nowMs) {
    if (!activeAnim) return;
    const elapsed = nowMs - activeAnim.startTime;
    const rawT = Math.min(1, Math.max(0, elapsed / activeAnim.duration));
    const t = easeInOutCubic(rawT);

    camera.position.lerpVectors(startPos, endPos, t);
    controls.target.lerpVectors(startTarget, endTarget, t);

    if (rawT >= 1) {
      activeAnim = null;
    }
  }

  return {
    goToPreset,
    goToView,
    nudgeByDelta,
    update,
    cancel
  };
}
