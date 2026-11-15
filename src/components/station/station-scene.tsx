'use client';

/* Three.js objects (camera, hotspots) are animated imperatively inside useFrame by design. */
/* eslint-disable react-hooks/immutability */

import { Environment, Html, Lightformer, OrbitControls, Stars, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { NOISE } from '@/components/universe/hub-scene';

import { MODULES, type ModuleId } from './modules';

/**
 * Station tour on the real International Space Station: NASA 3D Resources ISS (IGOAL),
 * reduced for the web (public/models/iss.glb). Realistic materials per part group, NASA Blue
 * Marble Earth below, sun with lens flare, and hotspots on the actual modules.
 */

const MATERIALS: Record<string, () => THREE.Material> = {
  // deep-blue photovoltaic blankets with an iridescent sheen, like real solar cells
  solar: () => new THREE.MeshPhysicalMaterial({ color: '#0A1D4A', metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.2, iridescence: 0.35, iridescenceIOR: 1.5, envMapIntensity: 0.55, side: THREE.DoubleSide, emissive: '#040E2A', emissiveIntensity: 0.4 }),
  irosa: () => new THREE.MeshPhysicalMaterial({ color: '#13306E', metalness: 0.35, roughness: 0.3, clearcoat: 1, iridescence: 0.3, envMapIntensity: 0.55, side: THREE.DoubleSide }),
  radiator: () => new THREE.MeshStandardMaterial({ color: '#EEF0F3', metalness: 0.02, roughness: 0.7, envMapIntensity: 0.35, side: THREE.DoubleSide }),
  truss: () => new THREE.MeshStandardMaterial({ color: '#B4BBC4', metalness: 0.85, roughness: 0.34 }),
  modules: () => new THREE.MeshPhysicalMaterial({ color: '#E9ECEF', metalness: 0.08, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#FFFFFF'), envMapIntensity: 0.6 }),
  russian: () => new THREE.MeshStandardMaterial({ color: '#D7DAD3', metalness: 0.25, roughness: 0.45 }),
  payload: () => new THREE.MeshStandardMaterial({ color: '#C9A13B', metalness: 1, roughness: 0.28 }),
  details: () => new THREE.MeshStandardMaterial({ color: '#9AA3AE', metalness: 0.75, roughness: 0.38 }),
};

function ISS() {
  const { scene } = useGLTF('/models/iss.glb');
  const root = useMemo(() => {
    const r = scene.clone(true);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const key = (m.name in MATERIALS ? m.name : (m.material as THREE.Material).name) || 'details';
      m.material = (MATERIALS[key] ?? MATERIALS.details)();
    });
    return r;
  }, [scene]);
  return <primitive object={root} />;
}

function Earth() {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/images/textures/earth-day.jpg');
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.0); gl_FragColor=vec4(vec3(0.45,0.75,1.0)*f*2.2, f); }',
      }),
    [],
  );
  // Drifting cloud layer (procedural, world-space lit) so Earth reads bright and alive from orbit.
  const clouds = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uSun: { value: new THREE.Vector3(-8, 10, 12).normalize() }, uTime: { value: 0 } },
        vertexShader: 'varying vec3 vP; varying vec3 vWN; void main(){ vP=position; vWN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `${NOISE}
          uniform vec3 uSun; uniform float uTime; varying vec3 vP; varying vec3 vWN;
          void main(){ vec3 p=normalize(vP); float c=fbm(p*3.2+vec3(uTime*0.004,0.0,uTime*0.002)); c+=0.5*fbm(p*9.0);
            float a=smoothstep(0.05,0.42,c); float l=0.55+0.6*max(dot(vWN,uSun),0.0); gl_FragColor=vec4(vec3(min(l,1.0)),a); }`,
      }),
    [],
  );
  // Earth surface: NASA Blue Marble with oceans lifted to the bright blue seen from orbit,
  // brighter land, soft terminator and an atmospheric rim.
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, uSun: { value: new THREE.Vector3(-8, 10, 12).normalize() } },
        vertexShader: 'varying vec2 vUv; varying vec3 vWN; varying vec3 vV; void main(){ vUv=uv; vWN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }',
        fragmentShader: `uniform sampler2D map; uniform vec3 uSun; varying vec2 vUv; varying vec3 vWN; varying vec3 vV;
          void main(){
            vec3 c=texture2D(map,vUv).rgb;
            float ocean=smoothstep(0.02,0.10,c.b-max(c.r,c.g)+0.03)*(1.0-smoothstep(0.35,0.6,c.r+c.g));
            vec3 sea=mix(vec3(0.07,0.30,0.62),vec3(0.18,0.50,0.85),smoothstep(0.0,0.25,c.b));
            vec3 land=pow(c,vec3(0.8))*1.25;
            vec3 col=mix(land,sea,ocean);
            float d=dot(vWN,uSun);
            float lit=smoothstep(-0.25,0.35,d);
            vec3 night=vec3(0.015,0.03,0.07);
            col=mix(night,col*(0.55+0.6*max(d,0.0)),lit);
            float rim=pow(1.0-max(dot(vWN,vV),0.0),2.5);
            col+=vec3(0.35,0.65,1.0)*rim*0.9*lit;
            gl_FragColor=vec4(col,1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [tex],
  );
  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.006;
    clouds.uniforms.uTime.value += dt;
  });
  return (
    <group position={[0, -71, -10]} rotation={[0.35, 2.2, 0.08]}>
      <mesh ref={ref} material={surface}>
        <sphereGeometry args={[60, 160, 160]} />
      </mesh>
      <mesh ref={cloudRef} scale={1.006} material={clouds}><sphereGeometry args={[60, 128, 128]} /></mesh>
      <mesh scale={1.025} material={atmo}><sphereGeometry args={[60, 96, 96]} /></mesh>
    </group>
  );
}

