'use client';

/* Three.js objects (particles, geometry buffers, camera) are updated imperatively inside
   useFrame by design; the React Compiler immutability rule doesn't apply to them. */
/* eslint-disable react-hooks/immutability */

import { ContactShadows, Environment, Lightformer, OrbitControls, Sparkles, Stars, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import { STRUCTURE_BY_ID, type StructureId } from '@/twin/anatomy';

/**
 * Premium 3D hazard expeditions. One studio stage (procedural environment reflections,
 * no HDRI download), five scenes. The human body is the same BodyParts3D anatomy used by
 * the digital twin, so the story's "body" is consistent everywhere. Numbers that drive the
 * scenes are physics (light time) or clearly illustrative (labelled in the UI).
 */

/* ------------------------------------------------------------------ shared stage */

/**
 * Drag to rotate freely (360° around, most of the way over/under), pinch/scroll to zoom.
 * Optional idle spin pauses the moment you touch it and resumes after a few quiet seconds.
 */
function Orbit({ target, still, spin }: { target: [number, number, number]; still: boolean; spin: boolean }) {
  const ref = useRef<OrbitControlsImpl | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [auto, setAuto] = useState(spin && !still);
  useEffect(() => () => { if (idle.current) clearTimeout(idle.current); }, []);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={target}
      enablePan={false}
      enableZoom
      zoomSpeed={0.7}
      rotateSpeed={0.8}
      minDistance={1.6}
      maxDistance={9}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI - 0.15}
      enableDamping
      dampingFactor={0.08}
      autoRotate={auto}
      autoRotateSpeed={0.5}
      onStart={() => {
        if (idle.current) clearTimeout(idle.current);
        setAuto(false);
      }}
      onEnd={() => {
        if (!spin || still) return;
        idle.current = setTimeout(() => setAuto(true), 4000);
      }}
    />
  );
}

function Studio({ children, camera = [0, 1.1, 4.2], target = [0, 0.85, 0], still, controls = true }: { children: ReactNode; camera?: [number, number, number]; target?: [number, number, number]; still: boolean; controls?: boolean }) {
  return (
    <Canvas camera={{ position: camera, fov: 38 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.localClippingEnabled = true; }} frameloop={still ? 'demand' : 'always'}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={2} color="#FFF4EA" />
      <directionalLight position={[-4, 2, -3]} intensity={1.4} color="#62D2E6" />
      <pointLight position={[0, -1, 3]} intensity={4} color="#A99BFF" />
      {/* Procedural studio reflections (no network): soft boxes around the scene. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[6, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} color="#62D2E6" />
        <Lightformer form="rect" intensity={2} position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} color="#A99BFF" />
        <Lightformer form="ring" intensity={1.5} position={[0, 1, -5]} scale={3} color="#ffffff" />
      </Environment>
      <Stars radius={40} depth={20} count={1400} factor={2.6} fade speed={still ? 0 : 0.6} />
      <Suspense fallback={null}>{children}</Suspense>
      <Orbit target={target} still={still} spin={controls} />
    </Canvas>
  );
}

/** Soft glowing disc sprite texture, generated once. */
function useGlow() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
}

/* ------------------------------------------------------------------ the body */

const SHOWN: StructureId[] = ['skin', 'skeleton', 'heart', 'arteries', 'veins', 'lungs', 'brain', 'liver', 'stomach', 'intestines', 'kidneys'];

/**
 * The human body (BodyParts3D). `look="human"` shows the real skin surface with a realistic skin
 * material; `look="xray"` shows glass skin over skeleton and organs. `boneLoad` tints bone (x-ray).
 */
function Body({ boneLoad = 1, glow = '#8FE3F5', look = 'human' }: { boneLoad?: number; glow?: string; look?: 'human' | 'xray' }) {
  const { scene } = useGLTF('/models/anatomy.glb');
  const parts = useMemo(() => {
    const root = scene.clone(true);
    const mats: Partial<Record<StructureId, THREE.MeshPhysicalMaterial>> = {};
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const id = (m.name in STRUCTURE_BY_ID ? m.name : m.parent?.name) as StructureId;
      if (!SHOWN.includes(id) || (look === 'human' && id !== 'skin')) {
        m.visible = false;
        return;
      }
      const s = STRUCTURE_BY_ID[id];
      const mat =
        look === 'human'
          ? // realistic skin: warm albedo, soft sheen (fake subsurface), slight clearcoat for natural highlights
            new THREE.MeshPhysicalMaterial({ color: '#C89580', roughness: 0.52, metalness: 0, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color('#FFD2BF'), clearcoat: 0.08, clearcoatRoughness: 0.6, emissive: '#3B1A10', emissiveIntensity: 0.06 })
          : id === 'skin'
          ? new THREE.MeshPhysicalMaterial({ color: '#9CCFE0', transparent: true, opacity: 0.1, roughness: 0.15, metalness: 0, transmission: 0, clearcoat: 1, depthWrite: false, emissive: glow, emissiveIntensity: 0.05 })
          : new THREE.MeshPhysicalMaterial({ color: s.color, roughness: s.roughness, clearcoat: 0.4, clearcoatRoughness: 0.4 });
      m.material = mat;
      m.renderOrder = look === 'xray' && id === 'skin' ? 10 : 0;
      mats[id] = mat;
    });
    return { root, mats };
  }, [scene, glow, look]);
  // Bone loading: ivory when loaded, paler and slightly glassy when unloaded (illustrative).
  useEffect(() => {
    const bone = parts.mats.skeleton;
    if (!bone) return;
    bone.color.set('#E9E0CC').lerp(new THREE.Color('#9FB4C8'), 1 - boneLoad);
    bone.transparent = boneLoad < 0.98;
    bone.opacity = 0.55 + 0.45 * boneLoad;
    bone.needsUpdate = true;
  }, [parts, boneLoad]);
  return (
    <group>
      <primitive object={parts.root} />
      {look === 'human' && <SpaceSuit skin={parts.root} />}
    </group>
  );
}

