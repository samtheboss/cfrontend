import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, User, LogOut, Settings, Grid, Sun, Moon, Laptop, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export function Header({ title }: HeaderProps) {
  const { user, logout, getGroupById } = useAuth();
  const { locations } = useInventory();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-10 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-3">
        {!isHome && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-9 px-2 rounded-lg"
          >
            <Grid className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline text-xs font-semibold">Main Menu</span>
          </Button>
        )}
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate max-w-[150px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9" title="Theme Mode">
              {resolvedTheme === 'dark' ? (
                <Moon className="h-4 w-4 text-amber-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-600" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs font-semibold">Theme Mode</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setThemeMode('light')} className="cursor-pointer text-xs">
              <Sun className="h-3.5 w-3.5 mr-2 text-amber-500" />
              <span>Light</span>
              {themeMode === 'light' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setThemeMode('dark')} className="cursor-pointer text-xs">
              <Moon className="h-3.5 w-3.5 mr-2 text-blue-400" />
              <span>Dark</span>
              {themeMode === 'dark' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setThemeMode('system')} className="cursor-pointer text-xs">
              <Laptop className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <span>System</span>
              {themeMode === 'system' && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer text-xs text-muted-foreground">
              <Palette className="h-3.5 w-3.5 mr-2 text-primary" />
              <span>Theme & Colors...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute 1 top-1.5 right-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-destructive" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span>{user?.name}</span>
                <div className="flex items-center gap-2">
                  {user && (
                    <Badge variant="secondary" className="text-xs">
                      {getGroupById(user.groupId)?.name || 'Unknown'}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">@{user?.username}</span>
                </div>
                {user?.locationId && (
                  <div className="text-xs text-muted-foreground mt-1">
                    📍 {user.locationId === 'all' ? 'All Locations' : locations.find(l => l.id.toString() === String(user.locationId))?.name || 'Unknown Location'}
                  </div>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/users')}>
              <User className="h-4 w-4 mr-2" />
              Profile & Rights
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
