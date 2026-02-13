import { useState, useEffect, useRef, useCallback } from 'react';
import { SeedanceInputStep } from './steps/SeedanceInputStep';
import { SeedanceResultStep } from './steps/SeedanceResultStep';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'input' | 'generating' | 'result';

const MAX_TIMEOUT_MS = 180_000; // 3 minutes
const POLL_INTERVAL_MS = 5_000;

export const SeedanceTool = () => {
  const [step, setStep] = useState<Step>('input');
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollTask = useCallback(async (taskId: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('seedance-query', {
        body: { taskId },
      });

      if (fnError) throw fnError;

      const elapsed = Date.now() - startTimeRef.current;

      if (data.status === 'completed' && data.videoUrl) {
        stopPolling();
        setVideoUrl(data.videoUrl);
        setProgress(100);
        setStep('result');
        toast.success('Vídeo gerado com sucesso!');
        return;
      }

      if (data.status === 'failed') {
        stopPolling();
        setError(data.error || 'A geração do vídeo falhou.');
        setStep('input');
        toast.error('Falha na geração do vídeo');
        return;
      }

      if (elapsed >= MAX_TIMEOUT_MS) {
        stopPolling();
        setError('Timeout: a geração demorou mais de 3 minutos.');
        setStep('input');
        toast.error('Timeout na geração do vídeo');
        return;
      }

      // Update progress
      const progressPct = Math.min(90, (elapsed / MAX_TIMEOUT_MS) * 90);
      setProgress(progressPct);
      setStatus(data.status === 'processing' ? 'Processando vídeo...' : 'Na fila...');
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [stopPolling]);

  const handleGenerate = async (data: {
    prompt: string;
    mediaFiles: string[];
    aspectRatio: string;
    duration: number;
    mode: string;
  }) => {
    setStep('generating');
    setError('');
    setProgress(5);
    setStatus('Criando task...');
    startTimeRef.current = Date.now();

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('seedance-create', {
        body: {
          prompt: data.prompt,
          mediaFiles: data.mediaFiles.length > 0 ? data.mediaFiles : undefined,
          aspectRatio: data.aspectRatio,
          duration: data.duration,
          mode: data.mode,
        },
      });

      if (fnError) throw fnError;
      if (result.error) throw new Error(result.error);

      const taskId = result.taskId;
      if (!taskId) throw new Error('Nenhum task_id retornado');

      setStatus('Na fila...');
      setProgress(10);

      pollingRef.current = setInterval(() => pollTask(taskId), POLL_INTERVAL_MS);
    } catch (err) {
      console.error('Generate error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar task');
      setStep('input');
      toast.error('Erro ao iniciar geração');
    }
  };

  const handleReset = () => {
    stopPolling();
    setStep('input');
    setVideoUrl('');
    setProgress(0);
    setStatus('');
    setError('');
  };

  if (step === 'generating') {
    return (
      <Card className="glass-card border-0 shadow-soft">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold mb-1">Gerando Vídeo</h2>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            Isso pode levar até 3 minutos...
          </p>
          <Button variant="outline" onClick={handleReset} className="w-full">
            Cancelar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'result') {
    return <SeedanceResultStep videoUrl={videoUrl} onReset={handleReset} />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <SeedanceInputStep onGenerate={handleGenerate} isLoading={false} />
    </div>
  );
};
