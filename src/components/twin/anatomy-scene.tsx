'use client';

import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { STRUCTURE_BY_ID, type LayerId, type StructureId } from '@/twin/anatomy';
import { STATUS_COPY, SYSTEM_BY_ID, type SystemId, type SystemStatus } from '@/twin/systems';

/**
 * Realistic anatomical digital twin. Geometry: BodyParts3D (DBCLS, CC BY-SA 2.1 JP),
 * reduced and compressed by scripts/anatomy/build.mjs into one GLB with a named node per
 * structure. Motion rules are unchanged from the first twin: the heart beats ONLY at the
 * latest recorded heart rate and the lungs move ONLY at the latest recorded breathing
 * rate; without a fresh reading, or with reduced motion, they stay still.
 */

export const ANATOMY_URL = '/models/anatomy.glb';

export type AnatomyProps = {
  status: Record<SystemId, SystemStatus>;
  selected: SystemId | null;
  onSelect: (id: SystemId | null) => void;
  layers: LayerId[];
  view: 'anatomy' | 'status';
  heartRate?: number;
  respRate?: number;
  reducedMotion: boolean;
  onStructures?: (ids: StructureId[]) => void;
};

type Part = { id: StructureId; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; base: { pos: THREE.Vector3; scale: THREE.Vector3 }; center: THREE.Vector3; box: THREE.Box3 };

const GREY = new THREE.Color('#7C8796');

/** Fresnel rim (holographic x-ray edge) — strength is driven by userData.rim (0 = off). */
function addRim(m: THREE.MeshPhysicalMaterial) {
  const uniforms = { rimStrength: { value: 0 }, rimColor: { value: new THREE.Color('#8FE3F5') } };
  m.userData.rim = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float rimStrength;\nuniform vec3 rimColor;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6);
        outgoingLight += rimColor * fres * rimStrength * 1.6;
        diffuseColor.a = clamp(diffuseColor.a + fres * rimStrength * 0.55, 0.0, 1.0);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'skin-rim';
}

function makeMaterial(id: StructureId) {
  const s = STRUCTURE_BY_ID[id];
  const m = new THREE.MeshPhysicalMaterial({ color: s.color, roughness: s.roughness, metalness: 0, transparent: true, side: THREE.FrontSide });
  if (s.layer === 'organs' || s.layer === 'vessels') {
    m.clearcoat = 0.45; // moist tissue sheen
    m.clearcoatRoughness = 0.35;
  }
  if (id === 'muscles') {
    m.sheen = 0.6;
    m.sheenColor = new THREE.Color('#E58C7C');
    m.sheenRoughness = 0.5;
  }
  if (id === 'skin') {
    m.sheen = 0.4;
    m.sheenColor = new THREE.Color('#FFD9C7');
    addRim(m);
  }
  return m;
}

