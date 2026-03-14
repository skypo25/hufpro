import Link from "next/link";
import type { ReactNode } from "react";
import Button from "./button/Button";

type ActionButtonProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function ActionButton({
  href,
  children,
  icon,
  variant = "outline",
  size = "md",
  className = "",
}: ActionButtonProps) {
  return (
    <Link href={href} className="inline-flex">
      <Button
        variant={variant}
        size={size}
        startIcon={icon}
        className={className}
      >
        {children}
      </Button>
    </Link>
  );
}