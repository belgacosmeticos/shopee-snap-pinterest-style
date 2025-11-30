import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error caught:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen gradient-soft flex items-center justify-center p-4">
          <Card className="p-8 max-w-md text-center shadow-card">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ops! Algo deu errado</h2>
            <p className="text-muted-foreground mb-4">
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </p>
            {this.state.error && (
              <details className="text-left mb-4 p-3 bg-muted rounded-lg text-sm">
                <summary className="cursor-pointer text-muted-foreground">Detalhes do erro</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-32 text-destructive">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="space-y-2">
              <Button onClick={this.handleGoHome} variant="gradient" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Voltar ao início
              </Button>
              <Button onClick={this.handleReset} variant="outline" className="w-full">
                Recarregar página
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
