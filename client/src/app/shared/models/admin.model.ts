import { Color, Page } from './catalog.model';
import { Project } from './project.model';
import { PublicSettings } from './settings.model';
import { User } from './user.model';

export interface AdminUser extends User {
  projectCount: number;
}

export interface AdminProject extends Project {
  owner?: { _id: string; name: string; email: string };
}

export type ActivityAction =
  | 'register'
  | 'login'
  | 'logout'
  | 'upload'
  | 'save'
  | 'download'
  | 'delete'
  | 'session_start'
  | 'session_end';

export interface ActivityEntry {
  _id: string;
  action: ActivityAction;
  userId?: { _id: string; name: string; email: string } | null;
  projectId?: { _id: string; title: string } | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminColor extends Color {
  isActive: boolean;
  updatedAt: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export interface DailyPoint {
  date: string;
  uploads: number;
  saves: number;
  downloads: number;
  signups: number;
}

export interface Analytics {
  range: { from: string; to: string };
  kpis: {
    uploads: number;
    designsSaved: number;
    totalSavedDesigns: number;
    avgSessionSeconds: number;
    sessions: number;
    satisfaction: {
      average: number | null;
      responses: number;
      distribution: { rating: number; count: number }[];
    };
    totalUsers: number;
    activeUsers: number;
  };
  series: DailyPoint[];
  topColors: { color: Pick<Color, '_id' | 'name' | 'code' | 'hex' | 'brand'>; uses: number }[];
  generatedAt: string;
}

export type AdminSettings = PublicSettings;
export type AdminPage<T> = Page<T>;
