import { SpaceBackdrop } from '@/components/brand/backdrop';
import { Providers } from '@/components/shell/providers';

/** Full-screen immersive experiences (onboarding) — no app chrome. */
export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <SpaceBackdrop />
      {children}
    </Providers>
  );
}
