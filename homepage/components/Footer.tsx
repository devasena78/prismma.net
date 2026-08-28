import Link from "next/link";
import Image from "next/image";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Link2,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import type { NavPage, SiteInfo, SiteLink } from "@/lib/site-settings";

function socialIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("facebook")) return Facebook;
  if (l.includes("instagram")) return Instagram;
  if (l.includes("linkedin")) return Linkedin;
  if (l.includes("youtube")) return Youtube;
  if (l.includes("twitter") || l.includes("x.com") || l === "x") return Twitter;
  return Link2;
}

interface FooterProps {
  nav: NavPage[];
  siteInfo: SiteInfo;
  socialLinks: SiteLink[];
  footerLinks: SiteLink[];
}

export default function Footer({
  nav,
  siteInfo,
  socialLinks,
  footerLinks,
}: FooterProps) {
  const companyLinks = nav.map((p) => ({ href: `/${p.slug}`, label: p.label }));

  return (
    <footer className="relative bg-gradient-to-br from-[#1a1a8c] via-brand-navy to-black text-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <Image
            src="/assets/logos/prismma_white_transparent.png"
            alt="Prismma Express"
            width={170}
            height={28}
          />
          <p className="mt-5 text-sm text-white/60 max-w-xs">
            Reliable, cost-effective logistics solutions across air, sea, and
            land.
          </p>
          {socialLinks.length > 0 && (
            <div className="flex gap-5 mt-6">
              {socialLinks.map((l) => {
                const Icon = socialIcon(l.label);
                return (
                  <a
                    key={l.id}
                    href={l.url}
                    aria-label={l.label}
                    className="hover:text-brand-orange transition-colors"
                  >
                    <Icon size={22} />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-display font-semibold text-lg mb-4">Company</h4>
          <ul className="space-y-2 text-white/70">
            <li>
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
            </li>
            {companyLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {footerLinks.map((l) => (
              <li key={l.id}>
                <a href={l.url} className="hover:text-white transition-colors">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-lg mb-4">Services</h4>
          <ul className="space-y-2 text-white/70">
            <li>
              <Link
                href="/services#air-freight"
                className="hover:text-white transition-colors"
              >
                Air Freight
              </Link>
            </li>
            <li>
              <Link
                href="/services#sea-freight"
                className="hover:text-white transition-colors"
              >
                Sea Freight
              </Link>
            </li>
            <li>
              <Link
                href="/services#land-transport"
                className="hover:text-white transition-colors"
              >
                Land Transport
              </Link>
            </li>
            <li>
              <Link
                href="/services#warehouse-distribution"
                className="hover:text-white transition-colors"
              >
                Warehouse and Distribution
              </Link>
            </li>
            <li>
              <Link
                href="/services#customs-brokerage"
                className="hover:text-white transition-colors"
              >
                Customs Brokerage
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-lg mb-4">Contact</h4>
          <ul className="space-y-3 text-white/70">
            {siteInfo.address && (
              <li className="flex items-start gap-2">
                <MapPin size={18} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-line">{siteInfo.address}</span>
              </li>
            )}
            {siteInfo.phone && (
              <li className="flex items-start gap-2">
                <Phone size={18} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-line">{siteInfo.phone}</span>
              </li>
            )}
            {siteInfo.email && (
              <li className="flex items-center gap-2">
                <Mail size={18} className="shrink-0" />
                <span>{siteInfo.email}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10 py-6 text-sm text-white/50 flex flex-col sm:flex-row items-center justify-between gap-2 px-6">
        <p>
          Copyright {siteInfo.company_name || "Prismma Express Sdn Bhd"}{" "}
          (967851-D). All Rights Reserved.
        </p>
        <p className="text-xs text-white/30">
          System built by{" "}
          <a
            href="mailto:saillesh0323@gmail.com"
            className="hover:text-brand-orange transition-colors underline underline-offset-2"
          >
            Saillesh
          </a>
        </p>
      </div>
    </footer>
  );
}
