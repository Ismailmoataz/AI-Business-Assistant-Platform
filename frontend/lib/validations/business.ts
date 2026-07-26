import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const optionalId = z.string().optional();
const optionalDate = z.string().optional();

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: optionalText(20000),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
  owner_id: optionalId,
  customer_id: optionalId,
  start_date: optionalDate,
  end_date: optionalDate,
  tag_ids: z.array(z.string()).max(50),
}).refine((data) => !data.start_date || !data.end_date || data.end_date >= data.start_date, {
  message: "Due date must be on or after the start date",
  path: ["end_date"],
});

export const taskSchema = z.object({
  project_id: z.string().min(1, "Choose a project"),
  title: z.string().trim().min(1, "Enter a task title").max(250),
  description: optionalText(20000),
  assignee_id: optionalId,
  status: z.enum(["todo", "in_progress", "review", "blocked", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  progress: z.number().int().min(0).max(100),
  due_date: optionalDate,
  tag_ids: z.array(z.string()).max(50),
});

export const commentSchema = z.object({ body: z.string().trim().min(1, "Write a comment").max(10000) });
export const noteSchema = z.object({
  title: z.string().trim().min(1, "Enter a note title").max(250),
  body: z.string().trim().min(1, "Write a note").max(50000),
});

export const employeeSchema = z.object({
  first_name: z.string().trim().min(1, "Enter a first name").max(100),
  last_name: z.string().trim().min(1, "Enter a last name").max(100),
  job_title: optionalText(150),
  phone: optionalText(50),
  department_id: optionalId,
  manager_id: optionalId,
  hire_date: optionalDate,
  employment_status: z.enum(["active", "on_leave", "inactive"]),
});

export const customerSchema = z.object({
  customer_type: z.enum(["company", "individual"]),
  name: z.string().trim().min(1, "Enter a customer name").max(200),
  status: z.enum(["active", "prospect", "inactive"]),
  email: z.string().trim().email("Enter a valid email address").or(z.literal("")),
  phone: optionalText(50),
  contact_name: optionalText(200),
  notes: optionalText(10000),
  tag_ids: z.array(z.string()).max(50),
});

export const workspaceNoteSchema = z.object({
  scope: z.enum(["personal", "company", "project"]),
  title: z.string().trim().min(1, "Enter a note title").max(250),
  body: z.string().trim().min(1, "Write a note").max(50000),
  relation_type: z.enum(["none", "employee", "customer", "project", "task", "document"]),
  relation_id: optionalId,
  tag_ids: z.array(z.string()).max(50),
}).refine((data) => data.relation_type === "none" || Boolean(data.relation_id), {
  message: "Choose a related record",
  path: ["relation_id"],
}).refine((data) => data.scope !== "project" || ["project", "task"].includes(data.relation_type), {
  message: "Project notes must link to a project or task",
  path: ["relation_type"],
});

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Enter a tag name").max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Choose a six-digit hex color"),
});

export type ProjectValues = z.infer<typeof projectSchema>;
export type TaskValues = z.infer<typeof taskSchema>;
export type CommentValues = z.infer<typeof commentSchema>;
export type NoteValues = z.infer<typeof noteSchema>;
export type EmployeeValues = z.infer<typeof employeeSchema>;
export type CustomerValues = z.infer<typeof customerSchema>;
export type WorkspaceNoteValues = z.infer<typeof workspaceNoteSchema>;
export type TagValues = z.infer<typeof tagSchema>;
