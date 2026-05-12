"use client";

import Link from "next/link";
import { LuChevronRight, LuCircleHelp } from "react-icons/lu";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Account from "./Account";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isHowPage = pathname === "/how-it-works";

  return (
    <>
      <header className="bg-transparent">
        <nav className="p-4" aria-label="Primary Navigation">
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between md:px-8">
            {/* left: brand/link */}
            <div>
              <Link href="/" className="dark:text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity duration-300">
                Open Label
              </Link>
            </div>

            {/* right: account actions */}
            <div className="flex items-center gap-1">
              {session?.user ? (
                <Account />
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-full bg-transparent text-sm font-medium px-4 py-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-300 ease-in-out"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="flex items-center gap-1 rounded-full text-sm font-medium px-4 py-2 bg-primary-foreground text-primary hover:opacity-90 transition-colors duration-300 ease-in-out"
                  >
                    Sign up <LuChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}