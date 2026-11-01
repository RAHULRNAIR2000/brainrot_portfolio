import * as THREE from 'three'
import { Spring1 } from '../game/springs'
import { world, type Mood } from '../game/world'
import { buildDecal, drawMan, makeFaceCanvas, type Expression } from './faceDecal'

// Dresses Quaternius' CC0 mannequin as Mehmet Usta: clothes painted in the shader from rest-pose positions,
// and a face (eyes, brows, nose, mustache, mouth, ears, hair) plus a fez riding on the head bone.

const COLORS = {
  skin: new THREE.Color('#c98d68'),
  shirt: new THREE.Color('#f1ebe0'),
  vest: new THREE.Color('#6a1124'),
  gold: new THREE.Color('#d6a54e'),
  apron: new THREE.Color('#f4efe4'),
  trousers: new THREE.Color('#2b2c33'),
  shoes: new THREE.Color('#4a2c1a'),
}

type Face = Pick<Expression, 'eyes' | 'mouth' | 'brows' | 'browTilt'>
const FACES: Record<Mood, Face> = {
  idle: { eyes: 'open', mouth: 'smile', brows: 0, browTilt: 0 },
  greet: { eyes: 'open', mouth: 'grin', brows: 0.7, browTilt: -0.4 },
  offer: { eyes: 'open', mouth: 'smile', brows: 0.4, browTilt: -0.2 },
  tell: { eyes: 'sly', mouth: 'smirk', brows: 0.2, browTilt: 0.6 },
  dodge: { eyes: 'wide', mouth: 'grin', brows: 0.6, browTilt: 0.3 },
  smug: { eyes: 'sly', mouth: 'smirk', brows: 0.1, browTilt: 0.5 },
  laugh: { eyes: 'happy', mouth: 'laugh', brows: 0.8, browTilt: -0.4 },
  shocked: { eyes: 'wide', mouth: 'o', brows: 1, browTilt: -0.6 },
  handover: { eyes: 'happy', mouth: 'grin', brows: 0.5, browTilt: -0.3 },
  celebrate: { eyes: 'happy', mouth: 'laugh', brows: 0.9, browTilt: -0.4 },
}

type Joints = { hips: THREE.Vector3; chest: THREE.Vector3; neck: THREE.Vector3; head: THREE.Vector3; shoulder: number; elbow: number; wrist: number }

function boneBindPos(skin: THREE.SkinnedMesh, bone: THREE.Bone | null) {
  const i = bone ? skin.skeleton.bones.indexOf(bone) : -1
  if (i < 0) return null
  // rest position of the bone in the mesh's own space
  return new THREE.Vector3().setFromMatrixPosition(skin.bindMatrixInverse.clone().multiply(skin.skeleton.boneInverses[i].clone().invert()))
}

