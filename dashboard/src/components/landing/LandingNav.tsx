"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import Wordmark from "@/components/brand/Wordmark";

export default function LandingNav() {
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          <Wordmark />
        </Link>

        {/* Nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Features
          </a>
          <a
            href="#demo"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Demo
          </a>
          <a
            href="#pricing"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Pricing
          </a>
        </div>

        {/* CTA */}
        <Link
          href={authed ? "/dashboard" : "/login"}
          className="bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-500 hover:to-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150"
        >
          {authed ? "Go to Dashboard" : "Start Free"}
        </Link>
      </div>
    </nav>
  );
}
