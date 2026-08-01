import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-accent-soft to-accent text-white shadow-[0_4px_20px_-4px_rgba(10,132,255,0.5)] hover:brightness-110',
  secondary:
    'bg-white/[0.07] text-zinc-200 border border-white/10 hover:bg-white/[0.12] hover:text-white',
  ghost: 'text-zinc-400 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25',
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-4 py-2.5 text-sm rounded-2xl',
  lg: 'px-6 py-3 text-base rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-smooth active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
