import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PinterestTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  pinCount?: number;
  privacy?: string;
  imageUrl?: string | null;
}

const STORAGE_KEY = 'pinterest_tokens';

export const usePinterestAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);

  // Load tokens from localStorage
  const loadTokens = useCallback((): PinterestTokens | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const tokens: PinterestTokens = JSON.parse(stored);
      
      // Check if token is expired (with 5 min buffer)
      if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
        console.log('[usePinterestAuth] Token expired');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      
      return tokens;
    } catch {
      return null;
    }
  }, []);

  // Save tokens to localStorage
  const saveTokens = useCallback((accessToken: string, refreshToken?: string, expiresIn?: number) => {
    const tokens: PinterestTokens = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn || 3600) * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    setIsConnected(true);
    console.log('[usePinterestAuth] Tokens saved');
  }, []);

  // Handle OAuth callback from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    
    if (hash.includes('pinterest_access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('pinterest_access_token');
      const refreshToken = params.get('pinterest_refresh_token');
      const expiresIn = parseInt(params.get('pinterest_expires_in') || '3600', 10);
      
      if (accessToken) {
        saveTokens(accessToken, refreshToken || undefined, expiresIn);
        toast.success('Pinterest conectado com sucesso!');
        // Clean URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // Check for error
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('pinterest_error');
    if (error) {
      toast.error(`Erro ao conectar Pinterest: ${error}`);
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Check existing tokens
    const tokens = loadTokens();
    setIsConnected(!!tokens);
    setIsLoading(false);
  }, [loadTokens, saveTokens]);

  // Initiate OAuth flow
  const connect = async () => {
    try {
      setIsLoading(true);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${supabaseUrl}/functions/v1/pinterest-callback`;
      
      const { data, error } = await supabase.functions.invoke('pinterest-auth', {
        body: { redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Redirect to Pinterest
      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error('[usePinterestAuth] Connect error:', err);
      toast.error(err.message || 'Erro ao conectar com Pinterest');
      setIsLoading(false);
    }
  };

  // Connect with sandbox token (manual entry)
  const connectWithToken = (token: string) => {
    if (!token || !token.trim()) {
      toast.error('Token inválido');
      return false;
    }
    // Sandbox tokens typically last 30 days
    saveTokens(token.trim(), undefined, 30 * 24 * 60 * 60);
    toast.success('Pinterest conectado com token sandbox!');
    return true;
  };

  // Disconnect (clear tokens)
  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsConnected(false);
    setBoards([]);
    toast.success('Pinterest desconectado');
  };

  // Get access token
  const getAccessToken = useCallback((): string | null => {
    const tokens = loadTokens();
    return tokens?.accessToken || null;
  }, [loadTokens]);

  // Fetch boards
  const fetchBoards = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      toast.error('Pinterest não conectado');
      return [];
    }

    setIsLoadingBoards(true);
    try {
      const { data, error } = await supabase.functions.invoke('pinterest-boards', {
        body: { accessToken },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setBoards(data.boards || []);
      return data.boards || [];
    } catch (err: any) {
      console.error('[usePinterestAuth] Fetch boards error:', err);
      
      // If unauthorized, disconnect
      if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        disconnect();
        toast.error('Sessão expirada. Reconecte o Pinterest.');
      } else {
        toast.error(err.message || 'Erro ao carregar boards');
      }
      return [];
    } finally {
      setIsLoadingBoards(false);
    }
  };

  // Create pin
  const createPin = async (params: {
    boardId: string;
    title: string;
    description: string;
    link?: string;
    imageBase64: string;
  }) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('Pinterest não conectado');
    }

    const { data, error } = await supabase.functions.invoke('pinterest-create-pin', {
      body: {
        accessToken,
        ...params,
      },
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.pin;
  };

  return {
    isConnected,
    isLoading,
    boards,
    isLoadingBoards,
    connect,
    connectWithToken,
    disconnect,
    fetchBoards,
    createPin,
    getAccessToken,
  };
};
