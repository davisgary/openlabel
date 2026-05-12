"use client";

import Link from 'next/link';
import { LuBarcode } from 'react-icons/lu';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname() || '/';

  const linkClass = (
    href: string,
    defaultClass = 'text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors duration-300 ease-out',
  ) => {
  const baseTouch = 'inline-flex items-center justify-center px-2 py-1 min-h-[44px] rounded-md';
    const isActive = pathname === href;
    return isActive
      ? `${baseTouch} text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-300 ease-out`
      : `${baseTouch} ${defaultClass}`;
  };

  return (
    <footer className="w-full px-4 mt-4">
    <Link
        href="/"
        className="font-medium text-primary-foreground hover:text-primary-foreground/70 text-center pb-1 block transition-colors duration-300 ease-out"
        aria-label="Open Label"
    >
      <LuBarcode className="w-10 h-10 mx-auto" />
    </Link>

      {/* Links row: first link, then How it works (per request), then other policy links */}
      <div className="flex items-center justify-center gap-2 pb-2 font-medium">
        <Link href="/" className={linkClass('/')}>Home</Link>
        <Link href="/how-it-works" className={linkClass('/how-it-works')}>How it works</Link>
        <Link href="/privacy-policy" className={linkClass('/privacy-policy')}>Privacy policy</Link>
        <Link href="/terms-of-service" className={linkClass('/terms-of-service')}>Terms</Link>
      </div>

      <p className="text-xs text-muted-foreground/70 font-medium text-center pb-2">All results are for educational purposes only and should not be considered medical advice.</p>
      <p className="text-xs text-muted-foreground/70 font-medium text-center pb-4">© {new Date().getFullYear()} All rights reserved.</p>
    </footer>
  );
}