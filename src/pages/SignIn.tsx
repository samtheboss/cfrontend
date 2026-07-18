import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Boxes, Lock, User, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, setBaseUrl, clearBaseUrl } from '@/lib/api';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Secret server panel — triggered by tapping the logo 5 times quickly
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(getBaseUrl);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleLogoTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      setServerUrl(getBaseUrl()); // refresh displayed value
      setShowServer(true);
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    }
  };

  const handleSaveServer = () => {
    if (!serverUrl.trim()) return;
    setBaseUrl(serverUrl.trim());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleResetServer = () => {
    clearBaseUrl();
    setServerUrl(getBaseUrl());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(username, password);

      if (success) {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });
        navigate('/');
      } else {
        toast({
          title: 'Sign in failed',
          description: 'Invalid username or password.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Failed to connect to the authentication server.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo — tap 5× quickly to open hidden server settings */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary cursor-default select-none"
            onClick={handleLogoTap}
            role="presentation"
          >
            <Boxes className="h-7 w-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">StockFlow</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Hidden server settings panel — only shown after 5-tap on logo */}
        {showServer && (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                Server Configuration
              </span>
              <button
                type="button"
                onClick={() => setShowServer(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-muted"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="serverUrl" className="text-xs">Backend URL</Label>
                <Input
                  id="serverUrl"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:9090"
                  className="font-mono text-sm"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Currently active: <span className="font-mono">{getBaseUrl()}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveServer}
                  disabled={savedFlash}
                  className="gap-1.5"
                >
                  {savedFlash ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Saved!</>
                  ) : (
                    'Save & Apply'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetServer}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Default
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
