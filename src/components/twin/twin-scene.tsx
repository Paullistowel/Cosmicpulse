'use client';

import { Html, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { STATUS_COPY, SYSTEMS, type SystemId, type SystemStatus } from '@/twin/systems';

/**
 * Astronaut Digital Twin — procedural holographic anatomy (no external model
 * download, works offline). Organ colours come from real system status.
 * Motion rules: the heart beats ONLY at the latest recorded heart rate and the
 * lungs move ONLY at the latest recorded respiratory rate; with no reading, or
 * under reduced motion, they stay still. Everything else moves only as a
 * selection highlight.
 */

export type TwinProps = {
  status: Record<SystemId, SystemStatus>;
  selected: SystemId | null;
  onSelect: (id: SystemId | null) => void;
  heartRate?: number;
  respRate?: number;
  reducedMotion: boolean;
  dark: boolean;
};

const FOCUS: Record<SystemId | 'body', { target: [number, number, number]; distance: number }> = {
  body: { target: [0, 1.6, 0], distance: 5.6 },
  cardiovascular: { target: [0.1, 2.35, 0.1], distance: 3.0 },
  respiratory: { target: [0, 2.35, 0], distance: 3.4 },
  neuro: { target: [0, 3.15, 0], distance: 2.6 },
  musculoskeletal: { target: [0, 1.5, 0], distance: 6.2 },
  immune: { target: [0, 2.2, 0], distance: 4.6 },
  metabolic: { target: [0, 1.95, 0.05], distance: 3.2 },
};

function CameraRig({ selected, controls }: { selected: SystemId | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, invalidate } = useThree();
  const goal = useRef(new THREE.Vector3());
  const last = useRef<string>('');
  // Works with frameloop="demand" (reduced motion): keep requesting frames until converged.
  useEffect(() => invalidate(), [selected, invalidate]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const f = FOCUS[selected ?? 'body'];
    const key = selected ?? 'body';
    if (last.current !== key) {
      last.current = key;
      const dir = camera.position.clone().sub(c.target).normalize();
      goal.current.set(...f.target).add(dir.multiplyScalar(f.distance));
    }
    const k = 1 - Math.exp(-dt * 3.2);
    c.target.lerp(new THREE.Vector3(...f.target), k);
    const far = camera.position.distanceTo(goal.current) > 0.02;
    if (far) camera.position.lerp(goal.current, k);
    c.update();
    if (far) invalidate();
  });
  return null;
}

function Hotspot({ id, position, children, selected, onSelect, label }: { id: SystemId; position: [number, number, number]; children: ReactNode; selected: SystemId | null; onSelect: (id: SystemId) => void; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}>
      {children}
      {(hover || selected === id) && (
        <Html center distanceFactor={3.2} position={[0, 0.42, 0.2]} style={{ pointerEvents: 'none' }}>
          <span className="t-caption whitespace-nowrap rounded-full bg-[rgba(5,8,13,0.78)] px-2.5 py-1 text-white shadow">{label}</span>
        </Html>
      )}
    </group>
  );
}

/** Anatomical base colour; status shows as an emissive glow (warning / critical) or desaturation (unknown). */
const BASE: Record<SystemId, string> = { cardiovascular: '#E5484D', respiratory: '#F2A7AE', neuro: '#C9B6FF', musculoskeletal: '#E9E4D6', immune: '#62D2E6', metabolic: '#B8664B' };
function organMat(status: SystemStatus, active: boolean, dimmed: boolean, system: SystemId) {
  const base = new THREE.Color(status === 'unknown' ? '#7A8594' : BASE[system]);
  const glow = status === 'high' ? new THREE.Color('#FF4D4D') : status === 'attention' ? new THREE.Color('#F2B84B') : base;
  const intensity = status === 'high' || status === 'attention' ? (active ? 1.1 : 0.75) : active ? 0.55 : 0.12;
  return new THREE.MeshStandardMaterial({ color: base, emissive: glow, emissiveIntensity: intensity, roughness: 0.42, metalness: 0.05, transparent: true, opacity: dimmed ? 0.22 : 0.96 });
}

