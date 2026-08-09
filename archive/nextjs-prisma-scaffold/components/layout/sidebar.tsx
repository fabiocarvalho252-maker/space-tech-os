'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Ordens de Serviço', href: '/dashboard/service-orders' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 border-r border-white/10 bg-[#050816] p-6 text-white lg:block">
      <div className="text-2xl font-bold tracking-[0.3em] text-cyan-300">SPACE TECH</div>
      <nav className="mt-10 space-y-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-xl px-4 py-3 text-sm transition',
                active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
