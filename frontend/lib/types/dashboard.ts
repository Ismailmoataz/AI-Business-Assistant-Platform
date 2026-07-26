import type { Activity, Company, User, UserRole } from "@/lib/types/api";
import type { CustomerStatus, EmploymentStatus, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/types/business";
import type { Conversation } from "@/lib/types/conversations";

export interface DashboardKpis {
  active_projects: number;
  open_tasks: number;
  completed_tasks: number;
  employees: number;
  customers: number | null;
  documents: number;
  storage_bytes: number | null;
  ai_conversations: number;
  notes: number;
}

export interface ExecutiveBrief {
  content: string;
  status: "generated" | "fallback";
  generated_at: string;
  unavailable_reason: string | null;
}

export interface DashboardTaskItem {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date: string | null;
}

export interface DashboardMyWork {
  assigned: number;
  due_today: number;
  overdue: number;
  upcoming: number;
  items: DashboardTaskItem[];
}

export interface DashboardDocumentItem {
  id: string;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  processing_status: "uploaded" | "processing" | "ready" | "failed";
  updated_at: string;
}

export interface DashboardDocuments {
  uploaded: number;
  processing: number;
  ready: number;
  failed: number;
  recent: DashboardDocumentItem[];
}

export interface DashboardProjectItem {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  health: "on_track" | "watch" | "at_risk" | "planned";
  end_date: string | null;
  open_tasks: number;
  overdue_tasks: number;
  updated_at: string;
}

export interface DashboardCustomerItem {
  id: string;
  name: string;
  status: CustomerStatus;
  contact_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardCustomers {
  available: boolean;
  unavailable_reason: string | null;
  recently_added: DashboardCustomerItem[];
  recently_updated: DashboardCustomerItem[];
  activity: Activity[];
}

export interface DashboardEmployeeItem {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  job_title: string | null;
  employment_status: EmploymentStatus;
  assigned_task_count: number;
  updated_at: string;
}

export interface DashboardEmployees {
  recently_updated: DashboardEmployeeItem[];
  workload: DashboardEmployeeItem[];
  activity_available: boolean;
  activity: Activity[];
}

export interface DashboardOverview {
  user: User;
  company: Company;
  kpis: DashboardKpis;
  brief: ExecutiveBrief;
  my_work: DashboardMyWork;
  documents: DashboardDocuments;
  projects: DashboardProjectItem[];
  conversations: Conversation[];
  customers: DashboardCustomers;
  employees: DashboardEmployees;
}
