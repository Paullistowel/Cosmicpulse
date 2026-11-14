import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="t-overline text-ink-3">404 · Signal lost</p>
      <h1 className="t-title1">This page drifted out of orbit</h1>
      <Link href="/" className="inline-flex h-11 items-center rounded-full bg-pill px-5 text-sm font-medium text-on-pill">Back to dashboard</Link>
    </div>
  );
}
