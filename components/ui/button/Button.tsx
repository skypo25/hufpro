import React, { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline" | "ghost";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}) => {
  const sizeClasses = {
    sm: "px-4 py-2.5 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-3.5 text-[15px]",
  };

  const variantClasses = {
    primary:
      "bg-primary text-white border border-transparent shadow-sm hover:bg-primary-dark disabled:bg-primary disabled:opacity-50",
    outline:
      "bg-card text-foreground border border-border hover:bg-gray-50 hover:border-text-light",
    ghost:
      "bg-transparent text-text-secondary border border-transparent hover:bg-gray-50 hover:text-foreground",
  };

  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses[size],
        variantClasses[variant],
        className,
      ].join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      <span className="inline-flex items-center">{children}</span>
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;