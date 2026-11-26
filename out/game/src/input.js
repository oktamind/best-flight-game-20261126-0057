// Keyboard + mouse, in one place. The mouse steers only while the pointer is
// held down on the canvas, so menus stay clickable and the camera never fights.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESET = 4;
export const ACTION_CAMERA = 8;
export const ACTION_FLAPS = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0; let mouseY = 0;
  let missionKey = null;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESET;
    if (event.code === 'KeyC') actions |= ACTION_CAMERA;
    if (event.code === 'KeyF') actions |= ACTION_FLAPS;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1') missionKey = 'rally';
    if (event.code === 'Digit2') missionKey = 'tour';
    if (event.code === 'Digit3') missionKey = 'landing';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  }
  function keyUp(event) { keys.delete(event.code); }
  function pointerDown(event) {
    mouseDown = true; mouseX = event.clientX; mouseY = event.clientY;
  }
  function pointerMove(event) {
    if (!mouseDown) return;
    mouseX = event.clientX; mouseY = event.clientY;
  }
  function pointerUp() { mouseDown = false; }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);

  function takeActions() {
    const taken = actions; actions = 0;
    const mission = missionKey; missionKey = null;
    return { actions: taken, mission };
  }

  // Steering: arrows/A-D first, then the held mouse (offset from screen centre).
  function steering() {
    let pitch = 0; let roll = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 0; // W is throttle, not pitch
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (mouseDown) {
      const nx = (mouseX / window.innerWidth - 0.5) * 2;
      const ny = (mouseY / window.innerHeight - 0.5) * 2;
      roll += nx * 1.2;
      pitch += -ny * 1.0;
    }
    let throttleTarget = 0.65;
    if (keys.has('KeyW')) throttleTarget = 1;
    else if (keys.has('KeyS')) throttleTarget = 0.25;
    return { pitch: Math.max(-1, Math.min(1, pitch)), roll: Math.max(-1, Math.min(1, roll)), throttleTarget };
  }

  return { takeActions, steering };
}
