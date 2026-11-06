import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { logout } = useAuth();
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.check(),
    refetchInterval: 30_000,
    retry: 0,
  });

  const connected = !isError && Boolean(health);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{connected ? 'API Connected' : 'API Unavailable'}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