function outfitMaterial(j: Joints, zc: number) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.72, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff2e6') })
  m.onBeforeCompile = (sh) => {
    const u: Record<string, { value: unknown }> = {
      uHipsY: { value: j.hips.y },
      uChestY: { value: j.chest.y },
      uNeckY: { value: j.neck.y },
      uShoulderX: { value: j.shoulder },
      uElbowX: { value: j.elbow },
      uZc: { value: zc },
    }
    for (const [k, c] of Object.entries(COLORS)) u['c_' + k] = { value: c }
    Object.assign(sh.uniforms, u)
    const decl = Object.keys(u)
      .map((k) => `uniform ${k.startsWith('c_') ? 'vec3' : 'float'} ${k};`)
      .join('\n')
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBind;\n${decl}`)
      .replace(
        '#include <map_fragment>',
        `
        vec3 p = vBind;
        // legs stand in the idle pose and would poke out under the cart: they're never meant to be seen
        if (p.y < 0.55) discard;
        float ax = abs(p.x);
        float waist = uHipsY + 0.07;
        vec3 col;
        bool arm = ax > uShoulderX + 0.03 && p.y > waist + 0.12;
        if (!arm && (p.y > uNeckY + 0.04 || (p.y > uNeckY - 0.015 && ax < 0.085))) {
          col = c_skin;
          if (p.y < uNeckY + 0.025 && ax > 0.03) col = c_shirt; // collar
        } else if (arm) {
          col = ax < uElbowX - 0.005 ? c_shirt : c_skin;
          if (abs(ax - uElbowX + 0.02) < 0.022) col = c_shirt * 0.93; // rolled cuff
        } else if (p.y > waist - 0.03) {
          // shirt with an embroidered waistcoat over it, open in a V at the front
          bool front = p.z > uZc;
          float t = smoothstep(waist, uNeckY - 0.02, p.y);
          float open = mix(0.012, 0.06, t);
          col = c_vest;
          if (front && ax < open) col = c_shirt;
          float edge = abs(ax - open);
          if (front && edge < 0.011) col = c_gold;
          if (front && abs(ax - open - 0.035) < 0.004) col = c_gold; // second fine trim line
          if (abs(p.y - (waist - 0.03)) < 0.01) col = c_gold;
          if (ax > uShoulderX - 0.035 && p.y > uChestY) col = c_shirt; // sleeves start at the shoulder
          if (front && ax < open && mod(p.y * 40.0, 1.0) < 0.12 && ax < 0.008) col = c_shirt * 0.8; // shirt buttons
        } else if (p.y < 0.08) {
          col = c_shoes;
        } else {
          bool front = p.z > uZc - 0.03;
          col = (front && p.y > 0.5) ? c_apron : c_trousers;
          if (abs(p.y - (waist - 0.045)) < 0.012) col = c_apron; // apron tie
        }
        diffuseColor.rgb *= col;
        `,
      )
  }
  return m
}

// three-segment curled mustache half, in head-local units
function mustacheGeo(side: number, s: number) {
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.35 * s, -0.12 * s, -0.02 * s),
    new THREE.Vector3(side * 0.7 * s, -0.1 * s, -0.12 * s),
    new THREE.Vector3(side * 0.88 * s, 0.1 * s, -0.2 * s),
    new THREE.Vector3(side * 0.78 * s, 0.24 * s, -0.22 * s),
    new THREE.Vector3(side * 0.66 * s, 0.18 * s, -0.2 * s),
  ])
  const g = new THREE.TubeGeometry(c, 40, 1, 10, false)
  const p = g.attributes.position as THREE.BufferAttribute
  const ctr = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / 11) / 40
    c.getPointAt(Math.min(1, t), ctr)
    const r = THREE.MathUtils.lerp(0.13 * s, 0.025 * s, Math.pow(t, 0.75))
    v.fromBufferAttribute(p, i).sub(ctr).normalize().multiplyScalar(r).add(ctr)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export type Outfit = { update: (dt: number) => void }

export function dressMannequin(scene: THREE.Object3D, find: (names: string[]) => THREE.Bone | null): Outfit | null {
  let skin: THREE.SkinnedMesh | null = null
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!skin && m.isSkinnedMesh && [m.material].flat().some((mm) => /M_Main|M_Joints/.test(mm.name))) skin = m
  })
  if (!skin) return null
  const sk = skin as THREE.SkinnedMesh
  const headBone = find(['head'])
  const P = (names: string[]) => boneBindPos(sk, find(names))
  const hips = P(['hips', 'pelvis'])
  const chest = P(['spine003', 'spine03', 'chest'])
  const neck = P(['neck', 'neck01'])
  const head = P(['head'])
  const sh = P(['upperarml', 'upperarm_l'])
  const el = P(['forearml', 'lowerarml'])
  const wr = P(['handl'])
  if (!hips || !chest || !neck || !head || !sh || !el || !wr || !headBone) return null
  const j: Joints = { hips, chest, neck, head, shoulder: Math.abs(sh.x), elbow: Math.abs(el.x), wrist: Math.abs(wr.x) }
  if (import.meta.env.DEV) Object.assign(window, { __outfit: { j, bones: sk.skeleton.bones.map((b) => b.name) } })

  // --- clothes: one shader for both primitives, painted from rest-pose positions
  const geo = sk.geometry
  geo.setAttribute('aBind', (geo.attributes.position as THREE.BufferAttribute).clone())
  const mat = outfitMaterial(j, chest.z)
  sk.material = mat
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (m.isSkinnedMesh && m !== sk && m.geometry.attributes.position) {
      m.geometry.setAttribute('aBind', (m.geometry.attributes.position as THREE.BufferAttribute).clone())
      m.material = mat
    }
  })

  // --- measure the head from vertices skinned to it
  const hi = sk.skeleton.bones.indexOf(headBone)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const si = geo.attributes.skinIndex as THREE.BufferAttribute
  const sw = geo.attributes.skinWeight as THREE.BufferAttribute
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    let w = 0
    for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k)
    if (w > 0.6) box.expandByPoint(v.fromBufferAttribute(pos, i))
  }
  const c = box.getCenter(new THREE.Vector3())
  const s = box.getSize(new THREE.Vector3())
  const R = s.x / 2

  const probe = new THREE.Mesh(geo)
  const ray = new THREE.Raycaster()
  const surface = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, c.z + 1), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(probe)[0]
    return hit ? hit.point.clone() : new THREE.Vector3(x, y, c.z + s.z / 2)
  }

  // --- face + fez, built in mesh space, then parented to the head bone
  const face = new THREE.Group()
  const skinMat = new THREE.MeshPhysicalMaterial({ color: COLORS.skin, roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color('#ff9f84') })
  const hairMat = new THREE.MeshStandardMaterial({ color: '#25201d', roughness: 0.55 })
  const greyMat = new THREE.MeshStandardMaterial({ color: '#4b4744', roughness: 0.8 })
  const fezMat = new THREE.MeshPhysicalMaterial({ color: '#8a0f1b', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ff6a6a'), sheenRoughness: 0.5 })

  const eyeY = c.y + s.y * 0.06

  // painted face: eyes, brows, cheeks and mouth on a canvas, projected onto the front of the head
  const fbox = { cy: c.y - s.y * 0.1, w: s.x * 1.05, h: s.y * 0.95 }
  const toV = (y: number) => 1 - (y - (fbox.cy - fbox.h / 2)) / fbox.h
  const layout = {
    eyeY: toV(eyeY),
    eyeX: (R * 0.38) / fbox.w,
    eyeR: (R * 0.24) / fbox.w,
    mouthY: toV(eyeY - R * 0.8),
    cheekY: toV(eyeY - R * 0.32),
  }
  const paint = makeFaceCanvas()
  probe.updateMatrixWorld(true)
  const decal = buildDecal(probe, new THREE.Vector3(c.x, fbox.cy, c.z + s.z * 0.3), 0, new THREE.Vector3(fbox.w, fbox.h, s.z * 0.8), paint.tex)
  face.add(decal)

  const noseAt = surface(0, eyeY - R * 0.3)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 20, 14), skinMat)
  nose.position.copy(noseAt).add(new THREE.Vector3(0, 0, R * 0.08))
  nose.scale.set(0.85, 1, 1.05)
  face.add(nose)

  const stache = new THREE.Group()
  stache.position.copy(surface(0, eyeY - R * 0.55)).add(new THREE.Vector3(0, 0, R * 0.12))
  for (const sx of [-1, 1]) stache.add(new THREE.Mesh(mustacheGeo(sx, R), hairMat))
  face.add(stache)

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 14, 10), skinMat)
    ear.position.set(c.x + sx * R * 0.98, eyeY - R * 0.15, c.z - R * 0.05)
    ear.scale.set(0.45, 1, 0.75)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(R * 0.32, 14, 10), greyMat)
    hair.position.set(c.x + sx * R * 0.86, eyeY + R * 0.18, c.z - R * 0.25)
    hair.scale.set(0.5, 0.75, 1)
    face.add(ear, hair)
  }

  // fez sits snugly on the crown, tilted a touch back
  const fez = new THREE.Group()
  fez.position.set(c.x, c.y + s.y * 0.36, c.z - R * 0.05)
  fez.rotation.x = -0.12
  const fezBody = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.98, s.y * 0.5, 32), fezMat)
  fezBody.position.y = s.y * 0.2
  const fezTop = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.78, s.y * 0.01, 32), fezMat)
  fezTop.position.y = s.y * 0.45
  const tassel = new THREE.Group()
  tassel.position.y = s.y * 0.455
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.025, R * 0.025, R * 0.6, 6), hairMat)
  cord.rotation.x = Math.PI / 2
  cord.position.z = -R * 0.3
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.75, 12), hairMat)
  tuft.position.set(0, -R * 0.35, -R * 0.62)
  tassel.add(cord, tuft)
  fez.add(fezBody, fezTop, tassel)
  face.add(fez)

  face.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m !== decal) m.castShadow = true
  })

  // move the whole face rig into head-bone space so it follows every animation
  face.updateMatrix()
  const toBone = sk.skeleton.boneInverses[hi].clone().multiply(sk.bindMatrix).multiply(face.matrix)
  toBone.decompose(face.position, face.quaternion, face.scale)
  headBone.add(face)

  const st = {
    blinkAt: 2,
    blink: 0,
    drawn: '',
    look: new THREE.Vector2(),
    talk: 0,
    tX: new Spring1(0, 50, 0.22),
    tZ: new Spring1(0, 50, 0.22),
    prevQ: new THREE.Quaternion(),
    q: new THREE.Quaternion(),
  }

  return {
    update(dt: number) {
      const t = world.time
      if (t > st.blinkAt) (st.blink = 1), (st.blinkAt = t + 2 + Math.random() * 3.5)
      st.blink = Math.max(0, st.blink - dt * 9)
      // expression for the mood; talking opens and closes the mouth
      const f = FACES[world.mood]
      const talking = world.talkUntil > t
      st.talk = talking ? Math.abs(Math.sin(t * 15) * Math.sin(t * 5.7)) : 0
      const mouth = talking && (f.mouth === 'smile' || f.mouth === 'smirk') ? 'talk' : f.mouth
      // pupils glance toward whatever he's looking at
      const target = face.worldToLocal(world.lookTarget.clone()).sub(c)
      const len = target.length() || 1
      st.look.set(
        THREE.MathUtils.damp(st.look.x, THREE.MathUtils.clamp((target.x / len) * 3, -1, 1), 8, dt),
        THREE.MathUtils.damp(st.look.y, THREE.MathUtils.clamp((target.y / len) * 3, -1, 1), 8, dt),
      )
      const blink = st.blink > 0.5 ? 1 : 0
      const key = `${world.mood}|${mouth}|${blink}|${Math.round(st.talk * 4)}|${Math.round(st.look.x * 6)}|${Math.round(st.look.y * 6)}`
      if (key !== st.drawn) {
        st.drawn = key
        drawMan(paint.ctx, { ...f, mouth, look: st.look, talkOpen: st.talk }, layout, blink)
        paint.tex.needsUpdate = true
      }
      stache.position.y = (stache.userData.y ??= stache.position.y) + (mouth === 'laugh' || mouth === 'grin' ? R * 0.04 : st.talk * R * 0.03)
      // tassel swings with head motion
      headBone.getWorldQuaternion(st.q)
      const dq = st.prevQ.clone().invert().multiply(st.q)
      const e = new THREE.Euler().setFromQuaternion(dq)
      st.prevQ.copy(st.q)
      st.tX.step(THREE.MathUtils.clamp(-e.x * 12, -0.8, 0.8), dt)
      st.tZ.step(THREE.MathUtils.clamp(-e.y * 12, -0.8, 0.8), dt)
      tassel.rotation.set(st.tX.x, 0, st.tZ.x)
    },
  }
}
