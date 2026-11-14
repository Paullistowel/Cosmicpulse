'use client';

import { Html, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';

import { MODULES, type ModuleId } from './modules';

function Module({ m, locked, selected, onSelect }: { m: (typeof MODULES)[number]; locked: boolean; selected: boolean; onSelect: (id: ModuleId) => void }) {
  const [hover, setHover] = useState(false);
  const horizontal = m.pos[2] === 0 && m.pos[1] === 0 && m.id !== 'command';
  const color = locked ? '#566273' : m.color;
  return (
    <group position={m.pos} onClick={(e) => { e.stopPropagation(); onSelect(m.id); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      {m.id === 'cupola' ? (
        <mesh><sphereGeometry args={[0.45, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || hover ? 0.7 : 0.2} metalness={0.4} roughness={0.3} transparent opacity={0.9} /></mesh>
      ) : (
        <mesh rotation={horizontal ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, m.id === 'command' ? 1.0 : 1.6, 24]} />
          <meshStandardMaterial color="#C9D3DE" emissive={color} emissiveIntensity={selected || hover ? 0.55 : 0.12} metalness={0.6} roughness={0.35} />
        </mesh>
      )}
      <mesh><torusGeometry args={[0.47, 0.025, 8, 32]} /><meshBasicMaterial color={color} /></mesh>
      {(hover || selected) && <Html center position={[0, 0.85, 0]} distanceFactor={8} style={{ pointerEvents: 'none' }}><span className="t-caption whitespace-nowrap rounded-full bg-[rgba(5,8,13,0.8)] px-2.5 py-1 text-white">{m.name}{locked ? ' · locked' : ''}</span></Html>}
    </group>
  );
}

function Station({ rankIndex, selected, onSelect, still }: { rankIndex: number; selected: ModuleId | null; onSelect: (id: ModuleId) => void; still: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!still && g.current && !selected) g.current.rotation.y += dt * 0.08;
  });
  return (
    <group ref={g}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 9, 8]} /><meshStandardMaterial color="#8B97A6" metalness={0.7} roughness={0.4} /></mesh>
      {[-4.2, -3.4, 3.4, 4.2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.7, 0.02, 2.6]} /><meshStandardMaterial color="#1D3B66" emissive="#163A6E" emissiveIntensity={0.4} metalness={0.8} roughness={0.25} /></mesh>
      ))}
      {MODULES.map((m) => <Module key={m.id} m={m} locked={rankIndex < m.minRank} selected={selected === m.id} onSelect={onSelect} />)}
    </group>
  );
}

export default function StationScene({ rankIndex, selected, onSelect, still }: { rankIndex: number; selected: ModuleId | null; onSelect: (id: ModuleId) => void; still: boolean }) {
  return (
    <Canvas camera={{ position: [5, 3.2, 6.5], fov: 42 }} dpr={[1, 2]} frameloop={still ? 'demand' : 'always'} aria-hidden>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 5, 3]} intensity={1.4} />
      <pointLight position={[-4, -2, -3]} intensity={12} color="#62D2E6" />
      <Stars radius={70} depth={40} count={2500} factor={3.5} fade speed={still ? 0 : 0.5} />
      <Station rankIndex={rankIndex} selected={selected} onSelect={onSelect} still={still} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={14} enableDamping />
    </Canvas>
  );
}
