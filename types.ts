export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  timestamp: string;
  customerName: string;
  items: string[];
  total: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export type CampaignStatus = "scheduled" | "processing" | "sent" | "failed" | "cancelled" | "paused";

export interface Campaign {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string;
  isCustom?: boolean;
  scheduledAt: string; // ISO
  delayMs?: number;
  numbers: any[];
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  attempts?: number;
  stats?: {
    sent?: number;
    failed?: number;
  };
}

export enum AppTab {
  METRICS = "metrics",
  QR = "qr",
  CATALOG = "catalog",
  LOGS = "logs",
  SHEETS = "sheets",
  AI_STUDIO = "ai_studio", // Unified Tester + Config
  BOT_PANEL = "bot_panel",
  MASS_MESSAGES = "mass_messages",
  PROMPT_CONFIG = "prompt_config",
  CAMPAIGN_CALENDAR = "campaign_calendar",
  CAMPAIGNS = "campaigns",
  SETTINGS = "settings",
}