function SunFlare() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.15, 'rgba(255,250,235,0.9)');
    grd.addColorStop(0.4, 'rgba(255,220,170,0.25)');
    grd.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  const pos: [number, number, number] = [-13, 8, -12];
  return (
    <group position={pos}>
      <sprite scale={[7, 7, 1]}><spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[26, 1.2, 1]}><spriteMaterial map={tex} color="#FFE7C9" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[1.2, 14, 1]}><spriteMaterial map={tex} color="#FFE7C9" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[16, 16, 1]}><spriteMaterial map={tex} color="#FFB98A" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  );
}

function Hotspot({ m, locked, selected, onSelect }: { m: (typeof MODULES)[number]; locked: boolean; selected: boolean; onSelect: (id: ModuleId) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = locked ? '#7C8796' : m.color;
  useFrame(({ clock, camera }) => {
    if (!ring.current) return;
    const k = 1 + 0.25 * Math.sin(clock.elapsedTime * 3);
    ring.current.scale.setScalar((selected || hover ? 1.4 : 1) * k);
    ring.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group position={m.iss}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
      <mesh ref={ring}><ringGeometry args={[0.13, 0.16, 48]} /><meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} /></mesh>
      {(hover || selected) && (
        <Html center position={[0, 0.32, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <span className="t-caption whitespace-nowrap rounded-full bg-[rgba(5,8,13,0.85)] px-2.5 py-1 text-white shadow-lg">{m.name}{locked ? ' · 🔒' : ''}<span className="text-white/55"> · {m.issName}</span></span>
        </Html>
      )}
    </group>
  );
}

/** Flies the camera to a module (or back to the whole station) — then hands control back to the user. */
function Rig({ selected, controls }: { selected: ModuleId | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, invalidate } = useThree();
  const goalPos = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3(0, -0.6, 0));
  const flying = useRef(false);
  const key = useRef<string>('');
  // Any drag / zoom / pan by the user cancels the fly-to immediately.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (flying.current = false);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const k = selected ?? 'all';
    if (key.current !== k) {
      key.current = k;
      goalTarget.current.set(...(selected ? MODULES.find((x) => x.id === selected)!.iss : ([0, -0.6, 0] as [number, number, number])));
      const dir = camera.position.clone().sub(c.target).normalize();
      goalPos.current.copy(goalTarget.current).add(dir.multiplyScalar(selected ? 5.2 : 11));
      flying.current = true;
    }
    if (!flying.current) return;
    const a = 1 - Math.exp(-dt * 2.8);
    c.target.lerp(goalTarget.current, a);
    camera.position.lerp(goalPos.current, a);
    c.update();
    invalidate();
    if (camera.position.distanceTo(goalPos.current) < 0.01 && c.target.distanceTo(goalTarget.current) < 0.01) flying.current = false;
  });
  return null;
}

export default function StationScene({ rankIndex, selected, onSelect, still }: { rankIndex: number; selected: ModuleId | null; onSelect: (id: ModuleId | null) => void; still: boolean }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  return (
    <Canvas camera={{ position: [6.5, 2.6, 8.5], fov: 40, near: 0.05, far: 400 }} dpr={[1, 1.75]} frameloop={still ? 'demand' : 'always'} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }} onPointerMissed={() => onSelect(null)} aria-hidden>
      <color attach="background" args={['#02040A']} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-8, 10, 12]} intensity={3.4} color="#FFF5E8" />
      {/* Earthshine from below */}
      <directionalLight position={[0, -10, 2]} intensity={0.45} color="#7FB2FF" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[-6, 4, -8]} scale={[8, 4, 1]} color="#FFF3E0" />
        <Lightformer form="rect" intensity={0.5} position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} color="#3E7BD8" />
        <Lightformer form="rect" intensity={0.8} position={[6, 2, 6]} scale={[6, 3, 1]} color="#A99BFF" />
      </Environment>
      <Stars radius={150} depth={60} count={4000} factor={4} fade speed={still ? 0 : 0.3} />
      <SunFlare />
      <Suspense fallback={null}>
        <Earth />
        <ISS />
        {MODULES.map((m) => <Hotspot key={m.id} m={m} locked={rankIndex < m.minRank} selected={selected === m.id} onSelect={onSelect} />)}
      </Suspense>
      <OrbitControls ref={controls} makeDefault enablePan screenSpacePanning panSpeed={0.8} rotateSpeed={0.7} zoomSpeed={0.9} minDistance={1.2} maxDistance={26} enableDamping dampingFactor={0.08} autoRotate={!still && !selected} autoRotateSpeed={0.25} />
      <Rig selected={selected} controls={controls} />
    </Canvas>
  );
}

useGLTF.preload('/models/iss.glb');
