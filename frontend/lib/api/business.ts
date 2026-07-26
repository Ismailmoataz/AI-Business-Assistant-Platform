import { api } from "@/lib/api/client";
import type {
  ActivityPage,
  Customer,
  CustomerFilters,
  CustomerInput,
  CustomerPage,
  Department,
  Employee,
  EmployeeFilters,
  EmployeePage,
  EmployeeUpdateInput,
  Note,
  NoteFilters,
  NoteInput,
  NotePage,
  NoteUpdateInput,
  Project,
  ProjectFilters,
  ProjectInput,
  ProjectPage,
  Tag,
  TagFilters,
  TagInput,
  TagPage,
  Task,
  TaskComment,
  TaskCreateInput,
  TaskDetail,
  TaskFilters,
  TaskPage,
  TaskUpdateInput,
} from "@/lib/types/business";

function value(params: URLSearchParams, key: string, item: string | number | null | undefined) {
  if (item !== undefined && item !== null && item !== "" && item !== "all") params.set(key, String(item));
}

function baseQuery(offset: number, limit: number) {
  return new URLSearchParams({ offset: String(offset), limit: String(limit) });
}

function employeeQuery(filters: EmployeeFilters, offset: number, limit: number) {
  const params = baseQuery(offset, limit);
  value(params, "search", filters.search);
  value(params, "department_id", filters.departmentId);
  value(params, "role", filters.role);
  value(params, "status", filters.status);
  value(params, "sort", filters.sort ?? "name");
  return params;
}

function customerQuery(filters: CustomerFilters, offset: number, limit: number) {
  const params = baseQuery(offset, limit);
  value(params, "search", filters.search);
  value(params, "status", filters.status);
  value(params, "customer_type", filters.customerType);
  value(params, "tag_id", filters.tagId);
  value(params, "sort", filters.sort ?? "name");
  return params;
}

function projectQuery(filters: ProjectFilters, offset: number, limit: number) {
  const params = baseQuery(offset, limit);
  value(params, "search", filters.search);
  value(params, "status", filters.status);
  value(params, "owner_id", filters.ownerId);
  value(params, "customer_id", filters.customerId);
  value(params, "tag_id", filters.tagId);
  value(params, "sort", filters.sort ?? "updated");
  return params;
}

function taskQuery(filters: TaskFilters, offset: number, limit: number) {
  const params = baseQuery(offset, limit);
  value(params, "search", filters.search);
  value(params, "status", filters.status);
  value(params, "priority", filters.priority);
  value(params, "assignee_id", filters.assigneeId);
  value(params, "project_id", filters.projectId);
  value(params, "tag_id", filters.tagId);
  value(params, "sort", filters.sort ?? "due_date");
  return params;
}

function noteQuery(filters: NoteFilters, offset: number, limit: number) {
  const params = baseQuery(offset, limit);
  value(params, "search", filters.search);
  value(params, "scope", filters.scope);
  value(params, "project_id", filters.projectId);
  value(params, "owner_id", filters.ownerId);
  value(params, "employee_id", filters.employeeId);
  value(params, "customer_id", filters.customerId);
  value(params, "task_id", filters.taskId);
  value(params, "document_id", filters.documentId);
  value(params, "tag_id", filters.tagId);
  value(params, "sort", filters.sort ?? "updated");
  return params;
}

export const businessKeys = {
  projects: ["business", "projects"] as const,
  project: (id: string) => ["business", "projects", id] as const,
  tasks: ["business", "tasks"] as const,
  task: (id: string) => ["business", "tasks", id] as const,
  employees: ["business", "employees"] as const,
  employee: (id: string) => ["business", "employees", id] as const,
  customers: ["business", "customers"] as const,
  customer: (id: string) => ["business", "customers", id] as const,
  departments: ["business", "departments"] as const,
  tags: ["business", "tags"] as const,
  tag: (id: string) => ["business", "tags", id] as const,
  notes: ["business", "notes"] as const,
  note: (id: string) => ["business", "notes", id] as const,
  activity: ["business", "activity"] as const,
  globalSearch: ["business", "global-search"] as const,
};

export const businessApi = {
  employees: {
    list: (filtersOrSearch: EmployeeFilters | string = {}, offset = 0, limit = 100) => {
      const filters = typeof filtersOrSearch === "string" ? { search: filtersOrSearch } : filtersOrSearch;
      const actualLimit = typeof filtersOrSearch === "string" && offset > 0 ? offset : limit;
      const actualOffset = typeof filtersOrSearch === "string" ? 0 : offset;
      return api<EmployeePage>(`/employees?${employeeQuery(filters, actualOffset, actualLimit)}`);
    },
    get: (id: string) => api<Employee>(`/employees/${id}`),
    update: (id: string, input: EmployeeUpdateInput) => api<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  },
  customers: {
    list: (filters: CustomerFilters = {}, offset = 0, limit = 25) => api<CustomerPage>(`/customers?${customerQuery(filters, offset, limit)}`),
    get: (id: string) => api<Customer>(`/customers/${id}`),
    create: (input: CustomerInput) => api<Customer>("/customers", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Partial<CustomerInput>) => api<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => api<void>(`/customers/${id}`, { method: "DELETE" }),
  },
  projects: {
    list: (filters: ProjectFilters = {}, offset = 0, limit = 25) => api<ProjectPage>(`/projects?${projectQuery(filters, offset, limit)}`),
    get: (id: string) => api<Project>(`/projects/${id}`),
    create: (input: ProjectInput) => api<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Partial<ProjectInput>) => api<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => api<void>(`/projects/${id}`, { method: "DELETE" }),
  },
  tasks: {
    list: (filters: TaskFilters = {}, offset = 0, limit = 100) => api<TaskPage>(`/tasks?${taskQuery(filters, offset, limit)}`),
    get: (id: string) => api<TaskDetail>(`/tasks/${id}`),
    create: (input: TaskCreateInput) => api<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: TaskUpdateInput) => api<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
    comment: (id: string, body: string) => api<TaskComment>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  },
  departments: {
    list: () => api<Department[]>("/departments"),
  },
  tags: {
    list: (filtersOrLimit: TagFilters | number = {}, offset = 0, limit = 100) => {
      const filters = typeof filtersOrLimit === "number" ? {} : filtersOrLimit;
      const actualLimit = typeof filtersOrLimit === "number" ? filtersOrLimit : limit;
      const params = baseQuery(offset, actualLimit);
      value(params, "search", filters.search);
      return api<TagPage>(`/tags?${params}`);
    },
    get: (id: string) => api<Tag>(`/tags/${id}`),
    create: (input: TagInput) => api<Tag>("/tags", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Partial<TagInput>) => api<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => api<void>(`/tags/${id}`, { method: "DELETE" }),
  },
  notes: {
    list: (filtersOrProject: NoteFilters | string = {}, offset = 0, limit = 100) => {
      const filters = typeof filtersOrProject === "string" ? { projectId: filtersOrProject } : filtersOrProject;
      return api<NotePage>(`/notes?${noteQuery(filters, offset, limit)}`);
    },
    get: (id: string) => api<Note>(`/notes/${id}`),
    create: (input: NoteInput) => api<Note>("/notes", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: NoteUpdateInput) => api<Note>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => api<void>(`/notes/${id}`, { method: "DELETE" }),
  },
  activity: {
    feed: (offset = 0, limit = 8) => {
      const params = baseQuery(offset, limit);
      return api<ActivityPage>(`/activity?${params}`);
    },
    list: (entityType: string, entityId: string, limit = 25) => {
      const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId, limit: String(limit) });
      return api<ActivityPage>(`/activity?${params}`);
    },
  },
};
