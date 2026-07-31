import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--foreground)]/80 block relative z-[1]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={[
            "glass-input",
            "flex h-10 w-full px-4 py-2 text-sm",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "disabled:cursor-not-allowed disabled:opacity-[0.35]",
            error && "!border-red-500/30 !shadow-[0_0_0_2px_rgba(239,68,68,0.15)]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && <p className="text-xs text-red-400 relative z-[1]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
