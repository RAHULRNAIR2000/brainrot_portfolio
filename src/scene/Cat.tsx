import { RoundedBox, useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { suspend } from 'suspend-react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../audio/audioManager'
import { vendorLines } from '../content/projects'
import { say } from '../game/say'
import { setMood, world } from '../game/world'
import { useExisting } from './assets'
import { woodTexture } from './textures'
import { buildDecal, drawCat, makeFaceCanvas } from './faceDecal'
import { aimBone } from './VendorModel'

// Pamuk, the street cat. Tap 5 times for a surprise.
export function Cat() {
  const head = useRef<THREE.Group>(null!)
  const tail = useRef<THREE.Mesh[]>([])
  const earL = useRef<THREE.Mesh>(null!)
  const eyes = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const taps = useRef({ n: 0, last: 0, blinkAt: 3, twitchAt: 5 })
  const mats = useMemo(
    () => ({
      fur: new THREE.MeshPhysicalMaterial({ color: '#d9cfc2', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: '#4a3a33', roughness: 0.9 }),
      eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 0.35), toneMapped: false }),
      nose: new THREE.MeshStandardMaterial({ color: '#d58a8a', roughness: 0.5 }),
      crate: new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#9a6a44', roughness: 0.85 }),
    }),
    [],
  )

  const found = useExisting(['/models/cat.glb', '/models/cat/cat.fbx', '/models/cat/mesh.bin'])
  const hasGlb = !!found?.includes('/models/cat.glb')
  const hasFbx = !!found?.includes('/models/cat/cat.fbx')
  const hasSculpt = !!found?.includes('/models/cat/mesh.bin')
  const hasModel = hasGlb || hasFbx || hasSculpt

  useFrame(({ clock }, dt) => {
    if (!head.current) return
    const t = clock.elapsedTime
    // tail curls lazily
    tail.current.forEach((seg, i) => {
      if (!seg) return
      const k = i / 7
      const sway = Math.sin(t * 1.6 - i * 0.5) * 0.06 * (0.3 + k)
      seg.position.set(-0.13 - k * 0.12 + sway * 0.5, 0.02 + Math.sin(k * Math.PI) * 0.09 + k * 0.05, 0.02 + sway)
    })
    // head follows the action
    const look = new THREE.Vector3().copy(world.dodging ? world.cone : world.lookTarget)
    head.current.parent!.worldToLocal(look)
    const yaw = THREE.MathUtils.clamp(Math.atan2(look.x - head.current.position.x, look.z - head.current.position.z), -0.9, 0.9)
    head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 5, dt)
    body.current.scale.y = 1 + Math.sin(t * 2.1) * 0.015
    const s = taps.current
    if (t > s.blinkAt) s.blinkAt = t + 2 + Math.random() * 4
    eyes.current.scale.y = s.blinkAt - t > 0.12 ? 1 : 0.1
    if (t > s.twitchAt) s.twitchAt = t + 3 + Math.random() * 5
    earL.current.rotation.z = 0.3 + (s.twitchAt - t > 2.8 ? Math.sin(t * 40) * 0.25 : 0)
  })

  const onTap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const s = taps.current
    const now = performance.now()
    s.n = now - s.last < 1500 ? s.n + 1 : 1
    s.last = now
    audio.meow()
    if (s.n >= 5) {
      s.n = 0
      setMood('laugh')
      say(vendorLines.cat)
      audio.bell()
      window.setTimeout(() => setMood('idle'), 2200)
    }
  }

  return (
    <group position={[1.45, 0, 1.0]} rotation-y={-0.5}>
      <RoundedBox args={[0.5, 0.36, 0.42]} radius={0.015} position={[0, 0.18, 0]} material={mats.crate} castShadow receiveShadow />
      <group position={[0, 0.36, 0]} onPointerDown={onTap}>
        {hasModel ? (
          <Suspense fallback={null}>
            {hasGlb ? <CatModel /> : hasFbx ? <CatAnimated /> : <CatSculpt />}
          </Suspense>
        ) : (
        <>
        <group ref={body}>
          <mesh position={[0, 0.1, 0]} scale={[0.85, 1, 1.15]} material={mats.fur} castShadow>
            <sphereGeometry args={[0.11, 20, 16]} />
          </mesh>
          {/* front paws */}
          {[-0.04, 0.04].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.09]} material={mats.fur}>
              <sphereGeometry args={[0.028, 10, 8]} />
            </mesh>
          ))}
        </group>
        <group ref={head} position={[0, 0.25, 0.04]}>
          <mesh scale={[1.1, 0.95, 1]} material={mats.fur} castShadow>
            <sphereGeometry args={[0.075, 20, 16]} />
          </mesh>
          <mesh ref={earL} position={[0.045, 0.06, 0]} rotation-z={0.3} material={mats.fur}>
            <coneGeometry args={[0.025, 0.05, 8]} />
          </mesh>
          <mesh position={[-0.045, 0.06, 0]} rotation-z={-0.3} material={mats.fur}>
            <coneGeometry args={[0.025, 0.05, 8]} />
          </mesh>
          <group ref={eyes} position={[0, 0.012, 0.064]}>
            {[-0.026, 0.026].map((x) => (
              <mesh key={x} position={[x, 0, 0]} scale={[1, 0.8, 0.5]} material={mats.eye}>
                <sphereGeometry args={[0.012, 10, 8]} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, -0.012, 0.074]} material={mats.nose}>
            <sphereGeometry args={[0.007, 8, 6]} />
          </mesh>
          {/* tabby patch */}
          <mesh position={[0, 0.045, 0.02]} scale={[1, 0.4, 1]} material={mats.dark}>
            <sphereGeometry args={[0.05, 12, 8]} />
          </mesh>
        </group>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} ref={(el) => void (tail.current[i] = el!)} material={i > 5 ? mats.dark : mats.fur}>
            <sphereGeometry args={[0.022 - i * 0.0015, 8, 6]} />
          </mesh>
        ))}
        </>
        )}
      </group>
    </group>
  )
}

