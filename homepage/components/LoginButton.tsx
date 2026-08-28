"use client";

import { LogIn } from "lucide-react";

interface LoginButtonProps {
  size?: "default" | "large";
  label?: string;
  fullWidth?: boolean;
}

export default function LoginButton({
  size = "default",
  label = "Employee Login",
  fullWidth = false,
}: LoginButtonProps) {
  const systemUrl =
    process.env.NEXT_PUBLIC_SYSTEM_URL || "http://localhost:8080";
  const isLarge = size === "large";

  return (
    <a
      href={`${systemUrl}/login`}
      className={`${
        fullWidth ? "flex" : "inline-flex"
      } items-center justify-center gap-2 rounded-md border border-brand-navy font-medium text-brand-navy hover:bg-brand-navy hover:text-white transition-colors whitespace-nowrap ${
        isLarge ? "px-6 py-3 text-sm" : "px-4 py-2 text-sm"
      }`}
    >
      <LogIn size={16} />
      {label}
    </a>
  );
}
