'use client';

import { Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * The CosmicPulse universe — a stylised, cartoon-inspired 3D scene for the mission hub:
 * a procedural toon-shaded planet with drifting clouds and a glowing atmosphere, a Moon,
 * and the crew's station on a visible orbit. Everything is generated in shaders and
 * primitives (no downloads, works offline). Reduced motion renders one still frame.
 */

// Ashima Arts 3D simplex noise (MIT) + fbm.
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}return f;}
`;

export const SUN = new THREE.Vector3(-0.6, 0.35, 0.72).normalize();

const planetVert = /* glsl */ `
varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
void main(){ vPos=position; vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;

const planetFrag = /* glsl */ `
${NOISE}
uniform vec3 uSun; varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
void main(){
  vec3 p=normalize(vPos);
  float h=fbm(p*1.6)+0.25*fbm(p*5.0);
  float lat=abs(p.y);
  vec3 deep=vec3(0.04,0.20,0.55), shallow=vec3(0.10,0.55,0.85);
  vec3 col=mix(deep,shallow,smoothstep(-0.25,0.05,h));
  float land=smoothstep(0.06,0.10,h);
  vec3 grass=vec3(0.24,0.70,0.42), forest=vec3(0.10,0.45,0.32), sand=vec3(0.93,0.80,0.52), rock=vec3(0.62,0.52,0.45);
  vec3 ground=mix(sand,grass,smoothstep(0.10,0.16,h)); ground=mix(ground,forest,smoothstep(0.22,0.34,h)); ground=mix(ground,rock,smoothstep(0.42,0.55,h));
  col=mix(col,ground,land);
  col=mix(col,vec3(0.95,0.98,1.0),smoothstep(0.78,0.86,lat+0.08*h));
  // toon lighting: three soft bands + rim
  float d=dot(normalize(vNormal),normalize(uSun));
  float band=smoothstep(-0.15,-0.05,d)*0.45+smoothstep(0.25,0.35,d)*0.35+0.2;
  vec3 night=vec3(0.03,0.05,0.14);
  vec3 lit=mix(night,col,band);
  // city lights on the night side
  float city=smoothstep(0.55,0.75,snoise(p*28.0))*land*smoothstep(0.0,-0.25,d);
  lit+=vec3(1.0,0.78,0.4)*city*0.9;
  float rim=pow(1.0-max(dot(vNormal,vView),0.0),3.0);
  lit+=vec3(0.35,0.75,1.0)*rim*0.55;
  gl_FragColor=vec4(lit,1.0);
}`;

const cloudFrag = /* glsl */ `
${NOISE}
uniform vec3 uSun; uniform float uTime; varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
void main(){
  vec3 p=normalize(vPos);
  float c=fbm(p*2.4+vec3(uTime*0.01,0.0,uTime*0.006));
  float a=smoothstep(0.12,0.38,c)*0.85;
  float d=dot(normalize(vNormal),normalize(uSun));
  float light=smoothstep(-0.2,0.3,d)*0.85+0.15;
  gl_FragColor=vec4(vec3(1.0)*light,a*smoothstep(-0.35,0.0,d+0.3));
}`;

const atmoFrag = /* glsl */ `
uniform vec3 uSun; varying vec3 vNormal; varying vec3 vView;
void main(){
  float f=pow(1.0-abs(dot(vNormal,vView)),2.2);
  float d=dot(normalize(vNormal),normalize(uSun))*0.5+0.5;
  vec3 col=mix(vec3(0.45,0.35,1.0),vec3(0.35,0.85,1.0),d);
  gl_FragColor=vec4(col,f*(0.35+0.65*d));
}`;

export function Planet({ still, onPick }: { still: boolean; onPick?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uSun: { value: SUN.clone() }, uTime: { value: 0 } }), []);
  // Shader uniforms are updated imperatively every frame by design.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, dt) => {
    if (still) return;
    if (group.current) group.current.rotation.y += dt * 0.035;
    if (clouds.current) clouds.current.rotation.y += dt * 0.012;
    uniforms.uTime.value += dt;
  });
  /* eslint-enable react-hooks/immutability */
  return (
    <group rotation={[0.25, 0, 0.12]}>
      <group ref={group}>
        <mesh onClick={onPick ? (e) => { e.stopPropagation(); onPick(); } : undefined} onPointerOver={onPick ? () => (document.body.style.cursor = 'pointer') : undefined} onPointerOut={onPick ? () => (document.body.style.cursor = '') : undefined}>
          <sphereGeometry args={[1.6, 128, 128]} />
          <shaderMaterial vertexShader={planetVert} fragmentShader={planetFrag} uniforms={uniforms} />
        </mesh>
      </group>
      <mesh ref={clouds} scale={1.025}>
        <sphereGeometry args={[1.6, 96, 96]} />
        <shaderMaterial vertexShader={planetVert} fragmentShader={cloudFrag} uniforms={uniforms} transparent depthWrite={false} />
      </mesh>
      <mesh scale={1.16}>
        <sphereGeometry args={[1.6, 64, 64]} />
        <shaderMaterial vertexShader={planetVert} fragmentShader={atmoFrag} uniforms={uniforms} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function Moon({ still, onPick }: { still: boolean; onPick?: () => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (still || !ref.current) return;
    const t = clock.elapsedTime * 0.05 + 2.2;
    ref.current.position.set(Math.cos(t) * 4.6, 1.3 + Math.sin(t) * 0.4, Math.sin(t) * -2.2 - 1);
  });
  return (
    <group ref={ref} position={[3.9, 1.5, -2]}>
      <mesh onClick={onPick ? (e) => { e.stopPropagation(); onPick(); } : undefined} onPointerOver={onPick ? () => (document.body.style.cursor = 'pointer') : undefined} onPointerOut={onPick ? () => (document.body.style.cursor = '') : undefined}>
        <sphereGeometry args={[0.32, 48, 48]} />
        <meshStandardMaterial color="#D7D3E6" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

/** Cartoon-styled crew station: truss, modules, solar wings and a blinking beacon. */
function Station() {
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.opacity = 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 4) > 0.6 ? 1 : 0);
  });
  const panel = <meshStandardMaterial color="#2F6BFF" emissive="#2140A8" emissiveIntensity={0.5} metalness={0.4} roughness={0.35} />;
  return (
    <group scale={0.11}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 6.4, 12]} /><meshStandardMaterial color="#C9D3E0" metalness={0.6} roughness={0.35} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.6, 0, 0]}>
          <mesh position={[0, 1.15, 0]}><boxGeometry args={[1.5, 1.9, 0.05]} />{panel}</mesh>
          <mesh position={[0, -1.15, 0]}><boxGeometry args={[1.5, 1.9, 0.05]} />{panel}</mesh>
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.45, 0.45, 2.2, 20]} /><meshStandardMaterial color="#F4F6FA" metalness={0.2} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 1.3]}><sphereGeometry args={[0.5, 20, 20]} /><meshStandardMaterial color="#E6EBF3" roughness={0.4} /></mesh>
      <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.35, 0.35, 1.2, 16]} /><meshStandardMaterial color="#FFD27A" metalness={0.5} roughness={0.3} /></mesh>
      <mesh position={[0, 0.6, 0]}><sphereGeometry args={[0.12, 10, 10]} /><meshBasicMaterial ref={beacon} color="#62D2E6" transparent /></mesh>
    </group>
  );
}