/** Body-space skin geometry as plain floats (the compressed model stores quantised int16). */
function skinGeometry(skin: THREE.Object3D): THREE.BufferGeometry | null {
  let geo: THREE.BufferGeometry | null = null;
  skin.updateWorldMatrix(true, true);
  skin.traverse((o) => {
    const m = o as THREE.Mesh;
    const id = m.name in STRUCTURE_BY_ID ? m.name : m.parent?.name;
    if (!m.isMesh || id !== 'skin' || geo) return;
    const rel = new THREE.Matrix4().copy(skin.matrixWorld).invert().multiply(m.matrixWorld);
    const pos = m.geometry.attributes.position;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) out.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (m.geometry.index) f.setIndex(Array.from(m.geometry.index.array as ArrayLike<number>));
    f.applyMatrix4(rel);
    f.computeVertexNormals();
    geo = f;
  });
  return geo;
}

/** Puff the body surface outwards along its normals to make a pressure garment. */
function inflate(geo: THREE.BufferGeometry, by: number) {
  const g = geo.clone();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * by, p.getY(i) + n.getY(i) * by, p.getZ(i) + n.getZ(i) * by);
  g.computeVertexNormals();
  return g;
}

/** Centroid + radius of the skin within a horizontal slice (optionally only one side). */
function slice(geo: THREE.BufferGeometry, y: number, keep: (x: number, z: number) => boolean, h = 0.018) {
  const p = geo.attributes.position;
  let cx = 0, cz = 0, n = 0;
  const pts: [number, number][] = [];
  for (let i = 0; i < p.count; i++) {
    const py = p.getY(i);
    if (Math.abs(py - y) > h) continue;
    const x = p.getX(i), z = p.getZ(i);
    if (!keep(x, z)) continue;
    cx += x; cz += z; n++; pts.push([x, z]);
  }
  if (!n) return null;
  cx /= n; cz /= n;
  const r = pts.reduce((a, [x, z]) => Math.max(a, Math.hypot(x - cx, z - cz)), 0);
  return { c: new THREE.Vector3(cx, y, cz), r };
}

/** Plane set (body space) → clipping planes that follow the body every frame. */
function useClip(group: React.RefObject<THREE.Group | null>, sets: [THREE.Vector3, number][][]) {
  const planes = useMemo(() => sets.map((set) => ({ local: set.map(([n, c]) => new THREE.Plane(n.clone(), c)), world: set.map(([n, c]) => new THREE.Plane(n.clone(), c)) })), [sets]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    for (const s of planes) s.local.forEach((p, i) => s.world[i].copy(p).applyMatrix4(g.matrixWorld));
  });
  return planes.map((p) => p.world);
}