// Rigged/animated cat from public/models/cat.glb: sits on the crate, loops its idle, head follows the action.
function CatModel() {
  const gltf = useGLTF('/models/cat.glb', false, true)
  const rig = useMemo(() => {
    const mixer = new THREE.AnimationMixer(gltf.scene)
    const clip = gltf.animations.find((a) => /idle|sit|breath|tail/i.test(a.name)) ?? gltf.animations[0]
    if (clip) mixer.clipAction(clip).play()
    let head: THREE.Bone | null = null
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.frustumCulled = false
      }
      if (!head && (o as THREE.Bone).isBone && /head/i.test(o.name) && !/end|top/i.test(o.name)) head = o as THREE.Bone
    })
    return { mixer, head: head as THREE.Bone | null, fwd: new THREE.Vector3(0, 0, 1) }
  }, [gltf])
  useLayoutEffect(() => {
    const s = gltf.scene
    s.scale.setScalar(1)
    s.position.set(0, 0, 0)
    s.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(s, true)
    const k = 0.36 / Math.max(box.max.y - box.min.y, 1e-3)
    s.scale.setScalar(k)
    s.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k)
    s.updateMatrixWorld(true)
    if (rig.head) rig.fwd.set(0, 0, 1).applyQuaternion(rig.head.getWorldQuaternion(new THREE.Quaternion()).invert())
  }, [gltf, rig])
  useFrame(({ clock }, dt) => {
    rig.mixer.update(Math.min(dt, 1 / 20))
    if (!rig.head) return
    const face = rig.head.userData.face as ReturnType<typeof makeFaceCanvas> | undefined
    if (face) {
      const blink = (clock.elapsedTime % 4.3) < 0.13 ? 1 : 0
      if (face.canvas.dataset.blink !== String(blink)) {
        face.canvas.dataset.blink = String(blink)
        drawCat(face.ctx, blink, new THREE.Vector2())
        face.tex.needsUpdate = true
      }
    }
    gltf.scene.updateMatrixWorld(true)
    const p = rig.head.getWorldPosition(new THREE.Vector3())
    const from = rig.fwd.clone().applyQuaternion(rig.head.getWorldQuaternion(new THREE.Quaternion()))
    const to = (world.dodging ? world.cone : world.lookTarget).clone().sub(p).normalize()
    aimBone(rig.head, from, to, 0.5, 0.7)
  })
  return <primitive object={gltf.scene} />
}

// Pamuk from public/models/cat (built by scripts/build-cat.mjs): the statue mesh, smooth-shaded,
// painted as a Turkish Van in the shader, with eyes, breathing and a head that follows the action.
const CAT_HEIGHT = 0.34