function Heart({ status, active, dimmed, hr, still }: { status: SystemStatus; active: boolean; dimmed: boolean; hr?: number; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => organMat(status, active, dimmed, 'cardiovascular'), [status, active, dimmed]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (still || !hr) return ref.current.scale.setScalar(1);
    const period = 60 / hr;
    const ph = (clock.elapsedTime % period) / period;
    // Lub-dub: two quick contractions per cycle.
    const beat = Math.exp(-((ph - 0.08) ** 2) / 0.002) * 0.14 + Math.exp(-((ph - 0.28) ** 2) / 0.003) * 0.08;
    ref.current.scale.setScalar(1 + beat);
  });
  return (
    <group ref={ref} rotation={[0, 0, -0.35]}>
      <mesh material={mat} position={[-0.06, 0.04, 0]}><sphereGeometry args={[0.1, 24, 24]} /></mesh>
      <mesh material={mat} position={[0.06, 0.04, 0]}><sphereGeometry args={[0.1, 24, 24]} /></mesh>
      <mesh material={mat} position={[0, -0.08, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.15, 0.22, 24]} /></mesh>
    </group>
  );
}

function Lungs({ status, active, dimmed, rr, still }: { status: SystemStatus; active: boolean; dimmed: boolean; rr?: number; still: boolean }) {
  const l = useRef<THREE.Mesh>(null);
  const r = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => organMat(status, active, dimmed, 'respiratory'), [status, active, dimmed]);
  useFrame(({ clock }) => {
    const s = still || !rr ? 1 : 1 + 0.07 * Math.sin((clock.elapsedTime * 2 * Math.PI * rr) / 60);
    l.current?.scale.set(0.17 * s, 0.3 * (1 + (s - 1) * 0.6), 0.15 * s);
    r.current?.scale.set(0.17 * s, 0.3 * (1 + (s - 1) * 0.6), 0.15 * s);
  });
  return (
    <group>
      <mesh ref={l} material={mat} position={[-0.22, 0.02, -0.06]}><sphereGeometry args={[1, 28, 28]} /></mesh>
      <mesh ref={r} material={mat} position={[0.22, 0.02, -0.06]}><sphereGeometry args={[1, 28, 28]} /></mesh>
    </group>
  );
}

function Brain({ status, active, dimmed, still }: { status: SystemStatus; active: boolean; dimmed: boolean; still: boolean }) {
  const mat = useMemo(() => organMat(status, active, dimmed, 'neuro'), [status, active, dimmed]);
  const nodes = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const t = i * 2.399963;
    const y = 1 - (i / 21) * 2;
    const rad = Math.sqrt(1 - y * y);
    return [Math.cos(t) * rad * 0.2, y * 0.15 + 0.03, Math.sin(t) * rad * 0.18] as [number, number, number];
  }), []);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    // Selection highlight only — not a measurement.
    g.current.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = still || !active ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(clock.elapsedTime * 2 + i));
    });
  });
  return (
    <group>
      <mesh material={mat} scale={[0.21, 0.17, 0.2]}><sphereGeometry args={[1, 28, 28]} /></mesh>
      <group ref={g}>
        {nodes.map((p, i) => (
          <mesh key={i} position={p}><sphereGeometry args={[0.014, 8, 8]} /><meshBasicMaterial color="#CFEFFF" transparent opacity={0.7} /></mesh>
        ))}
      </group>
    </group>
  );
}

function Bone({ from, to, r = 0.035, mat }: { from: [number, number, number]; to: [number, number, number]; r?: number; mat: THREE.Material }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <mesh position={mid} quaternion={q} material={mat}>
      <capsuleGeometry args={[r, len, 6, 12]} />
    </mesh>
  );
}