const Y = new THREE.Vector3(0, 1, 0);
const NY = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);
const NX = new THREE.Vector3(-1, 0, 0);
const NECK = 1.47;
const SUIT_CLIPS: [THREE.Vector3, number][][] = [
  [[NY, NECK]], // suit: everything below the neck ring
  [[NY, 0.865], [X, -0.19]], // right glove (x > 0.19, below the wrist)
  [[NY, 0.865], [NX, -0.19]], // left glove
  [[NY, 0.15]], // boots
  [[NY, 0.74], [Y, -0.28], [X, -0.115], [NX, 0.215]], // commander stripe, right leg (outer side)
  [[Y, -(NECK - 0.04)]], // the body itself only shows above the neck ring (face inside the helmet)
];

/** Smooth the pelvis front so the pressure garment has the flat front of a real suit. */
function suitShape(base: THREE.BufferGeometry) {
  const g = base.clone();
  // reference: the front of the lower abdomen (above the area being smoothed)
  const abdomen = slice(base, 1.06, (x) => Math.abs(x) < 0.1, 0.02);
  const cap = abdomen ? abdomen.c.z + abdomen.r * 0.3 : 0.05;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i);
    if (y > 0.7 && y < 1.04 && Math.abs(x) < 0.115 && p.getZ(i) > cap) {
      // blend toward the cap so the transition into the thighs stays smooth
      const edge = Math.min(1, (0.115 - Math.abs(x)) / 0.03);
      p.setZ(i, p.getZ(i) + (cap - p.getZ(i)) * edge);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Full EVA spacesuit fitted to the body: suit, gloves, boots, helmet, life-support pack, joint bearings. */
function SpaceSuit({ skin }: { skin: THREE.Object3D }) {
  const group = useRef<THREE.Group>(null);
  const clips = useClip(group, SUIT_CLIPS);
  const kit = useMemo(() => {
    const base = skinGeometry(skin);
    if (!base) return null;
    const suit = inflate(suitShape(base), 0.032);
    const glove = inflate(base, 0.038);
    const boot = inflate(base, 0.045);
    const stripe = inflate(base, 0.036);
    // measure the body
    const head = slice(base, 1.56, () => true, 0.06);
    const torso = slice(base, 1.22, (x) => Math.abs(x) < 0.16, 0.03);
    const side = (sx: number, y: number, minX: number, maxX = 9) => slice(base, y, (x) => sx * x > minX && sx * x < maxX);
    const joints: { c: THREE.Vector3; r: number }[] = [];
    for (const sx of [1, -1]) {
      for (const [y, minX] of [[1.33, 0.15], [1.08, 0.16], [0.88, 0.17]] as const) { const j = side(sx, y, minX); if (j) joints.push(j); }
      for (const y of [0.5, 0.17]) { const j = side(sx, y, 0.0, 0.2); if (j) joints.push(j); }
    }
    return { suit, glove, boot, stripe, head, torso, joints };
  }, [skin]);
  // Hide the body under the suit (only the head shows inside the helmet).
  useEffect(() => {
    skin.traverse((o) => {
      const m = o as THREE.Mesh;
      const id = m.name in STRUCTURE_BY_ID ? m.name : m.parent?.name;
      if (m.isMesh && id === 'skin') {
        const mat = m.material as THREE.Material;
        mat.clippingPlanes = clips[5];
        mat.needsUpdate = true;
      }
    });
  }, [skin, clips]);
  if (!kit) return null;
  const fabric = (color: string, clip: THREE.Plane[], rough = 0.88) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#FFFFFF'), clippingPlanes: clip, side: THREE.DoubleSide });
  const metal = <meshStandardMaterial color="#B8C1CC" metalness={0.9} roughness={0.25} />;
  const head = kit.head?.c ?? new THREE.Vector3(0, 1.56, 0.01);
  const hr = Math.max(0.17, (kit.head?.r ?? 0.1) * 1.75);
  const back = kit.torso ? kit.torso.c.z - kit.torso.r * 0.55 : -0.12;
  const front = kit.torso ? kit.torso.c.z + kit.torso.r * 0.5 : 0.1;
  return (
    <group ref={group}>
      <mesh geometry={kit.suit} material={fabric('#F3F3EF', clips[0])} />
      <mesh geometry={kit.glove} material={fabric('#D7DADF', clips[1], 0.7)} />
      <mesh geometry={kit.glove} material={fabric('#D7DADF', clips[2], 0.7)} />
      <mesh geometry={kit.boot} material={fabric('#BFC4CB', clips[3], 0.75)} />
      <mesh geometry={kit.stripe} material={fabric('#C8262E', clips[4], 0.8)} />
      {/* joint bearings (shoulders, elbows, wrists, knees, ankles) */}
      {kit.joints.map((j, i) => (
        <mesh key={i} position={j.c} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[j.r * 0.82 + 0.03, 0.009, 10, 40]} />{metal}</mesh>
      ))}
      {/* neck ring + helmet bubble + raised gold visor */}
      <mesh position={[head.x, NECK, head.z]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.105, 0.02, 12, 48]} />{metal}</mesh>
      <mesh position={[head.x, head.y + 0.005, head.z + 0.01]}>
        <sphereGeometry args={[hr, 48, 48]} />
        <meshPhysicalMaterial color="#DDEFFF" transparent opacity={0.16} roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.02} depthWrite={false} />
      </mesh>
      <mesh position={[head.x, head.y + 0.005, head.z + 0.01]} rotation={[-0.55, 0, 0]}>
        <sphereGeometry args={[hr * 1.03, 48, 24, Math.PI * 0.2, Math.PI * 0.6, 0, Math.PI * 0.32]} />
        <meshPhysicalMaterial color="#D4A437" metalness={1} roughness={0.12} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* portable life-support system (backpack) */}
      <group position={[0, 1.2, back - 0.1]}>
        <mesh><boxGeometry args={[0.38, 0.5, 0.17]} /><meshPhysicalMaterial color="#ECEDEA" roughness={0.6} clearcoat={0.3} /></mesh>
        <mesh position={[0, 0.27, 0]}><boxGeometry args={[0.3, 0.05, 0.15]} />{metal}</mesh>
      </group>
      {/* display & control module on the chest */}
      <group position={[0, 1.2, front + 0.05]}>
        <mesh><boxGeometry args={[0.22, 0.12, 0.07]} /><meshPhysicalMaterial color="#E3E5E8" roughness={0.5} clearcoat={0.4} /></mesh>
        {[-0.06, 0, 0.06].map((x, i) => <mesh key={x} position={[x, 0.02, 0.036]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color={['#3FD38E', '#62D2E6', '#F2B84B'][i]} /></mesh>)}
      </group>
      {/* CosmicPulse shoulder patch */}
      {kit.joints[0] && <mesh position={[kit.joints[0].c.x + 0.02, kit.joints[0].c.y - 0.06, kit.joints[0].c.z + 0.04]} rotation={[0, 0.9, 0]}><circleGeometry args={[0.03, 24]} /><meshBasicMaterial color="#62D2E6" /></mesh>}
    </group>
  );
}

