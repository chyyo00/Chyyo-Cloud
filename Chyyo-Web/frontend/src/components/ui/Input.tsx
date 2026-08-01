import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('input-apple', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn('input-apple font-mono leading-relaxed', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent/60 focus:shadow-[0_0_0_4px_rgba(10,132,255,0.15)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
