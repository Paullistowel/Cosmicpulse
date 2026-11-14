import { Suspense } from 'react';

import { LaunchExperience } from './launch';

export const metadata = { title: 'Launch' };

/** Chapter 1 — interactive launch pad (the NASA mission film is available inside as an extra). */
export default function IntroPage() {
  return (
    <Suspense fallback={<main className="fixed inset-0 bg-[#020409]" />}>
      <LaunchExperience />
    </Suspense>
  );
}
