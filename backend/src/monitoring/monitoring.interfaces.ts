export interface DatadogMonitorConfig {
  name: string;
  type: 'query alert' | 'service check' | 'metric alert';
  query: string;
  message: string;
  tags: string[];
  options: {
    notifyNoData: boolean;
    noDataTimeframe: number;
    evaluationDelay: number;
    thresholds: {
      critical: number;
      warning?: number;
    };
    includeTags: boolean;
  };
}

export interface ModerationQueueMetrics {
  pendingReports: number;
  pendingMoments: number;
  unprocessedFlags: number;
  oldestPendingMinutes: number;
}

export interface AdminActionMetrics {
  actionType: 'ban' | 'warn' | 'vip_change' | 'block_remove';
  count: number;
  timeWindowSeconds: number;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  totalReports: number;
  totalBlocks: number;
  errorRate: number;
  p95Latency: number;
  activeAdmins: number;
}