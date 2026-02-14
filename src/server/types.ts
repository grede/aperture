// ── Server Types ───────────────────────────────────────────────

export interface JobConfig {
  appPath: string;
  bundleId: string;
  flowYaml: string;
  locales: string[];
  devices: ('iphone' | 'ipad')[];
  style: string;
  guardrails: {
    maxActionsPerStep: number;
    stepTimeoutSec: number;
    runTimeoutSec: number;
    costCapUsd: number;
    forbiddenActions: string[];
  };
}

export interface Job {
  id: string;
  config: JobConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: {
    current: number;
    total: number;
    currentLocale?: string;
    currentDevice?: string;
  };
  cost: number;
  screenshots: string[];
  error?: string;
}

export interface SimulatorPoolEntry {
  udid: string;
  name: string;
  deviceType: 'iPhone' | 'iPad';
  state: 'available' | 'in-use' | 'unhealthy';
  currentJobId?: string;
  lastHealthCheck: Date;
}

export interface SessionInfo {
  jobId: string;
  workspaceDir: string;
  allocatedSimulators: string[];
  startTime: Date;
  lastActivity: Date;
}
