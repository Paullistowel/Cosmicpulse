'use client';

import { Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

import { Moon, Nebula, Orbit, Planet, SUN } from '@/components/universe/hub-scene';

export type Pick = 'earth' | 'station' | 'moon';

/**
 * Interactive launch universe: drag (or move the pointer) to look around, tap Earth, the
 * station or the Moon, and press launch for a warp-speed dive. Built on the same shader
 * planet and station as the mission hub so the story's world stays consistent.
 */
// The camera is driven imperatively every frame by design.
/* eslint-disable react-hooks/immutability */
function Rig({ launching, still }: { launching: boolean; still: boolean }) {
  const { camera, pointer } = useThree();
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (launching) {
      if (t0.current == null) t0.current = clock.elapsedTime;
      const k = Math.min(1, (clock.elapsedTime - t0.current) / 1.6);
      // ease-in dive towards the planet with a widening field of view (warp feel)
      const e = k * k * k;
      cam.position.lerp(new THREE.Vector3(0.6, 0.2, 2.2 - e * 1.6), 0.08);
      cam.fov = 42 + e * 48;
      cam.updateProjectionMatrix();
      cam.lookAt(0.6, 0.1, 0);
      return;
    }
    if (still) return;
    // gentle parallax towards the pointer
    const target = new THREE.Vector3(pointer.x * 1.2, 0.4 + pointer.y * 0.6, 6.4);
    cam.position.lerp(target, 1 - Math.exp(-dt * 2));
    cam.lookAt(0.6, 0.1, 0);
  });
  return null;
}
/* eslint-enable react-hooks/immutability */

/** Warp streak field — built once at module load (client-only module). */
const WARP_GEO = (() => {
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 8;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.sin(a) * r;
    pos[i * 3 + 2] = -Math.random() * 40;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
})();

function Warp({ on }: { on: boolean }) {
  useFrame((_, dt) => {
    if (!on) return;
    const p = WARP_GEO.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let z = p.getZ(i) + dt * 60;
      if (z > 6) z -= 46;
      p.setZ(i, z);
    }
    p.needsUpdate = true;
  });
  return (
    <points geometry={WARP_GEO} visible={on}>
      <pointsMaterial size={0.06} color="#BFEFFA" transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

export default function LaunchScene({ onPick, launching, reducedMotion, paused = false }: { onPick: (p: Pick) => void; launching: boolean; reducedMotion: boolean; paused?: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.4, 6.4], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} frameloop={paused ? 'never' : reducedMotion && !launching ? 'demand' : 'always'}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[SUN.x * 10, SUN.y * 10, SUN.z * 10]} intensity={2.2} color="#FFF3E2" />
      <pointLight position={[4, -2, 3]} intensity={6} color="#A99BFF" />
      <Nebula />
      <Stars radius={60} depth={40} count={3500} factor={3.4} fade speed={reducedMotion ? 0 : 1} />
      <group position={[1.9, -0.15, 0]} scale={0.78}>
        <Planet still={reducedMotion} onPick={() => onPick('earth')} />
        <Orbit still={reducedMotion} onPick={() => onPick('station')} />
      </group>
      {/* Moon parked top-right (clear of the logo), still tappable */}
      <group position={[-0.5, 0.45, 0.6]}>
        <Moon still onPick={() => onPick('moon')} />
      </group>
      <Warp on={launching} />
      <Rig launching={launching} still={reducedMotion} />
    </Canvas>
  );
}