function Skeleton({ status, active, dimmed }: { status: SystemStatus; active: boolean; dimmed: boolean }) {
  const mat = useMemo(() => {
    const m = organMat(status, active, dimmed, 'musculoskeletal');
    m.opacity = dimmed ? 0.18 : active ? 0.95 : 0.55;
    return m;
  }, [status, active, dimmed]);
  return (
    <group>
      {Array.from({ length: 11 }, (_, i) => <mesh key={i} material={mat} position={[0, 1.55 + i * 0.12, -0.12]}><boxGeometry args={[0.07, 0.08, 0.07]} /></mesh>)}
      {[2.55, 2.4, 2.25, 2.1].map((y) => <mesh key={y} material={mat} position={[0, y, -0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.36, 0.018, 8, 32, Math.PI * 1.6]} /></mesh>)}
      <Bone from={[-0.75, 2.7, 0]} to={[-0.82, 1.95, 0]} mat={mat} />
      <Bone from={[0.75, 2.7, 0]} to={[0.82, 1.95, 0]} mat={mat} />
      <Bone from={[-0.82, 1.9, 0]} to={[-0.88, 1.2, 0.05]} r={0.028} mat={mat} />
      <Bone from={[0.82, 1.9, 0]} to={[0.88, 1.2, 0.05]} r={0.028} mat={mat} />
      <Bone from={[-0.25, 1.35, 0]} to={[-0.26, 0.55, 0]} r={0.05} mat={mat} />
      <Bone from={[0.25, 1.35, 0]} to={[0.26, 0.55, 0]} r={0.05} mat={mat} />
      <Bone from={[-0.26, 0.5, 0]} to={[-0.26, -0.25, 0]} r={0.04} mat={mat} />
      <Bone from={[0.26, 0.5, 0]} to={[0.26, -0.25, 0]} r={0.04} mat={mat} />
      <mesh material={mat} position={[0, 1.42, -0.05]} scale={[0.42, 0.16, 0.22]}><torusGeometry args={[1, 0.25, 8, 24]} /></mesh>
    </group>
  );
}

function Shell({ dark }: { dark: boolean }) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: dark ? '#7CC8F2' : '#25799C', transparent: true, opacity: dark ? 0.1 : 0.12, roughness: 0.2, metalness: 0, transmission: 0, depthWrite: false, side: THREE.DoubleSide }), [dark]);
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ color: dark ? '#62D2E6' : '#25799C', wireframe: true, transparent: true, opacity: dark ? 0.07 : 0.06, depthWrite: false }), [dark]);
  const parts: { pos: [number, number, number]; scale?: [number, number, number]; rot?: [number, number, number]; geo: ReactNode }[] = [
    { pos: [0, 3.18, 0], geo: <sphereGeometry args={[0.33, 32, 32]} />, scale: [0.95, 1.1, 1] },
    { pos: [0, 2.82, 0], geo: <cylinderGeometry args={[0.11, 0.13, 0.25, 16]} /> },
    { pos: [0, 2.15, 0], geo: <capsuleGeometry args={[0.52, 0.85, 12, 24]} />, scale: [1, 1, 0.62] },
    { pos: [0, 1.42, 0], geo: <sphereGeometry args={[0.5, 24, 24]} />, scale: [1.05, 0.55, 0.62] },
    { pos: [-0.79, 2.3, 0], geo: <capsuleGeometry args={[0.13, 0.65, 8, 16]} />, rot: [0, 0, -0.08] },
    { pos: [0.79, 2.3, 0], geo: <capsuleGeometry args={[0.13, 0.65, 8, 16]} />, rot: [0, 0, 0.08] },
    { pos: [-0.86, 1.55, 0.03], geo: <capsuleGeometry args={[0.11, 0.62, 8, 16]} />, rot: [0, 0, -0.05] },
    { pos: [0.86, 1.55, 0.03], geo: <capsuleGeometry args={[0.11, 0.62, 8, 16]} />, rot: [0, 0, 0.05] },
    { pos: [-0.26, 0.95, 0], geo: <capsuleGeometry args={[0.18, 0.72, 8, 16]} /> },
    { pos: [0.26, 0.95, 0], geo: <capsuleGeometry args={[0.18, 0.72, 8, 16]} /> },
    { pos: [-0.26, 0.15, 0], geo: <capsuleGeometry args={[0.13, 0.7, 8, 16]} /> },
    { pos: [0.26, 0.15, 0], geo: <capsuleGeometry args={[0.13, 0.7, 8, 16]} /> },
  ];
  return (
    <group>
      {parts.map((p, i) => (
        <group key={i} position={p.pos} rotation={p.rot ?? [0, 0, 0]} scale={p.scale ?? [1, 1, 1]}>
          <mesh material={mat}>{p.geo}</mesh>
          <mesh material={wire}>{p.geo}</mesh>
        </group>
      ))}
    </group>
  );
}