/* ------------------------------------------------------------------ 1 · microgravity */

export function MicrogravityStage({ g, still }: { g: number; still: boolean }) {
  return (
    <Studio still={still} camera={[0.4, 1.05, 3.4]}>
      <Floating g={g} still={still} />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.35 * g + 0.05} scale={4} blur={2.6} far={2} color="#000814" />
      <Pad />
    </Studio>
  );
}

function Floating({ g, still }: { g: number; still: boolean }) {
  const grp = useRef<THREE.Group>(null);
  const lift = useRef(0);
  useFrame(({ clock }, dt) => {
    if (!grp.current) return;
    const t = clock.elapsedTime;
    const free = 1 - g;
    lift.current += ((free * 0.35) - lift.current) * Math.min(1, dt * 2.5);
    grp.current.position.y = lift.current + (still ? 0 : Math.sin(t * 0.8) * 0.05 * free);
    grp.current.rotation.z = still ? 0 : Math.sin(t * 0.35) * 0.12 * free;
    grp.current.rotation.x = still ? 0 : Math.cos(t * 0.27) * 0.08 * free;
  });
  return (
    <group ref={grp}>
      <Body look="human" boneLoad={0.25 + 0.75 * g} />
      <FluidShift g={g} still={still} />
    </group>
  );
}

