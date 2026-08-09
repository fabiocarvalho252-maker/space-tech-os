'use client';

import { useSession, signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'US';
  const parts = source.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1020] px-4 py-4 text-white sm:px-6">
      <div>
        <p className="text-sm text-slate-400">Bem-vindo de volta</p>
        <h1 className="text-lg font-semibold sm:text-xl">{user?.name || 'SPACE TECH OS'}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 sm:flex">
          <Avatar className="size-6">
            <AvatarFallback className="bg-cyan-400/20 text-xs text-cyan-300">
              {initials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          {user?.email}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut />
          Sair
        </Button>
      </div>
    </header>
  );
}
