import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export const Tabs = RadixTabs.Root;
export const TabsList = RadixTabs.List;
export const TabsTrigger = RadixTabs.Trigger;
export const TabsContent = RadixTabs.Content;

export function TabNav({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange}>
      <RadixTabs.List className="flex gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 outline-none transition-all duration-200',
              'hover:text-white data-[state=active]:bg-white/[0.08] data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.6)]'
            )}
          >
            {t.icon}
            {t.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