/** Body-fluid particles: settle in the legs at 1 g, migrate towards the head in weightlessness. */
function FluidShift({ g, still }: { g: number; still: boolean }) {
  const N = 420;
  const tex = useGlow();
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ u: ((i * 0.618034) % 1), x: (Math.sin(i * 12.9898) * 43758.5453) % 1, z: (Math.sin(i * 78.233) * 12345.678) % 1, p: i * 0.37 })), []);
  const geo = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return geom;
  }, []);
  const a = useRef(1.8);
  useFrame(({ clock }, dt) => {
    const target = 0.35 + 1.6 * g; // <1 → head-heavy, >1 → feet-heavy
    a.current += (target - a.current) * Math.min(1, dt * 1.5);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = still ? 0 : clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const y = 0.08 + 1.5 * Math.pow(s.u, a.current);
      // body silhouette: narrower at the neck/legs, wider at the torso
      const w = y > 1.42 ? 0.07 : y > 1.3 ? 0.04 : y > 0.85 ? 0.15 : 0.11;
      const legSplit = y < 0.85 ? (i % 2 ? 0.09 : -0.09) : 0;
      pos.setXYZ(i, legSplit + s.x * w + Math.sin(t * 1.3 + s.p) * 0.01, y + Math.sin(t * 2 + s.p) * 0.01, s.z * 0.07);
    }
    pos.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial map={tex} size={0.055} color="#7FE7FF" transparent opacity={0.85} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function Pad() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
      <mesh><circleGeometry args={[0.7, 96]} /><meshStandardMaterial color="#0B2233" metalness={0.8} roughness={0.25} /></mesh>
      <mesh><ringGeometry args={[0.7, 0.72, 128]} /><meshBasicMaterial color="#62D2E6" /></mesh>
      <mesh><ringGeometry args={[0.85, 0.855, 128]} /><meshBasicMaterial color="#A99BFF" transparent opacity={0.5} /></mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ 2 · radiation */

export function RadiationStage({ shield, still }: { shield: number; still: boolean }) {
  return (
    <Studio still={still} camera={[0.6, 1.2, 5.4]} target={[0.2, 0.85, 0]} controls={false}>
      <Sun position={[-3.4, 0.35, -3.2]} />
      <Shield thickness={shield} />
      <group position={[1.1, 0, 0]} rotation={[0, -0.6, 0]}><Body look="human" /></group>
      <Particles shield={shield} still={still} />
      <Pad />
    </Studio>
  );
}

function Sun({ position }: { position: [number, number, number] }) {
  const tex = useGlow();
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[0.32, 32, 32]} /><meshBasicMaterial color="#FFE6A8" /></mesh>
      <sprite scale={[3.2, 3.2, 1]}><spriteMaterial map={tex} color="#FFB347" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[6, 6, 1]}><spriteMaterial map={tex} color="#FF7A3D" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  );
}