async function loadCat() {
  const [bin, info] = await Promise.all([
    fetch('/models/cat/mesh.bin').then((r) => r.arrayBuffer()),
    fetch('/models/cat/cat.json').then((r) => r.json() as Promise<{ neckY: number; nose: [number, number, number] }>),
  ])
  const dv = new DataView(bin, 0, 16)
  const n = dv.getUint32(4, true)
  const count = dv.getUint32(8, true)
  const big = dv.getUint32(12, true) === 4
  const pos = new Float32Array(bin, 16, n * 3).slice()
  const idx = big ? new Uint32Array(bin, 16 + n * 12, count).slice() : new Uint16Array(bin, 16 + n * 12, count).slice()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  g.setAttribute('aBind', new THREE.BufferAttribute(pos.slice(), 3))
  return { geo: g, info }
}

function furMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.82, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fff4e6') })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace(
        '#include <map_fragment>',
        `
        // Turkish Van: cream body, ginger ears and head cap with a cream blaze, ginger tail tip, pink nose
        vec3 cream = vec3(0.93, 0.88, 0.80);
        vec3 ginger = vec3(0.80, 0.42, 0.17);
        vec3 col = cream;
        float cap = smoothstep(0.80, 0.86, vBind.y);
        float blaze = (1.0 - smoothstep(0.02, 0.05, abs(vBind.x))) * step(0.05, vBind.z) * (1.0 - smoothstep(0.9, 0.97, vBind.y));
        col = mix(col, ginger, cap * (1.0 - blaze));
        float tail = smoothstep(0.32, 0.36, length(vBind.xz)) * (1.0 - smoothstep(0.1, 0.16, vBind.y));
        col = mix(col, ginger, tail * (0.6 + 0.4 * step(0.5, fract(atan(vBind.z, vBind.x) * 2.2))));
        float nose = 1.0 - smoothstep(0.0, 0.035, length(vBind - vec3(0.0, NOSE_Y, NOSE_Z)));
        col = mix(col, vec3(0.86, 0.5, 0.5), nose);
        // soft fur variation
        col *= 0.94 + 0.06 * sin(vBind.x * 90.0) * sin(vBind.y * 70.0) * sin(vBind.z * 80.0);
        diffuseColor.rgb *= col;
        `,
      )
  }
  return m
}

function CatSculpt() {
  const { geo, info } = suspend(loadCat, ['cat-sculpt'])
  const built = useMemo(() => {
    const mat = furMaterial()
    const [, ny, nz] = info.nose
    const prev = mat.onBeforeCompile
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r)
      sh.fragmentShader = sh.fragmentShader.replace('NOSE_Y', ny.toFixed(4)).replace('NOSE_Z', nz.toFixed(4))
    }
    // two bones: body and head, head blended in around the neck
    const body = new THREE.Bone()
    const head = new THREE.Bone()
    head.position.set(0, info.neckY, 0.05)
    body.add(head)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const si = new Uint16Array(pos.count * 4)
    const sw = new Float32Array(pos.count * 4)
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.smoothstep(pos.getY(i), info.neckY - 0.06, info.neckY + 0.04)
      si[i * 4] = 0
      si[i * 4 + 1] = 1
      sw[i * 4] = 1 - k
      sw[i * 4 + 1] = k
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    const mesh = new THREE.SkinnedMesh(geo, mat)
    mesh.add(body)
    mesh.bind(new THREE.Skeleton([body, head]))
    mesh.castShadow = true
    mesh.frustumCulled = false
    // eyes: raycast onto the face either side of and above the nose
    const probe = new THREE.Mesh(geo)
    const ray = new THREE.Raycaster()
    const spots: THREE.Vector3[] = []
    for (const sx of [-1, 1]) {
      ray.set(new THREE.Vector3(sx * 0.085, ny + 0.075, 2), new THREE.Vector3(0, 0, -1))
      const hit = ray.intersectObject(probe)[0]
      if (hit) spots.push(hit.point.clone().add(new THREE.Vector3(0, 0, -0.012)))
    }
    // eyes ride on the head bone (added directly so the skeleton hierarchy stays intact)
    const eyes = new THREE.Group()
    const iris = new THREE.MeshPhysicalMaterial({ color: '#e3a224', emissive: '#7a4a00', emissiveIntensity: 0.6, roughness: 0.15, clearcoat: 1 })
    const pupil = new THREE.MeshBasicMaterial({ color: '#120a04' })
    for (const s of spots) {
      const e = new THREE.Group()
      e.position.copy(s).sub(head.position)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), iris)
      ball.scale.set(1, 1, 0.6)
      const slit = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), pupil)
      slit.position.z = 0.02
      slit.scale.set(0.32, 1, 0.4)
      e.add(ball, slit)
      eyes.add(e)
    }
    head.add(eyes)
    return { mesh, body, head, eyes, fwd: new THREE.Vector3(0, 0, 1), blinkAt: 2 }
  }, [geo, info])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    built.body.scale.set(1, 1 + Math.sin(t * 2.1) * 0.012, 1)
    built.head.quaternion.identity()
    built.mesh.updateMatrixWorld(true)
    const p = built.head.getWorldPosition(new THREE.Vector3())
    const from = built.fwd.clone().applyQuaternion(built.head.getWorldQuaternion(new THREE.Quaternion()))
    const to = (world.dodging ? world.cone : world.lookTarget).clone().sub(p).normalize()
    aimBone(built.head, from, to, 0.8, 0.7)
    built.head.rotateZ(Math.sin(t * 0.7) * 0.05)
    if (t > built.blinkAt) built.blinkAt = t + 2 + Math.random() * 4
    built.eyes.scale.y = built.blinkAt - t < 0.12 ? 0.15 : 1
    void dt
  })

  return (
    <group scale={CAT_HEIGHT}>
      <primitive object={built.mesh} />
    </group>
  )
}

