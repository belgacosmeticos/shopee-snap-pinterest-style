import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

// Pinterest SVG icon
const PinterestIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

export type PublishMode = 'manual' | 'pinterest';

interface PinterestModeToggleProps {
  mode: PublishMode;
  onModeChange: (mode: PublishMode) => void;
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const PinterestModeToggle = ({
  mode,
  onModeChange,
  isConnected,
  isLoading,
  onConnect,
  onDisconnect,
}: PinterestModeToggleProps) => {
  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('manual')}
          className="flex-1"
        >
          Manual
        </Button>
        <Button
          type="button"
          variant={mode === 'pinterest' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('pinterest')}
          className="flex-1 gap-2"
        >
          <PinterestIcon className="w-4 h-4 fill-current" />
          Pinterest API
        </Button>
      </div>

      {/* Pinterest Connection Status */}
      {mode === 'pinterest' && (
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando conexão...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Pinterest conectado</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
                className="text-muted-foreground hover:text-destructive"
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta do Pinterest para publicar pins diretamente.
              </p>
              <Button
                type="button"
                variant="pinterest"
                size="sm"
                onClick={onConnect}
                className="w-full gap-2"
              >
                <PinterestIcon className="w-4 h-4 fill-current" />
                Conectar Pinterest
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