function Shield({ thickness }: { thickness: number }) {
  const w = 0.04 + thickness * 0.0035;
  return (
    <group position={[-0.25, 0.9, 0]}>
      <mesh rotation={[0, 0.5, 0]}>
        <boxGeometry args={[w, 1.8, 1.6]} />
        <meshPhysicalMaterial color="#B9C6D6" metalness={0.9} roughness={0.28} clearcoat={0.6} transparent opacity={0.55 + thickness / 250} />
      </mesh>
      <mesh rotation={[0, 0.5, 0]}>
        <boxGeometry args={[w + 0.01, 1.82, 1.62]} />
        <meshBasicMaterial color="#62D2E6" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

/** Cosmic-ray particles: a share stops at the shield (spark), the rest reach the body (flash). Illustrative. */
function Particles({ shield, still }: { shield: number; still: boolean }) {
  const N = 48;
  const tex = useGlow();
  const ref = useRef<THREE.Group>(null);
  const lanes = useMemo(() => Array.from({ length: N }, (_, i) => ({ y: 0.25 + ((i * 0.37) % 1.3), z: -0.5 + ((i * 0.61) % 1), off: (i * 0.21) % 1, pass: ((i * 7) % 10) / 10 })), []);
  const passShare = 1 - shield / 140;
  useFrame(({ clock }) => {
    const grp = ref.current;
    if (!grp) return;
    const t = still ? 0.5 : clock.elapsedTime * 0.45;
    grp.children.forEach((child, i) => {
      const l = lanes[i];
      const ph = (t + l.off) % 1;
      const passes = l.pass < passShare;
      const xStart = -3.2;
      const xStop = passes ? 1.05 : -0.3;
      const x = xStart + (xStop - xStart) * Math.min(1, ph / 0.8);
      const done = ph >= 0.8;
      const s = child as THREE.Sprite;
      s.position.set(x, l.y + (l.y - 0.9) * 0.15 * (1 - ph), l.z * (1 - ph * 0.6));
      const mat = s.material as THREE.SpriteMaterial;
      if (done) {
        const k = (ph - 0.8) / 0.2;
        s.scale.setScalar(0.12 + k * (passes ? 0.35 : 0.5));
        mat.opacity = 1 - k;
        mat.color.set(passes ? '#FF5A5A' : '#9FE6F2');
      } else {
        s.scale.set(0.22, 0.07, 1);
        mat.opacity = 0.95;
        mat.color.set('#FFB347');
      }
    });
  });
  return (
    <group ref={ref}>
      {lanes.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex} color="#FFB347" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ 3 · isolation */

export function IsolationStage({ crew, link, still }: { crew: number; link: boolean; still: boolean }) {
  return (
    <Studio still={still} camera={[0.3, 1.2, 5.6]} target={[0.3, 0.9, 0]} controls={false}>
      <Habitat />
      {Array.from({ length: crew }, (_, i) => <Astronaut key={i} i={i} n={crew} still={still} />)}
      <EarthBall position={[1.95, 1.75, -2.4]} r={0.42} still={still} />
      <CommBeam from={[1.0, 1.2, 0.2]} to={[1.75, 1.6, -2.2]} on={link} still={still} />
    </Studio>
  );
}

/** Cut-away pressurised module: horizontal, open towards the viewer so the crew is visible. */
function Habitat() {
  const ribs = [-1.1, -0.55, 0, 0.55, 1.1];
  return (
    <group position={[0, 0.85, 0]}>
      {/* hull: CylinderGeometry θ=0 points at +Z, so start at 0.3π and sweep 1.4π to leave the front open */}
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.85, 0.85, 2.6, 96, 1, true, Math.PI * 0.3, Math.PI * 1.4]} />
          <meshPhysicalMaterial color="#E6EBF2" metalness={0.3} roughness={0.38} side={THREE.DoubleSide} clearcoat={0.5} />
        </mesh>
        {/* inner wall panels (slightly inset, darker) for depth */}
        <mesh>
          <cylinderGeometry args={[0.8, 0.8, 2.5, 96, 1, true, Math.PI * 0.32, Math.PI * 1.36]} />
          <meshStandardMaterial color="#B9C4D2" metalness={0.2} roughness={0.6} side={THREE.BackSide} />
        </mesh>
      </group>
      {/* structural ribs following the hull arc */}
      {ribs.map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh rotation={[0, 0, Math.PI * 1.3]}>
            <torusGeometry args={[0.86, 0.022, 10, 72, Math.PI * 1.4]} />
            <meshStandardMaterial color="#8E9CB0" metalness={0.85} roughness={0.28} />
          </mesh>
        </group>
      ))}
      {/* end bulkheads with hatches */}
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh><circleGeometry args={[0.85, 64]} /><meshStandardMaterial color="#C9D3E0" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0, x > 0 ? -0.01 : 0.01]}><ringGeometry args={[0.28, 0.34, 48]} /><meshStandardMaterial color="#5E6B7E" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      {/* deck */}
      <mesh position={[0, -0.62, 0.05]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.5, 0.9]} /><meshStandardMaterial color="#7D8A9C" metalness={0.4} roughness={0.5} /></mesh>
      {/* warm cabin light strips */}
      <mesh position={[0, 0.74, -0.25]}><boxGeometry args={[2.3, 0.025, 0.06]} /><meshBasicMaterial color="#FFE7C2" /></mesh>
      <pointLight position={[0, 0.4, 0.2]} intensity={3.5} color="#FFE2B8" distance={3.5} />
    </group>
  );
}