export function Orbit({ still, onPick }: { still: boolean; onPick?: () => void }) {
  const craft = useRef<THREE.Group>(null);
  const r = 2.35;
  const line = useMemo(() => {
    const pts = Array.from({ length: 181 }, (_, i) => {
      const a = (i / 180) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    });
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#7CC8F2', dashSize: 0.08, gapSize: 0.08, transparent: true, opacity: 0.55 }));
    l.computeLineDistances();
    return l;
  }, []);
  useFrame(({ clock }) => {
    if (!craft.current) return;
    const a = still ? 0.9 : clock.elapsedTime * 0.18 + 0.9;
    craft.current.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    craft.current.rotation.y = -a;
  });
  return (
    <group rotation={[0.42, 0, -0.18]}>
      <primitive object={line} />
      <group ref={craft} onClick={onPick ? (e) => { e.stopPropagation(); onPick(); } : undefined} onPointerOver={onPick ? () => (document.body.style.cursor = 'pointer') : undefined} onPointerOut={onPick ? () => (document.body.style.cursor = '') : undefined}>
        <Station />
        {/* larger invisible hit area so the small station is easy to tap */}
        {onPick && <mesh visible={false}><sphereGeometry args={[0.45, 8, 8]} /></mesh>}
      </group>
    </group>
  );
}

export function Nebula() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <group position={[0, 0, -12]}>
      {([[-7, 3, 14, '#6B4BFF', 0.35], [8, -2, 16, '#1FA3D6', 0.3], [2, 5, 10, '#C04BFF', 0.18]] as const).map(([x, y, s, c, o], i) => (
        <sprite key={i} position={[x, y, 0]} scale={[s, s, 1]}>
          <spriteMaterial map={tex} color={c} transparent opacity={o} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

/** Wide screens: planet to the right of the text. Portrait phones: smaller, tucked top-right. */
function PlanetSystem({ still }: { still: boolean }) {
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height));
  const portrait = aspect < 1;
  return (
    <group position={portrait ? [0.9, 1.9, -1] : [1.15, 0.45, 0]} scale={portrait ? 0.62 : 0.92}>
      <Planet still={still} />
      <Orbit still={still} />
    </group>
  );
}

export default function HubScene({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.4, 6.2], fov: 40 }} dpr={[1, 1.75]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.35} />
      <directionalLight position={[SUN.x * 10, SUN.y * 10, SUN.z * 10]} intensity={2.2} color="#FFF3E2" />
      <pointLight position={[4, -2, 3]} intensity={6} color="#A99BFF" />
      <Nebula />
      <Stars radius={50} depth={30} count={2200} factor={3.2} fade speed={reducedMotion ? 0 : 0.8} />
      <PlanetSystem still={reducedMotion} />
      <Moon still={reducedMotion} />
    </Canvas>
  );
}
