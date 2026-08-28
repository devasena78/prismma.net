"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Info,
  Package,
  Handshake,
  Newspaper,
  Mail,
  Route,
  Briefcase,
  Menu,
  X,
  LogIn,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import LoginButton from "./LoginButton";
import AnnouncementBanner from "./AnnouncementBanner";
import type { NavPage, Announcement } from "@/lib/site-settings";

const ICON_MAP: Record<string, typeof Info> = {
  about: Info,
  services: Package,
  "our-partners": Handshake,
  "track-shipment": Route,
  "latest-news": Newspaper,
  contact: Mail,
  careers: Briefcase,
};

const PRISMMAOS_URL = "https://prismmaos.onrender.com/login";

export default function Navbar({
  nav,
  announcement,
}: {
  nav: NavPage[];
  announcement: Announcement;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleSlugs = new Set(nav.map((p) => p.slug));
  const navLinks = nav
    .filter((p) => p.slug !== "get-a-quote" && p.slug !== "careers")
    .map((p) => ({
      href: `/${p.slug}`,
      label: p.label,
      icon: ICON_MAP[p.slug] || Info,
    }));
  const showGetAQuote = visibleSlugs.has("get-a-quote");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled || mobileOpen
          ? "bg-white/85 backdrop-blur-md shadow-sm"
          : "bg-white/65 backdrop-blur-md"
      }`}
    >
      {announcement.enabled && announcement.message && (
        <AnnouncementBanner message={announcement.message} />
      )}
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src="/assets/logos/prismma_main_logo.png"
            alt="Prismma Express"
            width={140}
            height={24}
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-3 lg:gap-6">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex items-center gap-1.5 text-xs lg:text-base text-body hover:text-brand-navy transition-colors whitespace-nowrap group"
              >
                <Icon
                  size={14}
                  className="opacity-60 group-hover:opacity-100 transition-opacity hidden lg:inline"
                />
                {link.label}
                <span className="absolute -bottom-2 left-0 w-0 h-px bg-brand-orange transition-all group-hover:w-full" />
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-1.5 lg:gap-3 shrink-0">
          {showGetAQuote && (
            <Link
              href="/get-a-quote"
              className="rounded-md bg-brand-orange px-2.5 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium text-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Get a Quote
            </Link>
          )}
          <LoginButton label="Internal Portal" size="default" />
          <Link
            href={PRISMMAOS_URL}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand-navy px-2.5 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium text-brand-navy hover:bg-brand-navy hover:text-white transition-colors whitespace-nowrap"
          >
            <LogIn size={14} />
            PrismmaOS
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-md text-brand-navy shrink-0"
        >
          {mobileOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      <div className="h-0.5 w-full bg-gradient-to-r from-brand-orange via-brand-orange/40 to-brand-navy/60" />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden bg-white border-t border-black/5 shadow-lg"
          >
            <nav className="flex flex-col px-6 py-4">
              {navLinks.map((link, i) => {
                const Icon = link.icon;
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 py-3.5 text-base text-brand-navy border-b border-black/5 last:border-b-0"
                    >
                      <Icon size={18} className="text-brand-orange" />
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
              <div className="pt-4 space-y-3">
                {showGetAQuote && (
                  <Link
                    href="/get-a-quote"
                    onClick={() => setMobileOpen(false)}
                    className="block text-center rounded-md bg-brand-orange px-5 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    Get a Quote
                  </Link>
                )}
                <LoginButton label="Internal Portal" />
                <Link
                  href={PRISMMAOS_URL}
                  className="flex items-center justify-center gap-2 rounded-md border border-brand-navy px-5 py-2.5 text-sm font-medium text-brand-navy"
                >
                  <LogIn size={16} />
                  PrismmaOS
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
