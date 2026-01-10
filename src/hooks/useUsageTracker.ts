import { useState, useCallback, useEffect } from 'react';

export type ToolType = 'pingen' | 'videogen' | 'soragen' | 'videominer';
export type CostType = 'lovable_ai' | 'firecrawl';

export interface UsageRecord {
  id: string;
  tool: ToolType;
  action: string;
  costType: CostType;
  estimatedCost: number;
  timestamp: string;
  success: boolean;
}

export interface UsageStats {
  totalCost: number;
  totalOperations: number;
  byType: {
    lovable_ai: { cost: number; count: number };
    firecrawl: { cost: number; count: number };
  };
  byTool: {
    pingen: { cost: number; count: number };
    videogen: { cost: number; count: number };
    soragen: { cost: number; count: number };
    videominer: { cost: number; count: number };
  };
}

const STORAGE_KEY = 'content_tools_usage_history';

// Estimated costs per operation
export const COST_ESTIMATES = {
  pingen_image: 0.015,      // Lovable AI image generation
  pingen_caption: 0.001,    // Lovable AI text (gemini flash)
  videogen_extract: 0.005,  // Firecrawl scrape
  videogen_caption: 0.001,  // Lovable AI text
  soragen_extract: 0.005,   // Firecrawl scrape
  videominer_mine: 0.02,    // Firecrawl (multiple scrapes)
};

export const useUsageTracker = () => {
  const [history, setHistory] = useState<UsageRecord[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading usage history:', err);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((records: UsageRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      setHistory(records);
    } catch (err) {
      console.error('Error saving usage history:', err);
    }
  }, []);

  const trackUsage = useCallback((record: Omit<UsageRecord, 'id' | 'timestamp'>) => {
    const newRecord: UsageRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    setHistory(prev => {
      const updated = [newRecord, ...prev].slice(0, 500); // Keep last 500 records
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getUsageStats = useCallback((days: number = 7): UsageStats => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredRecords = history.filter(
      record => new Date(record.timestamp) >= cutoffDate && record.success
    );

    const stats: UsageStats = {
      totalCost: 0,
      totalOperations: 0,
      byType: {
        lovable_ai: { cost: 0, count: 0 },
        firecrawl: { cost: 0, count: 0 },
      },
      byTool: {
        pingen: { cost: 0, count: 0 },
        videogen: { cost: 0, count: 0 },
        soragen: { cost: 0, count: 0 },
        videominer: { cost: 0, count: 0 },
      },
    };

    for (const record of filteredRecords) {
      stats.totalCost += record.estimatedCost;
      stats.totalOperations += 1;
      stats.byType[record.costType].cost += record.estimatedCost;
      stats.byType[record.costType].count += 1;
      stats.byTool[record.tool].cost += record.estimatedCost;
      stats.byTool[record.tool].count += 1;
    }

    return stats;
  }, [history]);

  const getUsageHistory = useCallback((limit: number = 20): UsageRecord[] => {
    return history.slice(0, limit);
  }, [history]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return {
    trackUsage,
    getUsageStats,
    getUsageHistory,
    clearHistory,
    history,
  };
};