function Platform({ still, dark }: { still: boolean; dark: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!still && ref.current) ref.current.rotation.z += dt * 0.15;
  });
  return (
    <group position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><ringGeometry args={[1.0, 1.04, 64]} /><meshBasicMaterial color={dark ? '#62D2E6' : '#25799C'} transparent opacity={0.6} /></mesh>
      <group ref={ref}>
        <mesh><ringGeometry args={[1.25, 1.27, 64, 1, 0, Math.PI * 1.3]} /><meshBasicMaterial color={dark ? '#7CC8F2' : '#5F8466'} transparent opacity={0.45} /></mesh>
      </group>
      <mesh><circleGeometry args={[1.0, 64]} /><meshBasicMaterial color={dark ? '#0E2A3A' : '#DCEAEF'} transparent opacity={0.35} /></mesh>
    </group>
  );
}

export default function TwinScene({ status, selected, onSelect, heartRate, respRate, reducedMotion, dark }: TwinProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const still = reducedMotion;
  const is = (id: SystemId) => selected === id;
  const dim = (id: SystemId) => !!selected && selected !== id;
  const label = (id: SystemId) => `${SYSTEMS.find((s) => s.id === id)!.name} · ${STATUS_COPY[status[id]].label}`;
  return (
    <Canvas camera={{ position: [1.4, 2.2, 5.3], fov: 38 }} dpr={[1, 2]} frameloop={still ? 'demand' : 'always'} onPointerMissed={() => onSelect(null)} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={dark ? 0.55 : 0.9} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <pointLight position={[-3, 2.5, -2]} intensity={14} color="#62D2E6" />
      {dark && <Stars radius={60} depth={30} count={1500} factor={3} fade speed={still ? 0 : 0.6} />}
      <group position={[0, -0.1, 0]}>
        <Shell dark={dark} />
        <Hotspot id="musculoskeletal" position={[0, 0, 0]} selected={selected} onSelect={onSelect} label={label('musculoskeletal')}>
          <Skeleton status={status.musculoskeletal} active={is('musculoskeletal')} dimmed={dim('musculoskeletal')} />
        </Hotspot>
        <Hotspot id="neuro" position={[0, 3.2, 0]} selected={selected} onSelect={onSelect} label={label('neuro')}>
          <Brain status={status.neuro} active={is('neuro')} dimmed={dim('neuro')} still={still} />
        </Hotspot>
        <Hotspot id="respiratory" position={[0, 2.35, 0]} selected={selected} onSelect={onSelect} label={label('respiratory')}>
          <Lungs status={status.respiratory} active={is('respiratory')} dimmed={dim('respiratory')} rr={respRate} still={still} />
        </Hotspot>
        <Hotspot id="cardiovascular" position={[0.1, 2.32, 0.16]} selected={selected} onSelect={onSelect} label={label('cardiovascular')}>
          <Heart status={status.cardiovascular} active={is('cardiovascular')} dimmed={dim('cardiovascular')} hr={heartRate} still={still} />
        </Hotspot>
        <Hotspot id="metabolic" position={[0, 1.92, 0.06]} selected={selected} onSelect={onSelect} label={label('metabolic')}>
          <mesh material={organMat(status.metabolic, is('metabolic'), dim('metabolic'), 'metabolic')} position={[-0.17, 0, 0]} scale={[0.24, 0.12, 0.15]}><sphereGeometry args={[1, 24, 24]} /></mesh>
          <mesh material={organMat(status.metabolic, is('metabolic'), dim('metabolic'), 'metabolic')} position={[0.17, -0.04, 0.02]} scale={[0.13, 0.1, 0.1]}><sphereGeometry args={[1, 24, 24]} /></mesh>
        </Hotspot>
        <Hotspot id="immune" position={[0, 0, 0]} selected={selected} onSelect={onSelect} label={label('immune')}>
          {([[0, 2.78, 0.08], [-0.5, 2.62, 0.05], [0.5, 2.62, 0.05], [-0.22, 1.3, 0.12], [0.22, 1.3, 0.12], [-0.12, 2.0, 0.22]] as [number, number, number][]).map((p, i) => (
            <mesh key={i} position={p} material={organMat(status.immune, is('immune'), dim('immune'), 'immune')}><sphereGeometry args={[0.055, 16, 16]} /></mesh>
          ))}
        </Hotspot>
      </group>
      <Platform still={still} dark={dark} />
      <OrbitControls ref={controls} enablePan={false} minDistance={2.2} maxDistance={10} minPolarAngle={0.3} maxPolarAngle={Math.PI - 0.3} enableDamping />
      <CameraRig selected={selected} controls={controls} />
    </Canvas>
  );
}
