import Link from "next/link";
import Wordmark from "@/components/brand/Wordmark";

export default function FooterSection() {
  return (
    <footer className="relative z-10 border-t border-zinc-800/50 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="text-center md:text-left">
            <Link href="/" className="text-lg font-bold tracking-tight">
              <Wordmark />
            </Link>
            <p className="text-zinc-600 text-sm mt-1">
              Made for vibecoders. Powered by math.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign In
            </Link>
            <a
              href="https://github.com/vibariant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="mailto:support@vibariant.com"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Support
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800/30 text-center">
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} Vibariant. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
