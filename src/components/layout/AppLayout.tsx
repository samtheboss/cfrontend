import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const handleToggle = () => {
    setIsCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isCollapsed ? "pl-16" : "pl-64"
      )}>
        <Header title={title} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
