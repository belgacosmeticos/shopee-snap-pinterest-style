import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

const CORRECT_PIN = '042721';
const SESSION_KEY = 'shopee_tools_auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface PinAuthProps {
  children: React.ReactNode;
}

export const PinAuth = ({ children }: PinAuthProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = () => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const { expiry } = JSON.parse(session);
      if (Date.now() < expiry) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin === CORRECT_PIN) {
      const session = {
        authenticated: true,
        expiry: Date.now() + SESSION_DURATION,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setIsAuthenticated(true);
      toast.success('Acesso liberado! Sessão válida por 3 horas.');
    } else {
      toast.error('PIN incorreto. Tente novamente.');
      setPin('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setPin('');
    toast.info('Sessão encerrada.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-soft flex items-center justify-center p-4">
        <Card className="w-full max-w-sm glass-card animate-slide-up">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">
              <span className="text-gradient">Acesso Restrito</span>
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Digite o PIN para acessar as ferramentas
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Digite o PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center text-xl tracking-widest"
                maxLength={6}
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={pin.length < 6}>
                <Unlock className="w-4 h-4 mr-2" />
                Acessar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
        title="Sair"
      >
        <Lock className="w-4 h-4 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
};
