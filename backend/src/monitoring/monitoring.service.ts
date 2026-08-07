import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { client, v1 } from '@datadog/datadog-api-client';
import { Counter, Gauge, Registry } from 'prom-client';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DatadogMonitorConfig,
  ModerationQueueMetrics,
  AdminActionMetrics,
  AdminDashboardMetrics,
} from './monitoring.interfaces';

interface MonitorSummary { name: string; id: number }

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly apiInstance: v1.MonitorsApi | null = null;
  private readonly enabled: boolean;
  private readonly monitorPrefix = '[HelloTalk] Admin - ';
  private readonly register: Registry;

  private readonly actionCounter: Counter<string>;
  private readonly loginHistoryCounter: Counter<string>;
  private readonly pendingReportsGauge: Gauge<string>;
  private readonly totalUsersGauge: Gauge<string>;
  private readonly totalReportsGauge: Gauge<string>;
  private readonly totalBlocksGauge: Gauge<string>;

  private readonly adminAlerts: DatadogMonitorConfig[] = [
    {
      name: `${this.monitorPrefix}High Error Rate`,
      type: 'query alert',
      query:
        'sum(last_5m):sum:trace.servlet.request.errors{service:hellotalk-backend,resource_name:admin.*}.as_count() / sum:trace.servlet.request.hits{service:hellotalk-backend,resource_name:admin.*}.as_count() * 100 > 5',
      message:
        'Admin dashboard error rate has exceeded 5%. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:high'],
      options: {
        notifyNoData: false,
        noDataTimeframe: 10,
        evaluationDelay: 60,
        thresholds: { critical: 5.0, warning: 2.0 },
        includeTags: true,
      },
    },
    {
      name: `${this.monitorPrefix}High Latency`,
      type: 'query alert',
      query:
        'p75:trace.servlet.request.duration{service:hellotalk-backend,resource_name:admin.*} > 2',
      message:
        'Admin dashboard p75 latency exceeds 2 seconds. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:medium'],
      options: {
        notifyNoData: false,
        noDataTimeframe: 10,
        evaluationDelay: 60,
        thresholds: { critical: 2.0, warning: 1.0 },
        includeTags: true,
      },
    },
    {
      name: `${this.monitorPrefix}Excessive Bans/Warns`,
      type: 'query alert',
      query:
        'sum(last_1h):sum:hellotalk.admin.action.count{action:ban}.as_count() + sum:hellotalk.admin.action.count{action:warn}.as_count() > 20',
      message:
        'More than 20 bans/warns in the last hour. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:high'],
      options: {
        notifyNoData: false,
        noDataTimeframe: 10,
        evaluationDelay: 120,
        thresholds: { critical: 20, warning: 10 },
        includeTags: true,
      },
    },
    {
      name: `${this.monitorPrefix}Moderation Queue Backlog`,
      type: 'query alert',
      query:
        'avg(last_30m):avg:hellotalk.moderation.pending_reports{service:hellotalk-backend} > 50',
      message:
        'Moderation queue has > 50 pending items. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:medium'],
      options: {
        notifyNoData: true,
        noDataTimeframe: 15,
        evaluationDelay: 120,
        thresholds: { critical: 50, warning: 25 },
        includeTags: true,
      },
    },
    {
      name: `${this.monitorPrefix}Admin API Unavailable`,
      type: 'service check',
      query:
        '"http.can_connect".over("instance:admin_dashboard").by("instance").last(6).count_by_status()',
      message:
        'Admin dashboard API health check is failing. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:critical'],
      options: {
        notifyNoData: true,
        noDataTimeframe: 5,
        evaluationDelay: 30,
        thresholds: { critical: 2 },
        includeTags: true,
      },
    },
    {
      name: `${this.monitorPrefix}Unusual Login History Access`,
      type: 'query alert',
      query:
        'sum(last_1h):sum:hellotalk.admin.login_history_access{service:hellotalk-backend}.as_count() > 100',
      message:
        'Unusual volume of admin login history lookups. {{#is_alert}}@pagerduty-admin{{/is_alert}}',
      tags: ['team:admin', 'service:hellotalk-backend', 'severity:low'],
      options: {
        notifyNoData: false,
        noDataTimeframe: 10,
        evaluationDelay: 120,
        thresholds: { critical: 100, warning: 50 },
        includeTags: true,
      },
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.register = this.metricsService.getRegister();

    this.actionCounter = new Counter({
      name: 'hellotalk_admin_action_count',
      help: 'Count of admin moderation actions by type',
      labelNames: ['action'],
      registers: [this.register],
    });

    this.loginHistoryCounter = new Counter({
      name: 'hellotalk_admin_login_history_access',
      help: 'Count of admin login history lookups',
      registers: [this.register],
    });

    this.pendingReportsGauge = new Gauge({
      name: 'hellotalk_moderation_pending_reports',
      help: 'Number of pending moderation reports',
      registers: [this.register],
    });

    this.totalUsersGauge = new Gauge({
      name: 'hellotalk_admin_total_users',
      help: 'Total user count for admin dashboard',
      registers: [this.register],
    });

    this.totalReportsGauge = new Gauge({
      name: 'hellotalk_admin_total_reports',
      help: 'Total report count for admin dashboard',
      registers: [this.register],
    });

    this.totalBlocksGauge = new Gauge({
      name: 'hellotalk_admin_total_blocks',
      help: 'Total block count for admin dashboard',
      registers: [this.register],
    });

    this.enabled = !!(
      this.configService.get<string>('DD_API_KEY') &&
      this.configService.get<string>('DD_APP_KEY')
    );

    if (this.enabled) {
      const configuration = client.createConfiguration({
        authMethods: {
          apiKeyAuth: this.configService.get<string>('DD_API_KEY')!,
          appKeyAuth: this.configService.get<string>('DD_APP_KEY')!,
        },
      });
      configuration.setServerVariables({
        site: this.configService.get<string>('DD_SITE') ?? 'datadoghq.com',
      });

      this.apiInstance = new v1.MonitorsApi(configuration);
      this.logger.log('Datadog monitoring initialised');
    } else {
      this.logger.warn(
        'Datadog monitoring disabled - DD_API_KEY or DD_APP_KEY not set',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled || !this.apiInstance) return;
    await this.ensureMonitorsCreated();
  }

  private async ensureMonitorsCreated(): Promise<void> {
    if (!this.apiInstance) return;
    try {
      const existing = await this.listExistingMonitors();
      const existingNames = new Set(existing.map((m) => m.name));

      for (const config of this.adminAlerts) {
        if (!existingNames.has(config.name)) {
          await this.createMonitor(config);
          this.logger.log(`Created Datadog monitor: ${config.name}`);
        } else {
          this.logger.debug(
            `Datadog monitor already exists: ${config.name}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to ensure Datadog monitors are created',
        err,
      );
    }
  }

  private async listExistingMonitors(): Promise<MonitorSummary[]> {
    if (!this.apiInstance) return [];
    try {
      const response = await this.apiInstance.listMonitors({
        monitorTags: 'team:admin',
        pageSize: 100,
      });
      return (response as MonitorSummary[]) ?? [];
    } catch (err) {
      this.logger.error('Failed to list existing Datadog monitors', err);
      return [];
    }
  }

  private async createMonitor(
    config: DatadogMonitorConfig,
  ): Promise<void> {
    if (!this.apiInstance) return;
    await this.apiInstance.createMonitor({
      body: {
        name: config.name,
        type: config.type,
        query: config.query,
        message: config.message,
        tags: config.tags,
        options: {
          ...config.options,
          notifyAudit: false,
          renotifyInterval: 60,
          timeoutH: 0,
          newGroupDelay: 60,
        },
      },
    });
  }

  recordAdminAction(action: AdminActionMetrics): void {
    this.actionCounter.labels({ action: action.actionType }).inc(action.count);
    this.logger.debug(
      `Recorded admin action: ${action.actionType} x${action.count}`,
    );
  }

  recordLoginHistoryAccess(): void {
    this.loginHistoryCounter.inc();
  }

  async collectModerationQueueMetrics(): Promise<ModerationQueueMetrics> {
    try {
      const supabase = this.supabaseService.getClient();

      const { count: pendingReports } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: pendingMoments } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .not('reported_moment_id', 'is', null);

      const metrics: ModerationQueueMetrics = {
        pendingReports: pendingReports ?? 0,
        pendingMoments: pendingMoments ?? 0,
        unprocessedFlags:
          (pendingReports ?? 0) - (pendingMoments ?? 0),
        oldestPendingMinutes: 0,
      };

      if (metrics.pendingReports > 0) {
        const { data: oldest } = await supabase
          .from('reports')
          .select('created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (oldest) {
          const created = (oldest as { created_at: string }).created_at;
          const age = (Date.now() - new Date(created).getTime()) / 60000;
          metrics.oldestPendingMinutes = Math.round(age);
        }
      }

      this.pendingReportsGauge.set(metrics.pendingReports);

      return metrics;
    } catch (err) {
      this.logger.error(
        'Failed to collect moderation queue metrics',
        err,
      );
      return {
        pendingReports: 0,
        pendingMoments: 0,
        unprocessedFlags: 0,
        oldestPendingMinutes: 0,
      };
    }
  }

  async collectAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
    try {
      const supabase = this.supabaseService.getClient();

      const { count: totalUsers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      const { count: totalReports } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true });

      const { count: totalBlocks } = await supabase
        .from('blocks')
        .select('id', { count: 'exact', head: true });

      const metrics: AdminDashboardMetrics = {
        totalUsers: totalUsers ?? 0,
        totalReports: totalReports ?? 0,
        totalBlocks: totalBlocks ?? 0,
        errorRate: 0,
        p95Latency: 0,
        activeAdmins: 0,
      };

      this.totalUsersGauge.set(metrics.totalUsers);
      this.totalReportsGauge.set(metrics.totalReports);
      this.totalBlocksGauge.set(metrics.totalBlocks);

      return metrics;
    } catch (err) {
      this.logger.error(
        'Failed to collect admin dashboard metrics',
        err,
      );
      return {
        totalUsers: 0,
        totalReports: 0,
        totalBlocks: 0,
        errorRate: 0,
        p95Latency: 0,
        activeAdmins: 0,
      };
    }
  }
}