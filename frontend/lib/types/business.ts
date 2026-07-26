import type { Activity, Page, UserRole } from "@/lib/types/api";

export type EmploymentStatus = "active" | "on_leave" | "inactive";
export type CustomerType = "company" | "individual";
export type CustomerStatus = "active" | "prospect" | "inactive";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type NoteScope = "personal" | "company" | "project";
export type EmployeeSort = "name" | "role" | "status" | "updated";
export type CustomerSort = "name" | "status" | "updated";
export type ProjectSort = "name" | "due_date" | "updated";
export type TaskSort = "name" | "due_date" | "priority" | "updated";
export type NoteSort = "title" | "updated";

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  customer_count: number;
  project_count: number;
  task_count: number;
  note_count: number;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  department_id: string | null;
  department_name: string | null;
  manager_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  phone: string | null;
  avatar_key: string | null;
  hire_date: string | null;
  employment_status: EmploymentStatus;
  active: boolean;
  assigned_project_count: number;
  assigned_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  customer_type: CustomerType;
  status: CustomerStatus;
  name: string;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  department_id: string | null;
  customer_id: string | null;
  owner_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  project_id: string;
  assignee_id: string | null;
  created_by_user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface TaskDetail extends Task { comments: TaskComment[]; }

export interface Note {
  id: string;
  company_id: string;
  project_id: string | null;
  owner_id: string;
  employee_id: string | null;
  customer_id: string | null;
  task_id: string | null;
  document_id: string | null;
  scope: NoteScope;
  title: string;
  body: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface EmployeeUpdateInput {
  first_name?: string;
  last_name?: string;
  department_id?: string | null;
  job_title?: string | null;
  phone?: string | null;
  avatar_key?: string | null;
  hire_date?: string | null;
  manager_id?: string | null;
  employment_status?: EmploymentStatus;
}

export interface CustomerInput {
  customer_type: CustomerType;
  name: string;
  status: CustomerStatus;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  tag_ids: string[];
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  owner_id?: string | null;
  customer_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  tag_ids: string[];
}

export interface TaskCreateInput {
  project_id: string;
  title: string;
  description?: string | null;
  assignee_id?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date?: string | null;
  tag_ids: string[];
}

export type TaskUpdateInput = Partial<Omit<TaskCreateInput, "project_id">>;

export interface NoteInput {
  scope: NoteScope;
  title: string;
  body: string;
  project_id?: string | null;
  employee_id?: string | null;
  customer_id?: string | null;
  task_id?: string | null;
  document_id?: string | null;
  tag_ids: string[];
}

export type NoteUpdateInput = Partial<Pick<NoteInput, "title" | "body" | "employee_id" | "customer_id" | "task_id" | "document_id" | "tag_ids">>;
export interface TagInput { name: string; color?: string | null; }

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  role?: UserRole | "all";
  status?: EmploymentStatus | "all";
  sort?: EmployeeSort;
}

export interface CustomerFilters {
  search?: string;
  status?: CustomerStatus | "all";
  customerType?: CustomerType | "all";
  tagId?: string;
  sort?: CustomerSort;
}

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | "all";
  ownerId?: string;
  customerId?: string;
  tagId?: string;
  sort?: ProjectSort;
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assigneeId?: string;
  projectId?: string;
  tagId?: string;
  sort?: TaskSort;
}

export interface NoteFilters {
  search?: string;
  scope?: NoteScope | "all";
  projectId?: string;
  ownerId?: string;
  employeeId?: string;
  customerId?: string;
  taskId?: string;
  documentId?: string;
  tagId?: string;
  sort?: NoteSort;
}

export interface TagFilters { search?: string; }

export type EmployeePage = Page<Employee>;
export type CustomerPage = Page<Customer>;
export type ProjectPage = Page<Project>;
export type TaskPage = Page<Task>;
export type TagPage = Page<Tag>;
export type NotePage = Page<Note>;
export type ActivityPage = Page<Activity>;
