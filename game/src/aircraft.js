// The Kitefin-9: a little coral-red prop plane built from primitives, so it reads
// as an aircraft from every angle and never needs a downloaded model.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'kitefin-9';
  const red = new THREE.MeshLambertMaterial({ color: PALETTE.planeRed });
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.planeCream });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.planeDark });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd8ff, shininess: 120, specular: 0xffffff });

  // Fuselage: a tapered cylinder along -Z (the nose points -Z in local space).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.9, 7.2, 12), red);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 12), cream);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -4.6;
  plane.add(nose);
  // Canopy: the lit glasshouse the screenshots need.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), glass);
  canopy.scale.set(0.9, 0.75, 1.7);
  canopy.position.set(0, 1.15, -0.9);
  plane.add(canopy);
  // Main wing and tailplane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 2.6), cream);
  wing.position.set(0, -0.1, 0.4);
  plane.add(wing);
  // Red wingtip caps and a fin stripe: the paint scheme, so the wing reads
  // as an authored surface from the chase view instead of one flat slab.
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 2.6), red);
    cap.position.set(side * 6.0, -0.1, 0.4);
    plane.add(cap);
  }
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 1.5), cream);
  tailWing.position.set(0, 0.35, 3.4);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.4, 1.8), red);
  fin.position.set(0, 1.2, 3.4);
  plane.add(fin);
  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 1.8), cream);
  finStripe.position.set(0, 1.7, 3.4);
  plane.add(finStripe);
  // Wingtip nav lights: red port, green starboard, white tail.
  const tipGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const port = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  port.position.set(-6.8, -0.1, 0.4); plane.add(port);
  const starboard = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
  starboard.position.set(6.8, -0.1, 0.4); plane.add(starboard);
  const tailLight = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 0.4, 4.3); plane.add(tailLight);
  // Fixed gear, so landings read as landings.
  const gearMat = dark;
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), gearMat);
    leg.position.set(side * 1.4, -1.6, -0.6);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.4, -2.4, -0.6);
    plane.add(wheel);
  }
  // Propeller: two blades on a spinner, spun by the renderer.
  const prop = new THREE.Group();
  prop.name = 'propeller';
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 10), dark);
  spinner.rotation.x = -Math.PI / 2; spinner.position.z = -5.8;
  prop.add(spinner);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.6, 0.16), bladeMat);
    blade.position.z = -5.7;
    blade.rotation.z = angle;
    prop.add(blade);
  }
  prop.position.z = 0;
  plane.add(prop);
  plane.userData.propeller = prop;
  return plane;
}