function Model(props: AnatomyProps & { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { scene } = useGLTF(ANATOMY_URL);
  const { invalidate } = useThree();
  const [hover, setHover] = useState<{ id: StructureId; point: THREE.Vector3 } | null>(null);

  const parts = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const list: Part[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = (mesh.name in STRUCTURE_BY_ID ? mesh.name : mesh.parent?.name) as StructureId;
      if (!STRUCTURE_BY_ID[id]) return;
      const mat = makeMaterial(id);
      mesh.material = mat;
      const box = new THREE.Box3().setFromObject(mesh);
      list.push({ id, mesh, mat, base: { pos: mesh.position.clone(), scale: mesh.scale.clone() }, center: box.getCenter(new THREE.Vector3()), box });
    });
    return { root, list };
  }, [scene]);

  const { onStructures } = props;
  useEffect(() => onStructures?.(parts.list.map((p) => p.id)), [parts, onStructures]);

  // Materials: layer visibility, system focus, status view.
  // Three.js scene objects are imperative by design; mutating them here is intended.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    const { selected, layers, view, status } = props;
    const showInner = layers.some((l) => l !== 'skin');
    for (const p of parts.list) {
      const s = STRUCTURE_BY_ID[p.id];
      const visible = layers.includes(s.layer);
      p.mesh.visible = visible;
      const inSystem = !selected || s.system === selected;
      const st = s.system ? status[s.system] : 'unknown';
      const statusColor = new THREE.Color(STATUS_COPY[st].color);
      const base = new THREE.Color(s.color);
      p.mat.color.copy(view === 'status' && s.system ? (st === 'unknown' ? base.clone().lerp(GREY, 0.75) : base.clone().lerp(statusColor, 0.7)) : base);
      if (!inSystem) p.mat.color.lerp(GREY, 0.55);
      const focused = !!selected && s.system === selected;
      // Anatomy view keeps true tissue colours (focus = gentle self-glow); status view tints by status.
      if (view === 'status' && s.system && st !== 'unknown') {
        p.mat.emissive.copy(statusColor);
        p.mat.emissiveIntensity = focused ? 0.3 : 0.12;
      } else {
        p.mat.emissive.copy(focused ? base : new THREE.Color(0));
        p.mat.emissiveIntensity = focused ? (p.id === 'eyes' || p.id === 'skeleton' ? 0.05 : 0.22) : 0;
      }
      let opacity = 1;
      if (p.id === 'skin') {
        // Inner layers visible → ice-blue x-ray glass with a glowing rim; alone → realistic skin.
        opacity = showInner ? (selected && selected !== 'immune' ? 0.03 : 0.07) : 1;
        if (showInner) p.mat.color.set('#9CCFE0');
        const rim = p.mat.userData.rim as { rimStrength: { value: number } } | undefined;
        if (rim) rim.rimStrength.value = showInner ? (selected && selected !== 'immune' ? 0.45 : 0.9) : 0.12;
      }
      else if (p.id === 'muscles') opacity = selected && selected !== 'musculoskeletal' ? 0.08 : layers.includes('organs') ? 0.55 : 1;
      else if (!inSystem) opacity = s.layer === 'skeleton' ? 0.22 : 0.14;
      p.mat.opacity = opacity;
      p.mat.depthWrite = opacity > 0.5;
      p.mesh.renderOrder = p.id === 'skin' ? 10 : opacity < 1 ? 5 : 0;
      p.mat.needsUpdate = true;
    }
    invalidate();
  }, [parts, props, invalidate]);
  /* eslint-enable react-hooks/immutability */

  // Heartbeat and breathing — only at recorded rates.
  const heart = parts.list.find((p) => p.id === 'heart');
  const lungs = parts.list.find((p) => p.id === 'lungs');
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = (p: Part | undefined, s: number) => {
      if (!p) return;
      p.mesh.scale.copy(p.base.scale).multiplyScalar(s);
      // scale about the structure's own centre
      p.mesh.position.copy(p.center).add(p.base.pos.clone().sub(p.center).multiplyScalar(s));
    };
    if (props.reducedMotion || !props.heartRate) pulse(heart, 1);
    else {
      const period = 60 / props.heartRate;
      const ph = (t % period) / period;
      pulse(heart, 1 + Math.exp(-((ph - 0.08) ** 2) / 0.002) * 0.06 + Math.exp(-((ph - 0.28) ** 2) / 0.003) * 0.035);
    }
    if (props.reducedMotion || !props.respRate) pulse(lungs, 1);
    else pulse(lungs, 1 + 0.035 * (0.5 - 0.5 * Math.cos((t * 2 * Math.PI * props.respRate) / 60)));
  });

  // Camera focus on the selected system's bounding box.
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const focus = useMemo(() => {
    const box = new THREE.Box3();
    // Frame the system's organs when it has any (heart, lungs, brain…), else all of its structures.
    const inSys = parts.list.filter((p) => (props.selected ? STRUCTURE_BY_ID[p.id].system === props.selected && p.id !== 'skin' : true));
    const organs = inSys.filter((p) => STRUCTURE_BY_ID[p.id].layer === 'organs');
    const pick = props.selected && organs.length ? organs : inSys;
    for (const p of pick) box.union(p.box);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.3, 0, -0.2), new THREE.Vector3(0.3, 1.75, 0.2));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
        // Narrow (portrait) viewports need more distance so the width still fits.
    const fitW = (size.x * (aspect < 0.75 ? 1.7 : 1.3)) / Math.min(1, aspect / 0.75);
    return { center, distance: Math.max(0.75, Math.max(size.y, fitW) * (props.selected ? 2.4 : 2.3)) };
  }, [parts, props.selected, aspect]);
  const { camera } = useThree();
  const goal = useRef(new THREE.Vector3());
  const key = useRef('');
  const flying = useRef(false);
  // The user's own rotate / zoom always wins: interacting cancels the fly-to.
  useEffect(() => {
    const c = props.controls.current;
    if (!c) return;
    const stop = () => (flying.current = false);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [props.controls]);
  useFrame((_, dt) => {
    const c = props.controls.current;
    if (!c) return;
    const k = `${props.selected ?? 'body'}:${focus.distance.toFixed(2)}`;
    if (key.current !== k) {
      key.current = k;
      const dir = camera.position.clone().sub(c.target).normalize();
      if (Math.abs(dir.y) > 0.8) dir.set(0.3, 0.1, 1).normalize();
      goal.current.copy(focus.center).add(dir.multiplyScalar(focus.distance));
      flying.current = true;
    }
    if (!flying.current) return;
    const a = props.reducedMotion ? 1 : 1 - Math.exp(-dt * 3);
    c.target.lerp(focus.center, a);
    camera.position.lerp(goal.current, a);
    c.update();
    invalidate();
    if (camera.position.distanceTo(goal.current) < 0.005 && c.target.distanceTo(focus.center) < 0.005) flying.current = false;
  });

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const id = (e.object.name in STRUCTURE_BY_ID ? e.object.name : e.object.parent?.name) as StructureId;
    const sys = STRUCTURE_BY_ID[id]?.system;
    if (sys) props.onSelect(sys);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = (e.object.name in STRUCTURE_BY_ID ? e.object.name : e.object.parent?.name) as StructureId;
    if (!STRUCTURE_BY_ID[id]) return;
    document.body.style.cursor = 'pointer';
    setHover((h) => (h?.id === id && h.point.distanceTo(e.point) < 0.02 ? h : { id, point: e.point.clone() }));
  };

  const hs = hover ? STRUCTURE_BY_ID[hover.id] : null;
  return (
    <group>
      <primitive object={parts.root} onClick={onPick} onPointerMove={onMove} onPointerOut={() => { setHover(null); document.body.style.cursor = ''; }} />
      {hover && hs && (
        <Html position={hover.point} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <span className="t-caption -translate-y-8 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgba(5,8,13,0.85)] px-2.5 py-1 text-white shadow-lg">
            {hs.system && <span className="size-2 rounded-full" style={{ background: STATUS_COPY[props.status[hs.system]].color }} />}
            {hs.label}
            {hs.system && <span className="text-white/60">· {SYSTEM_BY_ID[hs.system].name}</span>}
          </span>
        </Html>
      )}
    </group>
  );
}