function Astronaut({ i, n, still }: { i: number; n: number; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const x = n === 1 ? 0 : -0.9 + (1.8 * i) / (n - 1);
  useFrame(({ clock }) => {
    if (!ref.current || still) return;
    const t = clock.elapsedTime + i * 1.7;
    ref.current.position.y = 0.75 + Math.sin(t * 0.7) * 0.08;
    ref.current.rotation.z = Math.sin(t * 0.4) * 0.25;
    ref.current.rotation.y = Math.sin(t * 0.3) * 0.6;
  });
  const suit = <meshPhysicalMaterial color="#F4F6FA" roughness={0.55} clearcoat={0.3} />;
  return (
    <group ref={ref} position={[x, 0.75, 0.05 * (i % 2 ? 1 : -1)]} scale={0.32}>
      <mesh position={[0, 0.55, 0]}><sphereGeometry args={[0.32, 32, 32]} />{suit}</mesh>
      <mesh position={[0, 0.55, 0.16]}><sphereGeometry args={[0.22, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2.2]} /><meshPhysicalMaterial color="#C99A2E" metalness={1} roughness={0.12} /></mesh>
      <mesh><capsuleGeometry args={[0.26, 0.42, 8, 16]} />{suit}</mesh>
      <mesh position={[0, 0.05, -0.27]}><boxGeometry args={[0.4, 0.5, 0.18]} /><meshStandardMaterial color="#C9D3E0" roughness={0.5} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.36, 0.08, 0]} rotation={[0, 0, s * 0.5]}><capsuleGeometry args={[0.08, 0.34, 6, 10]} />{suit}</mesh>)}
      {[-1, 1].map((s) => <mesh key={`l${s}`} position={[s * 0.12, -0.52, 0]}><capsuleGeometry args={[0.09, 0.36, 6, 10]} />{suit}</mesh>)}
      <mesh position={[0, 0.1, 0.27]}><boxGeometry args={[0.18, 0.12, 0.02]} /><meshBasicMaterial color="#62D2E6" /></mesh>
    </group>
  );
}

function EarthBall({ position, r, still }: { position: [number, number, number]; r: number; still: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/images/textures/earth-day.jpg');
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const glow = useGlow();
  useFrame((_, dt) => {
    if (!still && ref.current) ref.current.rotation.y += dt * 0.08;
  });
  return (
    <group position={position}>
      <mesh ref={ref}><sphereGeometry args={[r, 64, 64]} /><meshStandardMaterial map={tex} roughness={0.9} metalness={0} /></mesh>
      <sprite scale={[r * 3.2, r * 3.2, 1]}><spriteMaterial map={glow} color="#4FA3FF" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  );
}

function CommBeam({ from, to, on, still }: { from: [number, number, number]; to: [number, number, number]; on: boolean; still: boolean }) {
  const a = useMemo(() => new THREE.Vector3(...from), [from]);
  const b = useMemo(() => new THREE.Vector3(...to), [to]);
  const pulses = useRef<THREE.Group>(null);
  const tex = useGlow();
  const line = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geom, new THREE.LineDashedMaterial({ color: '#62D2E6', dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.7 }));
    l.computeLineDistances();
    return l;
  }, [a, b]);
  useEffect(() => {
    const m = line.material as THREE.LineDashedMaterial;
    m.color.set(on ? '#62D2E6' : '#FF6464');
    m.opacity = on ? 0.7 : 0.35;
  }, [line, on]);
  useFrame(({ clock }) => {
    if (!pulses.current) return;
    pulses.current.visible = on;
    const t = still ? 0.3 : clock.elapsedTime * 0.5;
    pulses.current.children.forEach((c, i) => c.position.lerpVectors(a, b, (t + i / 3) % 1));
  });
  return (
    <group>
      <primitive object={line} />
      <group ref={pulses}>{[0, 1, 2].map((i) => <sprite key={i} scale={[0.14, 0.14, 1]}><spriteMaterial map={tex} color="#9FE6F2" transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>)}</group>
    </group>
  );
}

/* ------------------------------------------------------------------ 4 · closed habitat */

export function EnvironmentStage({ co2, level, still }: { co2: number; level: 'nominal' | 'caution' | 'action'; still: boolean }) {
  const lamp = level === 'action' ? '#FF5A5A' : level === 'caution' ? '#F2B84B' : '#3FD38E';
  return (
    <Studio still={still} camera={[0, 1.1, 5.2]} target={[0, 0.85, 0]} controls={false}>
      <Habitat />
      <Scrubber lamp={lamp} still={still} />
      <Sparkles count={Math.round(co2 * 22)} scale={[2.2, 1.4, 1.2]} position={[0, 0.9, 0]} size={4} speed={still ? 0 : 0.35} color={level === 'nominal' ? '#9FB4C8' : level === 'caution' ? '#C9A46A' : '#E07A7A'} opacity={0.9} />
      <group position={[0.15, 0, 0]} scale={0.95}><Astronaut i={0} n={1} still={still} /></group>
    </Studio>
  );
}

