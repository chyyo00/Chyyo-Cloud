import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <RadixDialog.Content asChild className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 outline-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className={cn('glass-strong p-6', className)}
          >
            <div className="flex items-start justify-between">
              <div>
                {title && (
                  <RadixDialog.Title className="text-lg font-semibold text-white">{title}</RadixDialog.Title>
                )}
                {description && (
                  <RadixDialog.Description className="mt-1 text-sm text-zinc-400">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close asChild>
                <button className="rounded-xl p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