function Pedestal({ still }: { still: boolean }) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!still && ring.current) ring.current.rotation.z += dt * 0.12;
  });
  return (
    <group position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><circleGeometry args={[0.55, 96]} /><meshBasicMaterial color="#0B3448" transparent opacity={0.45} depthWrite={false} /></mesh>
      <mesh><ringGeometry args={[0.55, 0.565, 128]} /><meshBasicMaterial color="#62D2E6" transparent opacity={0.8} depthWrite={false} /></mesh>
      <group ref={ring}>
        <mesh><ringGeometry args={[0.68, 0.688, 128, 1, 0, Math.PI * 1.35]} /><meshBasicMaterial color="#9FE6F2" transparent opacity={0.5} depthWrite={false} /></mesh>
        <mesh rotation={[0, 0, Math.PI]}><ringGeometry args={[0.76, 0.764, 128, 1, 0, Math.PI * 0.6]} /><meshBasicMaterial color="#A99BFF" transparent opacity={0.45} depthWrite={false} /></mesh>
      </group>
    </group>
  );
}

function Loader() {
  const { progress, active } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex w-56 flex-col items-center gap-2 text-center" role="status">
        <span className="t-telemetry text-ink-3">LOADING ANATOMY · {Math.round(progress)}%</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-[var(--primary)] transition-[width]" style={{ width: `${progress}%` }} /></span>
      </div>
    </div>
  );
}

export default function AnatomyScene(props: AnatomyProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const still = props.reducedMotion;
  return (
    <div className="relative h-full w-full">
    <Canvas
      camera={{ position: [0.8, 1.1, 3.7], fov: 32, near: 0.05, far: 50 }}
      dpr={[1, 2]}
      frameloop={still ? 'demand' : 'always'}
      onPointerMissed={() => props.onSelect(null)}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      aria-hidden>
      <hemisphereLight args={['#E6F2FF', '#2A1C16', 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} color="#FFF4EA" />
      <directionalLight position={[-3, 2, -2.5]} intensity={1.6} color="#62D2E6" />
      <directionalLight position={[0, 1, -3]} intensity={0.8} color="#A99BFF" />
      <directionalLight position={[-2, 1.5, 3]} intensity={0.7} />
      <Suspense fallback={null}>
        <Model {...props} controls={controls} />
      </Suspense>
      <Pedestal still={still} />
      <OrbitControls ref={controls} enablePan={false} minDistance={0.45} maxDistance={6} minPolarAngle={0.25} maxPolarAngle={Math.PI - 0.35} enableDamping target={[0, 0.83, 0]} />
    </Canvas>
    <Loader />
    </div>
  );
}

useGLTF.preload(ANATOMY_URL);
