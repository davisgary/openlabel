import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col text-center">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-start flex-grow py-52">
        <h1 className="text-primary/80 font-bold">Oops!</h1>
        <h2 className="p-6 font-extrabold tracking-tight text-5xl">404 - Page Not Found</h2>
        <p className="pb-6">It looks like you've stumbled upon a page that doesn't exist.</p>
        <Link href="/" className="rounded-sm bg-primary font-medium tracking-wide px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors duration-300 ease-in-out">
          Go Back Home
        </Link>
      </div>
    </div>
  );
}