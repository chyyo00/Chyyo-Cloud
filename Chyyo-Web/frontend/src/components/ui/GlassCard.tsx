import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface GlassCardProps {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ className, children, hover, onClick }: GlassCardProps) {
  const Comp = hover || onClick ? motion.div : 'div' as any;
  const props = hover
    ? { whileHover: { y: -3 }, transition: { type: 'spring', stiffness: 300, damping: 22 } }
    : {};
  return (
    <Comp
      onClick={onClick}
      className={cn('glass', hover && 'glass-hover', onClick && 'cursor-pointer', className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