// Average face normals across vertices that share a position, so flat facets shade smoothly.
function smoothNormals(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const idx = g.index
  const tri = idx ? idx.count : pos.count
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`
  const acc = new Map<string, THREE.Vector3>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const at = (k: number) => (idx ? idx.getX(k) : k)
  for (let f = 0; f < tri; f += 3) {
    const i0 = at(f), i1 = at(f + 1), i2 = at(f + 2)
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    const n = b.clone().sub(a).cross(c.clone().sub(a)) // area-weighted
    for (const i of [i0, i1, i2]) {
      const k = key(i)
      const v = acc.get(k)
      if (v) v.add(n)
      else acc.set(k, n.clone())
    }
  }
  const out = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i))!.clone().normalize()
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3))
}

const CAT_COLORS: Record<string, string> = { Grey: '#2f2f35', White: '#f2ede4', Pink: '#e8a2a8' }

// The cat's bones are unnamed. Chest = the deepest three-way branch; the head is the end of the
// chain that climbs highest from there (the others are the front legs).
function findHeadBone(root: THREE.Object3D) {
  const bones: THREE.Bone[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => void ((o as THREE.Bone).isBone && !/^ik|_end$/i.test(o.name) && bones.push(o as THREE.Bone)))
  const kids = (b: THREE.Bone) => b.children.filter((c) => (c as THREE.Bone).isBone && !/_end$/i.test(c.name)) as THREE.Bone[]
  const depth = (b: THREE.Object3D) => {
    let d = 0
    for (let o = b.parent; o && (o as THREE.Bone).isBone; o = o.parent) d++
    return d
  }
  // the deepest bone that branches three ways (hips branch too, but sit higher up the hierarchy)
  const chest = bones.filter((b) => kids(b).length >= 3).sort((a, b) => depth(b) - depth(a))[0]
  if (!chest) return null
  let best: THREE.Bone | null = null
  let bestY = -Infinity
  for (const start of kids(chest)) {
    let end = start
    while (kids(end).length) end = kids(end)[0]
    const y = end.getWorldPosition(new THREE.Vector3()).y
    if (y > bestY) (bestY = y), (best = end)
  }
  return best
}

// Quaternius' CC0 animated cat (public/models/cat/cat.fbx): plays its idle loop, smooth-shaded,
// and turns its head toward the action.
function CatAnimated() {
  const fbx = useLoader(FBXLoader, '/models/cat/cat.fbx')
  const rig = useMemo(() => {
    const root = fbx
    let head: THREE.Bone | null = null
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (m.isMesh) {
        m.castShadow = true
        m.frustumCulled = false
        // soften the low-poly facets without touching topology (keeps the per-colour material groups)
        if (!m.userData.smoothed) {
          smoothNormals(m.geometry)
          m.userData.smoothed = true
        }
        // the FBX names its colours but stores them all as white: a tuxedo street cat
        m.material = [m.material].flat().map(
          (mat) =>
            new THREE.MeshPhysicalMaterial({
              name: mat.name,
              color: CAT_COLORS[mat.name] ?? '#f2ede4',
              roughness: 0.75,
              sheen: 0.8,
              sheenRoughness: 0.6,
              sheenColor: new THREE.Color('#ffffff'),
            }),
        )
      }
    })
    head = findHeadBone(root)
    const mixer = new THREE.AnimationMixer(root)
    const clip = fbx.animations.find((a) => /idle/i.test(a.name) && !/eat/i.test(a.name)) ?? fbx.animations[0]
    if (clip) mixer.clipAction(clip).play()
    return { root, mixer, head: head as THREE.Bone | null, fwd: new THREE.Vector3(0, 0, 1), clips: fbx.animations.map((a) => a.name) }
  }, [fbx])

  useLayoutEffect(() => {
    const r = rig.root
    r.scale.setScalar(1)
    r.position.set(0, 0, 0)
    r.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(r, true)
    const k = 0.42 / Math.max(box.max.y - box.min.y, 1e-3)
    r.scale.setScalar(k)
    r.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k)
    r.updateMatrixWorld(true)
    if (!rig.head) return
    // measure the head from the vertices skinned to it, in the mesh's own rest-pose space
    let sk: THREE.SkinnedMesh | null = null
    r.traverse((o) => void ((o as THREE.SkinnedMesh).isSkinnedMesh && (sk = o as THREE.SkinnedMesh)))
    if (!sk) return
    const skin = sk as THREE.SkinnedMesh
    const bi = skin.skeleton.bones.indexOf(rig.head)
    const pos = skin.geometry.attributes.position as THREE.BufferAttribute
    const si = skin.geometry.attributes.skinIndex as THREE.BufferAttribute
    const sw = skin.geometry.attributes.skinWeight as THREE.BufferAttribute
    const headPts: THREE.Vector3[] = []
    const all = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i)
      all.add(v)
      let w = 0
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k)
      if (w > 0.5) headPts.push(v)
    }
    if (headPts.length < 10) return
    all.divideScalar(pos.count)
    // world "up" expressed in mesh space: skinned verts reach the world through the head bone
    const restHead = skin.skeleton.boneInverses[bi].clone().multiply(skin.bindMatrix)
    const toWorld = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(rig.head.matrixWorld.clone().multiply(restHead)))
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(toWorld.clone().invert()).normalize()
    const hc = headPts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(headPts.length)
    const dir = hc.clone().sub(all)
    dir.addScaledVector(up, -dir.dot(up)).normalize()
    const side = new THREE.Vector3().crossVectors(up, dir).normalize()
    const span = (axis: THREE.Vector3) => {
      let lo = Infinity, hi = -Infinity
      for (const p of headPts) {
        const d = p.clone().sub(hc).dot(axis)
        lo = Math.min(lo, d)
        hi = Math.max(hi, d)
      }
      return [lo, hi]
    }
    const [, front] = span(dir)
    const [wl, wh] = span(side)
    const [yl, yh] = span(up)
    // head-look direction in head-bone space
    rig.fwd.copy(dir).transformDirection(restHead)
    // painted cat face projected onto the front of the head, then carried by the head bone
    if (!rig.head.userData.face) {
      const paint = makeFaceCanvas()
      drawCat(paint.ctx, 0, new THREE.Vector2())
      paint.tex.needsUpdate = true
      const probe = new THREE.Mesh(skin.geometry)
      probe.updateMatrixWorld(true)
      const center = hc.clone().addScaledVector(dir, front * 0.55).addScaledVector(up, (yh + yl) * 0.5 + (yh - yl) * 0.05)
      const orient = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, dir))
      const decal = buildDecal(probe, center, orient, new THREE.Vector3((wh - wl) * 0.95, (yh - yl) * 0.9, front * 1.2), paint.tex)
      decal.geometry.applyMatrix4(restHead)
      rig.head.add(decal)
      rig.head.userData.face = paint
    }
    if (import.meta.env.DEV) Object.assign(window, { __cat: rig })
  }, [rig])

  // the cat keeps to its own idle animation (no cursor tracking), and blinks now and then
  useFrame(({ clock }, dt) => {
    rig.mixer.update(Math.min(dt, 1 / 20))
    const face = rig.head?.userData.face as ReturnType<typeof makeFaceCanvas> | undefined
    if (!face) return
    const blink = clock.elapsedTime % 4.3 < 0.13 ? '1' : '0'
    if (face.canvas.dataset.blink !== blink) {
      face.canvas.dataset.blink = blink
      drawCat(face.ctx, blink === '1' ? 1 : 0, new THREE.Vector2())
      face.tex.needsUpdate = true
    }
  })
  return <primitive object={rig.root} />
}
