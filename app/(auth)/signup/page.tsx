'use client';

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaFacebook } from "react-icons/fa";

export default function SignUp() {
  const providers = [
    { id: "facebook", name: "Facebook", icon: <FaFacebook className="absolute left-4 h-6 w-6 text-[#1877F2]" /> },
    { id: "google", name: "Google", icon: <FcGoogle className="absolute left-4 h-6 w-6" /> },
    { id: "github", name: "GitHub", icon: <FaGithub className="absolute left-4 h-6 w-6" /> },
  ];

  return (
    <main className="flex flex-col min-h-screen p-4">
      <div className="text-center">
        <Link
          href="/"
          className="text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity duration-300"
        >
          OpenLabel
        </Link>
      </div>
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-sm mx-auto text-center pb-24 lg:pb-44">
        <h1 className="text-3xl font-semibold mb-4 pt-8">Sign up</h1>
        <p className="text-lg mb-8">to create your OpenLabel account</p>
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => signIn(provider.id, { callbackUrl: "/" })}
            className="relative w-full flex items-center justify-center rounded-full border border-muted bg-transparent font-medium py-3 px-4 mb-4 hover:bg-muted transition-colors duration-300 ease-in-out"
          >
            {provider.icon}
            <span>Sign up with {provider.name}</span>
          </button>
        ))}
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium hover:text-foreground/80 transition-colors duration-300 ease-in-out">
            Log in
          </Link>
        </p>
      </div>
      <p className="text-xs text-muted-foreground text-center pt-14 pb-24 lg:pb-0">
        By signing up, you agree to our{" "}
        <Link href="/terms-of-service" className="text-foreground font-medium underline hover:text-foreground/80 transition-colors duration-300 ease-in-out">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="text-foreground font-medium underline hover:text-foreground/80 transition-colors duration-300 ease-in-out">
          Privacy Policy
        </Link>.
      </p>
    </main>
  );
}
