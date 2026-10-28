import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export function Header({ title }: HeaderProps) {
  const { user, logout, getGroupById, getUserRights } = useAuth();
  const { locations } = useInventory();
  const { themeMode, resolvedTheme, setThemeMode, primaryColor, setPrimaryColor, colorPresets } = useTheme();
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const rights = user ? getUserRights(user) : null;
  const canViewSettings = !rights || rights.viewSettings !== 'no';

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
            <DropdownMenuItem onClick={() => setThemeDialogOpen(true)} className="cursor-pointer text-xs text-muted-foreground">
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
            {canViewSettings && (
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Theme & Colors Dialog — Open for any user without exposing Settings */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" />
              Theme & Colors
            </DialogTitle>
            <DialogDescription className="text-xs">
              Personalize your workspace appearance and color theme.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold mb-2 block">Display Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
                  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Low-light friendly' },
                  { id: 'system', label: 'System', icon: Laptop, desc: 'Follows OS' },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = themeMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setThemeMode(item.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        active
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mb-1 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Accent Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {colorPresets.map((preset) => {
                  const active = primaryColor === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPrimaryColor(preset.id)}
                      className={`flex flex-col items-center p-2 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full mb-1 shadow-sm flex items-center justify-center border border-black/10"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {active && <Check className="h-3 w-3 text-white drop-shadow" />}
                      </div>
                      <span className="text-[10px] font-medium text-foreground text-center truncate w-full">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
