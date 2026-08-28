"use client";

import { LogIn } from "lucide-react";

interface LoginButtonProps {
  size?: "default" | "large" | "nav";
  label?: string;
}

export default function LoginButton({
  size = "default",
  label = "Employee Login",
}: LoginButtonProps) {
  const systemUrl =
    process.env.NEXT_PUBLIC_SYSTEM_URL || "http://localhost:8080";

  const sizeClasses = {
    default: "px-5 py-2.5 text-sm",
    large: "px-6 py-3 text-sm",
    nav: "px-2.5 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm",
  };

  return (
    <a
      href={`${systemUrl}/login`}
      className={`inline-flex items-center gap-1.5 lg:gap-2 rounded-md border border-brand-navy font-medium text-brand-navy hover:bg-brand-navy hover:text-white transition-colors whitespace-nowrap ${sizeClasses[size]}`}
    >
      <LogIn size={14} className="lg:hidden" />
      <LogIn size={16} className="hidden lg:inline" />
      {label}
    </a>
  );
}