function Scrubber({ lamp, still }: { lamp: string; still: boolean }) {
  const fan = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!still && fan.current) fan.current.rotation.z += dt * 6;
  });
  return (
    <group position={[-0.95, 0.95, 0.1]} rotation={[0, 0.5, 0]}>
      <mesh><boxGeometry args={[0.42, 0.62, 0.22]} /><meshPhysicalMaterial color="#D5DCE6" metalness={0.6} roughness={0.3} clearcoat={0.5} /></mesh>
      <mesh position={[0, 0.06, 0.112]}><circleGeometry args={[0.15, 48]} /><meshStandardMaterial color="#1A2230" metalness={0.7} roughness={0.4} /></mesh>
      <group ref={fan} position={[0, 0.06, 0.12]}>
        {[0, 1, 2, 3, 4].map((k) => <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 5]} position={[0, 0.06, 0]}><boxGeometry args={[0.045, 0.12, 0.005]} /><meshStandardMaterial color="#AEBBCD" metalness={0.9} roughness={0.2} /></mesh>)}
      </group>
      <mesh position={[0, -0.22, 0.112]}><circleGeometry args={[0.035, 24]} /><meshBasicMaterial color={lamp} /></mesh>
      <pointLight position={[0, -0.22, 0.25]} intensity={1.5} color={lamp} distance={1.2} />
    </group>
  );
}

/* ------------------------------------------------------------------ 5 · distance */

export function DistanceStage({ au, seconds, still }: { au: number; seconds: number; still: boolean }) {
  return (
    <Studio still={still} camera={[0, 3.8, 5.2]} target={[0, 0, 0]} controls={false}>
      <SolarSystem au={au} seconds={seconds} still={still} />
    </Studio>
  );
}

function SolarSystem({ au, seconds, still }: { au: number; seconds: number; still: boolean }) {
  const R_E = 1.6;
  const R_M = 1.6 * 1.524;
  const moonMode = au < 0.05;
  // Mars angle so that the Earth–Mars distance matches the slider (law of cosines, 1 AU = R_E).
  const d = au * R_E;
  const cos = THREE.MathUtils.clamp((R_E * R_E + R_M * R_M - d * d) / (2 * R_E * R_M), -1, 1);
  const theta = Math.acos(cos);
  const earth = useMemo(() => new THREE.Vector3(R_E, 0, 0), []);
  const target = useMemo(() => (moonMode ? new THREE.Vector3(R_E + 0.45, 0.05, 0.2) : new THREE.Vector3(Math.cos(theta) * R_M, 0, -Math.sin(theta) * R_M)), [moonMode, theta, R_M]);
  const pulse = useRef<THREE.Sprite>(null);
  const tex = useGlow();
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const dur = THREE.MathUtils.clamp(seconds / 60, 0.8, 6);
    const k = still ? 0.5 : (clock.elapsedTime % dur) / dur;
    pulse.current.position.lerpVectors(earth, target, k);
  });
  const orbit = (r: number, color: string) => (
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r - 0.005, r + 0.005, 160]} /><meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} /></mesh>
  );
  const line = useMemo(() => new THREE.BufferGeometry().setFromPoints([earth, target]), [earth, target]);
  return (
    <group>
      <Sun position={[0, 0, 0]} />
      {orbit(R_E, '#7CC8F2')}
      {orbit(R_M, '#D86F34')}
      <EarthBall position={[R_E, 0, 0]} r={0.16} still={still} />
      {moonMode ? (
        <mesh position={target}><sphereGeometry args={[0.06, 32, 32]} /><meshStandardMaterial color="#D7D3E6" roughness={0.95} /></mesh>
      ) : (
        <mesh position={target}><sphereGeometry args={[0.11, 48, 48]} /><meshStandardMaterial color="#C1440E" roughness={0.85} emissive="#5A1A05" emissiveIntensity={0.3} /></mesh>
      )}
      <lineSegments geometry={line}><lineBasicMaterial color="#62D2E6" transparent opacity={0.5} /></lineSegments>
      <sprite ref={pulse} scale={[0.22, 0.22, 1]}><spriteMaterial map={tex} color="#9FE6F2" transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  );
}

useGLTF.preload('/models/anatomy.glb');
