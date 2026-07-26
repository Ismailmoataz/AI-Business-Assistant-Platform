/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const { randomUUID } = require("node:crypto");

const port = Number(process.env.E2E_API_PORT ?? 3101);
const host = "127.0.0.1";
const fixedNow = "2026-07-20T09:00:00.000Z";
const password = "Orbit!Test123";
const workspaces = new Map();
const accountsByEmail = new Map();
const sessionsByToken = new Map();

const ids = {
  company: "11111111-1111-4111-8111-111111111111",
  foreignCompany: "11111111-1111-4111-8111-222222222222",
  admin: "22222222-2222-4222-8222-111111111111",
  manager: "22222222-2222-4222-8222-222222222222",
  employee: "22222222-2222-4222-8222-333333333333",
  foreignUser: "22222222-2222-4222-8222-444444444444",
  department: "33333333-3333-4333-8333-111111111111",
  operationsDepartment: "33333333-3333-4333-8333-222222222222",
  tag: "44444444-4444-4444-8444-111111111111",
  secondaryTag: "44444444-4444-4444-8444-222222222222",
  customer: "55555555-5555-4555-8555-111111111111",
  secondaryCustomer: "55555555-5555-4555-8555-222222222222",
  foreignCustomer: "55555555-5555-4555-8555-333333333333",
  project: "66666666-6666-4666-8666-111111111111",
  secondaryProject: "66666666-6666-4666-8666-222222222222",
  foreignProject: "66666666-6666-4666-8666-333333333333",
  task: "77777777-7777-4777-8777-111111111111",
  secondaryTask: "77777777-7777-4777-8777-222222222222",
  doneTask: "77777777-7777-4777-8777-333333333333",
  note: "88888888-8888-4888-8888-111111111111",
  secondaryNote: "88888888-8888-4888-8888-222222222222",
  folder: "99999999-9999-4999-8999-111111111111",
  nestedFolder: "99999999-9999-4999-8999-222222222222",
  document: "aaaaaaaa-aaaa-4aaa-8aaa-111111111111",
  secondaryDocument: "aaaaaaaa-aaaa-4aaa-8aaa-222222222222",
  processingDocument: "aaaaaaaa-aaaa-4aaa-8aaa-333333333333",
  conversation: "bbbbbbbb-bbbb-4bbb-8bbb-111111111111",
  secondaryConversation: "bbbbbbbb-bbbb-4bbb-8bbb-222222222222",
  userMessage: "cccccccc-cccc-4ccc-8ccc-111111111111",
  assistantMessage: "cccccccc-cccc-4ccc-8ccc-222222222222",
};

function company(id, name, slug) {
  return { id, name, slug, active: true, created_at: fixedNow, updated_at: fixedNow };
}

function user(id, companyId, role, firstName, lastName, email, departmentId) {
  return {
    id,
    company_id: companyId,
    department_id: departmentId,
    role,
    first_name: firstName,
    last_name: lastName,
    email,
    active: true,
    email_verified: true,
    last_login: fixedNow,
    created_at: fixedNow,
    updated_at: fixedNow,
  };
}

function employeeFromUser(accountUser, overrides = {}) {
  return {
    ...accountUser,
    department_name: accountUser.department_id ? "Product" : null,
    manager_id: null,
    job_title: "Team member",
    phone: null,
    avatar_key: null,
    hire_date: "2025-01-15",
    employment_status: "active",
    assigned_project_count: 1,
    assigned_task_count: 1,
    ...overrides,
  };
}

function seedWorkspace(testId) {
  const tenantCompany = company(ids.company, "Northstar Labs", "northstar-labs");
  const otherCompany = company(ids.foreignCompany, "Other Tenant", "other-tenant");
  const emails = {
    admin: `admin+${testId}@example.test`,
    manager: `manager+${testId}@example.test`,
    employee: `employee+${testId}@example.test`,
    outsider: `outsider+${testId}@example.test`,
  };
  const users = {
    admin: user(ids.admin, ids.company, "admin", "Ada", "Admin", emails.admin, ids.department),
    manager: user(ids.manager, ids.company, "manager", "Mina", "Manager", emails.manager, ids.department),
    employee: user(ids.employee, ids.company, "employee", "Eli", "Employee", emails.employee, ids.department),
    outsider: user(ids.foreignUser, ids.foreignCompany, "admin", "Olivia", "Outsider", emails.outsider, null),
  };
  const accounts = {};
  for (const role of Object.keys(users)) {
    const accessToken = `e2e-access:${testId}:${role}`;
    const refreshToken = `e2e-refresh:${testId}:${role}`;
    const account = {
      role,
      email: emails[role],
      password,
      user: users[role],
      company: role === "outsider" ? otherCompany : tenantCompany,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        access_token_expires_in: 3600,
      },
    };
    accounts[role] = account;
    accountsByEmail.set(account.email, { testId, account });
    sessionsByToken.set(accessToken, { testId, account });
    sessionsByToken.set(refreshToken, { testId, account });
  }

  const tags = [
    { id: ids.tag, company_id: ids.company, name: "Priority", color: "#6366F1", deleted: false },
    { id: ids.secondaryTag, company_id: ids.company, name: "Customer-facing", color: "#0F766E", deleted: false },
  ];
  const employees = [
    employeeFromUser(users.admin, { job_title: "Founder", assigned_project_count: 0, assigned_task_count: 0 }),
    employeeFromUser(users.manager, { job_title: "Delivery Manager", manager_id: ids.admin, assigned_project_count: 1, assigned_task_count: 1 }),
    employeeFromUser(users.employee, { job_title: "Product Analyst", manager_id: ids.manager }),
    employeeFromUser(users.outsider, { department_name: null, job_title: "Other Tenant Admin" }),
  ];
  const customers = [
    {
      id: ids.customer,
      company_id: ids.company,
      customer_type: "company",
      status: "active",
      name: "Atlas Retail",
      email: "hello@atlas.example",
      phone: "+1 555 0100",
      contact_name: "Avery Stone",
      notes: "Quarterly expansion account.",
      tag_ids: [ids.secondaryTag],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.secondaryCustomer,
      company_id: ids.company,
      customer_type: "individual",
      status: "prospect",
      name: "Cedar Consulting",
      email: "cedar@example.test",
      phone: null,
      contact_name: "Casey Cedar",
      notes: null,
      tag_ids: [],
      created_at: fixedNow,
      updated_at: "2026-07-19T09:00:00.000Z",
      deleted: false,
    },
    {
      id: ids.foreignCustomer,
      company_id: ids.foreignCompany,
      customer_type: "company",
      status: "active",
      name: "Foreign Customer",
      email: "foreign@example.test",
      phone: null,
      contact_name: "Other User",
      notes: "Must never be visible across tenants.",
      tag_ids: [],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
  ];
  const projects = [
    {
      id: ids.project,
      company_id: ids.company,
      department_id: ids.department,
      customer_id: ids.customer,
      owner_id: ids.manager,
      name: "Atlas Launch",
      description: "Launch the Atlas Retail knowledge workspace.",
      status: "active",
      start_date: "2026-07-01",
      end_date: "2026-08-15",
      tag_ids: [ids.tag, ids.secondaryTag],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.secondaryProject,
      company_id: ids.company,
      department_id: ids.operationsDepartment,
      customer_id: null,
      owner_id: ids.admin,
      name: "Internal Operations",
      description: "Improve internal delivery workflows.",
      status: "planning",
      start_date: "2026-08-01",
      end_date: "2026-09-30",
      tag_ids: [],
      created_at: fixedNow,
      updated_at: "2026-07-18T09:00:00.000Z",
      deleted: false,
    },
    {
      id: ids.foreignProject,
      company_id: ids.foreignCompany,
      department_id: null,
      customer_id: ids.foreignCustomer,
      owner_id: ids.foreignUser,
      name: "Foreign Confidential Project",
      description: "Cross-tenant sentinel record.",
      status: "active",
      start_date: null,
      end_date: null,
      tag_ids: [],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
  ];
  const tasks = [
    {
      id: ids.task,
      company_id: ids.company,
      project_id: ids.project,
      assignee_id: ids.employee,
      created_by_user_id: ids.manager,
      title: "Prepare Atlas launch brief",
      description: "Collect the approved policy and launch risks.",
      status: "todo",
      priority: "high",
      progress: 20,
      due_date: "2026-08-01",
      tag_ids: [ids.tag],
      comments: [],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.secondaryTask,
      company_id: ids.company,
      project_id: ids.project,
      assignee_id: ids.manager,
      created_by_user_id: ids.admin,
      title: "Review Atlas permissions",
      description: "Verify role and tenant restrictions.",
      status: "in_progress",
      priority: "urgent",
      progress: 55,
      due_date: "2026-07-30",
      tag_ids: [ids.secondaryTag],
      comments: [],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.doneTask,
      company_id: ids.company,
      project_id: ids.secondaryProject,
      assignee_id: ids.employee,
      created_by_user_id: ids.admin,
      title: "Archive legacy checklist",
      description: "Retain the historical delivery checklist.",
      status: "done",
      priority: "low",
      progress: 100,
      due_date: "2026-07-10",
      tag_ids: [],
      comments: [],
      created_at: fixedNow,
      updated_at: "2026-07-10T09:00:00.000Z",
      deleted: false,
    },
  ];
  const notes = [
    {
      id: ids.note,
      company_id: ids.company,
      project_id: ids.project,
      owner_id: ids.admin,
      employee_id: null,
      customer_id: ids.customer,
      task_id: null,
      document_id: null,
      scope: "company",
      title: "Atlas decision log",
      body: "## Launch decision\n\nUse the approved **Atlas policy** for customer-facing work.",
      tag_ids: [ids.tag],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.secondaryNote,
      company_id: ids.company,
      project_id: null,
      owner_id: ids.employee,
      employee_id: ids.employee,
      customer_id: null,
      task_id: null,
      document_id: null,
      scope: "personal",
      title: "Weekly priorities",
      body: "Finish the launch brief and review the source citations.",
      tag_ids: [],
      created_at: fixedNow,
      updated_at: "2026-07-19T09:00:00.000Z",
      deleted: false,
    },
  ];
  const documents = [
    {
      id: ids.document,
      company_id: ids.company,
      folder_id: ids.folder,
      owner_id: ids.admin,
      department_id: ids.department,
      customer_id: ids.customer,
      title: "Launch policy",
      filename: "launch-policy.txt",
      mime_type: "text/plain",
      size_bytes: 2048,
      description: "Approved Atlas launch policy.",
      visibility: "company",
      status: "active",
      version: 1,
      processing_status: "ready",
      tags: [{ id: ids.tag, name: "Priority" }],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
    {
      id: ids.secondaryDocument,
      company_id: ids.company,
      folder_id: null,
      owner_id: ids.employee,
      department_id: ids.department,
      customer_id: null,
      title: "Budget worksheet",
      filename: "budget.xlsx",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size_bytes: 8192,
      description: null,
      visibility: "department",
      status: "active",
      version: 2,
      processing_status: "ready",
      tags: [],
      created_at: fixedNow,
      updated_at: "2026-07-19T09:00:00.000Z",
      deleted: false,
    },
    {
      id: ids.processingDocument,
      company_id: ids.company,
      folder_id: null,
      owner_id: ids.manager,
      department_id: ids.department,
      customer_id: null,
      title: "Meeting transcript",
      filename: "meeting.txt",
      mime_type: "text/plain",
      size_bytes: 1024,
      description: null,
      visibility: "private",
      status: "active",
      version: 1,
      processing_status: "processing",
      tags: [],
      created_at: fixedNow,
      updated_at: fixedNow,
      deleted: false,
    },
  ];
  const citation = {
    document_id: ids.document,
    title: "Launch policy",
    filename: "launch-policy.txt",
    chunk_index: 1,
    similarity_score: 0.93,
  };
  const conversations = [
    {
      id: ids.conversation,
      company_id: ids.company,
      owner_id: ids.admin,
      title: "Launch planning",
      last_message_preview: "The original launch answer.",
      created_at: fixedNow,
      updated_at: fixedNow,
      messages: [
        { id: ids.userMessage, conversation_id: ids.conversation, role: "user", content: "Summarize the launch policy", citations: [], created_at: fixedNow },
        { id: ids.assistantMessage, conversation_id: ids.conversation, role: "assistant", content: "The original launch answer.", citations: [citation], created_at: fixedNow },
      ],
      deleted: false,
    },
    {
      id: ids.secondaryConversation,
      company_id: ids.company,
      owner_id: ids.admin,
      title: "Budget review",
      last_message_preview: "A hidden needle appears in this older message.",
      created_at: fixedNow,
      updated_at: "2026-07-19T09:00:00.000Z",
      messages: [
        { id: randomUUID(), conversation_id: ids.secondaryConversation, role: "user", content: "A hidden needle appears in this older message.", citations: [], created_at: fixedNow },
        { id: randomUUID(), conversation_id: ids.secondaryConversation, role: "assistant", content: "Budget notes are ready.", citations: [], created_at: fixedNow },
      ],
      deleted: false,
    },
  ];
  const activities = [
    { id: randomUUID(), company_id: ids.company, actor_id: ids.manager, entity_type: "project", entity_id: ids.project, action: "updated", summary: "Atlas Launch was updated", created_at: fixedNow },
    { id: randomUUID(), company_id: ids.company, actor_id: ids.employee, entity_type: "task", entity_id: ids.task, action: "updated", summary: "Prepare Atlas launch brief moved to todo", created_at: "2026-07-19T09:00:00.000Z" },
  ];
  const state = {
    testId,
    companies: [tenantCompany, otherCompany],
    accounts,
    departments: [
      { id: ids.department, company_id: ids.company, name: "Product", description: "Product and delivery", created_at: fixedNow, updated_at: fixedNow },
      { id: ids.operationsDepartment, company_id: ids.company, name: "Operations", description: "Internal operations", created_at: fixedNow, updated_at: fixedNow },
    ],
    employees,
    tags,
    customers,
    projects,
    tasks,
    notes,
    folders: [
      { id: ids.folder, company_id: ids.company, parent_id: null, owner_id: ids.admin, department_id: null, name: "Policies", visibility: "company", created_at: fixedNow, updated_at: fixedNow },
      { id: ids.nestedFolder, company_id: ids.company, parent_id: ids.folder, owner_id: ids.admin, department_id: null, name: "Launch", visibility: "company", created_at: fixedNow, updated_at: fixedNow },
    ],
    documents,
    favoriteIds: new Set([ids.document]),
    recentIds: [ids.document, ids.secondaryDocument],
    conversations,
    citation,
    activities,
  };
  workspaces.set(testId, state);
  return state;
}

function cleanupWorkspace(testId) {
  const state = workspaces.get(testId);
  if (!state) return;
  for (const account of Object.values(state.accounts)) {
    accountsByEmail.delete(account.email);
    sessionsByToken.delete(account.tokens.access_token);
    sessionsByToken.delete(account.tokens.refresh_token);
  }
  workspaces.delete(testId);
}

function clientState(state) {
  return {
    test_id: state.testId,
    accounts: state.accounts,
    ids,
  };
}

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
}

function json(request, response, status, payload) {
  cors(request, response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(payload === undefined ? "" : JSON.stringify(payload));
}

function noContent(request, response) {
  cors(request, response);
  response.writeHead(204);
  response.end();
}

function readBuffer(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const buffer = await readBuffer(request);
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function authenticate(request) {
  const value = request.headers.authorization ?? "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const session = sessionsByToken.get(token);
  if (!session) return null;
  const state = workspaces.get(session.testId);
  return state ? { state, account: session.account } : null;
}

function publicTag(state, tag) {
  const active = (collection) => collection.filter((item) => !item.deleted && item.company_id === tag.company_id && item.tag_ids?.includes(tag.id)).length;
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    customer_count: active(state.customers),
    project_count: active(state.projects),
    task_count: active(state.tasks),
    note_count: active(state.notes),
  };
}

function tagsFor(state, tagIds) {
  return tagIds.map((id) => state.tags.find((tag) => tag.id === id && !tag.deleted)).filter(Boolean).map((tag) => publicTag(state, tag));
}

function withoutFields(item, fields) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !fields.includes(key)));
}

function publicCustomer(state, item) {
  const tagIds = item.tag_ids;
  const customer = withoutFields(item, ["tag_ids", "deleted"]);
  return { ...customer, tags: tagsFor(state, tagIds) };
}

function publicProject(state, item) {
  const tagIds = item.tag_ids;
  const project = withoutFields(item, ["tag_ids", "deleted"]);
  return { ...project, tags: tagsFor(state, tagIds) };
}

function publicTask(state, item, detail = false) {
  const tagIds = item.tag_ids;
  const comments = item.comments;
  const task = withoutFields(item, ["tag_ids", "deleted", "comments"]);
  return { ...task, tags: tagsFor(state, tagIds), ...(detail ? { comments } : {}) };
}

function publicNote(state, item) {
  const tagIds = item.tag_ids;
  const note = withoutFields(item, ["tag_ids", "deleted"]);
  return { ...note, tags: tagsFor(state, tagIds) };
}

function publicConversation(item, detail = false) {
  const messages = item.messages;
  const conversation = withoutFields(item, ["messages", "deleted"]);
  return detail ? { ...conversation, messages } : conversation;
}

function paginate(items, url, fallbackLimit = 25) {
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const limit = Math.max(1, Number(url.searchParams.get("limit") ?? fallbackLimit));
  return {
    items: items.slice(offset, offset + limit),
    page: { offset, limit, total: items.length },
  };
}

function matches(value, search) {
  return String(value ?? "").toLowerCase().includes(search.toLowerCase());
}

function visibleProjectIds(state, account) {
  if (account.user.role !== "employee") return null;
  return new Set([
    ...state.projects.filter((project) => project.owner_id === account.user.id).map((project) => project.id),
    ...state.tasks.filter((task) => task.assignee_id === account.user.id).map((task) => task.project_id),
  ]);
}

function addActivity(state, account, entityType, entityId, action, summary) {
  state.activities.unshift({
    id: randomUUID(),
    company_id: account.user.company_id,
    actor_id: account.user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    created_at: new Date().toISOString(),
  });
}

function sortByQuery(items, sort, nameKey = "name") {
  const result = [...items];
  if (sort === "name" || sort === "title") result.sort((a, b) => String(a[nameKey] ?? a.title).localeCompare(String(b[nameKey] ?? b.title)));
  else if (sort === "status") result.sort((a, b) => String(a.status).localeCompare(String(b.status)));
  else result.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return result;
}

function findTenantItem(items, id, account) {
  return items.find((item) => item.id === id && item.company_id === account.user.company_id && !item.deleted);
}

function permissionDenied(request, response, message = "You do not have permission to perform this action") {
  json(request, response, 403, { detail: message });
}

function notFound(request, response, message = "Resource was not found") {
  json(request, response, 404, { detail: message });
}

function stream(request, response, tokens, completion, onComplete) {
  cors(request, response);
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  let index = 0;
  let finished = false;
  const write = () => {
    if (response.destroyed) return;
    if (index < tokens.length) {
      response.write(`data: ${JSON.stringify({ token: tokens[index++] })}\n\n`);
      setTimeout(write, 90);
      return;
    }
    finished = true;
    onComplete();
    response.write(`event: complete\ndata: ${JSON.stringify(completion)}\n\n`);
    response.end();
  };
  response.on("close", () => {
    if (!finished) {
      // Cancellation intentionally leaves the prior assistant message unchanged.
    }
  });
  setTimeout(write, 140);
}

function dashboardOverview(state, account) {
  const companyRecord = state.companies.find((item) => item.id === account.user.company_id);
  const employeeRecords = state.employees.filter((item) => item.company_id === account.user.company_id);
  const projects = state.projects.filter((item) => item.company_id === account.user.company_id && !item.deleted);
  const tasks = state.tasks.filter((item) => item.company_id === account.user.company_id && !item.deleted);
  const documents = state.documents.filter((item) => item.company_id === account.user.company_id && !item.deleted);
  const notes = state.notes.filter((item) => item.company_id === account.user.company_id && !item.deleted);
  const customers = state.customers.filter((item) => item.company_id === account.user.company_id && !item.deleted);
  const conversations = state.conversations.filter((item) => item.owner_id === account.user.id && !item.deleted);
  const assigned = tasks.filter((item) => item.assignee_id === account.user.id && item.status !== "done");
  const customerAccess = account.user.role !== "employee";
  return {
    user: account.user,
    company: companyRecord,
    kpis: {
      active_projects: projects.filter((item) => item.status === "active").length,
      open_tasks: tasks.filter((item) => item.status !== "done").length,
      completed_tasks: tasks.filter((item) => item.status === "done").length,
      employees: employeeRecords.length,
      customers: customerAccess ? customers.length : null,
      documents: documents.length,
      storage_bytes: documents.reduce((total, item) => total + item.size_bytes, 0),
      ai_conversations: conversations.length,
      notes: notes.length,
    },
    brief: {
      content: "Atlas Launch is active. Prioritize the launch brief, permissions review, and processing documents.",
      status: "fallback",
      generated_at: fixedNow,
      unavailable_reason: "Deterministic E2E fixture",
    },
    my_work: {
      assigned: assigned.length,
      due_today: 0,
      overdue: 0,
      upcoming: assigned.length,
      items: assigned.slice(0, 6).map((task) => ({
        id: task.id,
        project_id: task.project_id,
        project_name: projects.find((project) => project.id === task.project_id)?.name ?? "Project",
        title: task.title,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        due_date: task.due_date,
      })),
    },
    documents: {
      uploaded: documents.filter((item) => item.processing_status === "uploaded").length,
      processing: documents.filter((item) => item.processing_status === "processing").length,
      ready: documents.filter((item) => item.processing_status === "ready").length,
      failed: documents.filter((item) => item.processing_status === "failed").length,
      recent: documents.slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        filename: item.filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        processing_status: item.processing_status,
        updated_at: item.updated_at,
      })),
    },
    projects: projects.slice(0, 4).map((project) => {
      const projectTasks = tasks.filter((task) => task.project_id === project.id);
      const progress = projectTasks.length ? projectTasks.reduce((total, task) => total + task.progress, 0) / projectTasks.length : 0;
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        progress,
        health: project.status === "planning" ? "planned" : "on_track",
        end_date: project.end_date,
        open_tasks: projectTasks.filter((task) => task.status !== "done").length,
        overdue_tasks: 0,
        updated_at: project.updated_at,
      };
    }),
    conversations: conversations.map((item) => publicConversation(item)),
    customers: {
      available: customerAccess,
      unavailable_reason: customerAccess ? null : "Customer records are available to managers and administrators.",
      recently_added: customerAccess ? customers.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        contact_name: item.contact_name,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })) : [],
      recently_updated: customerAccess ? customers.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        contact_name: item.contact_name,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })) : [],
      activity: customerAccess ? state.activities.filter((item) => item.entity_type === "customer") : [],
    },
    employees: {
      recently_updated: employeeRecords.slice(0, 3).map((item) => ({
        id: item.id,
        first_name: item.first_name,
        last_name: item.last_name,
        role: item.role,
        job_title: item.job_title,
        employment_status: item.employment_status,
        assigned_task_count: item.assigned_task_count,
        updated_at: item.updated_at,
      })),
      workload: employeeRecords.slice(0, 3).map((item) => ({
        id: item.id,
        first_name: item.first_name,
        last_name: item.last_name,
        role: item.role,
        job_title: item.job_title,
        employment_status: item.employment_status,
        assigned_task_count: item.assigned_task_count,
        updated_at: item.updated_at,
      })),
      activity_available: account.user.role !== "employee",
      activity: state.activities.filter((item) => ["employee", "user"].includes(item.entity_type)),
    },
  };
}

const server = http.createServer(async (request, response) => {
  try {
    cors(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${host}:${port}`);
    const path = url.pathname;

    if (path === "/__e2e/health" && request.method === "GET") {
      json(request, response, 200, { status: "ok" });
      return;
    }
    if (path === "/__e2e/seed" && request.method === "POST") {
      const payload = await readJson(request);
      const testId = String(payload.test_id ?? randomUUID());
      cleanupWorkspace(testId);
      json(request, response, 201, clientState(seedWorkspace(testId)));
      return;
    }
    const cleanupMatch = path.match(/^\/__e2e\/state\/([^/]+)$/);
    if (cleanupMatch && request.method === "DELETE") {
      cleanupWorkspace(decodeURIComponent(cleanupMatch[1]));
      noContent(request, response);
      return;
    }
    const documentStateMatch = path.match(/^\/__e2e\/state\/([^/]+)\/documents\/([^/]+)$/);
    if (documentStateMatch && request.method === "PATCH") {
      const state = workspaces.get(decodeURIComponent(documentStateMatch[1]));
      const payload = await readJson(request);
      const document = state?.documents.find((item) => item.id === documentStateMatch[2]);
      if (!state || !document) {
        notFound(request, response);
        return;
      }
      document.processing_status = payload.processing_status;
      document.updated_at = new Date().toISOString();
      json(request, response, 200, document);
      return;
    }
    const previewMatch = path.match(/^\/__e2e\/preview\/([^/]+)$/);
    if (previewMatch && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Authorized launch policy preview");
      return;
    }

    if (path === "/auth/login" && request.method === "POST") {
      const payload = await readJson(request);
      const record = accountsByEmail.get(String(payload.email ?? ""));
      if (!record || payload.password !== record.account.password) {
        json(request, response, 401, { detail: "Invalid email or password" });
        return;
      }
      json(request, response, 200, record.account.tokens);
      return;
    }
    if (path === "/auth/refresh" && request.method === "POST") {
      const payload = await readJson(request);
      const session = sessionsByToken.get(String(payload.refresh_token ?? ""));
      if (!session) {
        json(request, response, 401, { detail: "Refresh token is invalid" });
        return;
      }
      json(request, response, 200, session.account.tokens);
      return;
    }

    const authenticated = authenticate(request);
    if (!authenticated) {
      json(request, response, 401, { detail: "Authentication is required" });
      return;
    }
    const { state, account } = authenticated;

    if (path === "/users/me" && request.method === "GET") {
      json(request, response, 200, account.user);
      return;
    }
    if (path === "/companies/me" && request.method === "GET") {
      json(request, response, 200, account.company);
      return;
    }
    if (path === "/dashboard/overview" && request.method === "GET") {
      json(request, response, 200, dashboardOverview(state, account));
      return;
    }
    if (path === "/departments" && request.method === "GET") {
      json(request, response, 200, state.departments.filter((item) => item.company_id === account.user.company_id));
      return;
    }

    if (path === "/employees" && request.method === "GET") {
      let items = state.employees.filter((item) => item.company_id === account.user.company_id);
      const search = url.searchParams.get("search");
      if (search) items = items.filter((item) => matches(`${item.first_name} ${item.last_name} ${item.email} ${item.job_title}`, search));
      const departmentId = url.searchParams.get("department_id");
      const role = url.searchParams.get("role");
      const status = url.searchParams.get("status");
      if (departmentId) items = items.filter((item) => item.department_id === departmentId);
      if (role) items = items.filter((item) => item.role === role);
      if (status) items = items.filter((item) => item.employment_status === status);
      items = sortByQuery(items, url.searchParams.get("sort"), "first_name");
      json(request, response, 200, paginate(items, url, 100));
      return;
    }
    const employeeMatch = path.match(/^\/employees\/([^/]+)$/);
    if (employeeMatch) {
      const employee = findTenantItem(state.employees.map((item) => ({ ...item, deleted: false })), employeeMatch[1], account);
      if (!employee) {
        notFound(request, response, "Employee was not found");
        return;
      }
      const stored = state.employees.find((item) => item.id === employee.id);
      if (request.method === "GET") {
        const publicEmployee = withoutFields(employee, ["deleted"]);
        json(request, response, 200, publicEmployee);
        return;
      }
      if (request.method === "PATCH") {
        if (account.user.role === "employee" && account.user.id !== stored.id) {
          permissionDenied(request, response);
          return;
        }
        Object.assign(stored, await readJson(request), { updated_at: new Date().toISOString() });
        json(request, response, 200, stored);
        return;
      }
    }

    if (path === "/customers") {
      if (account.user.role === "employee") {
        permissionDenied(request, response, "Customer records are available to managers and administrators");
        return;
      }
      if (request.method === "GET") {
        let items = state.customers.filter((item) => item.company_id === account.user.company_id && !item.deleted);
        const search = url.searchParams.get("search");
        if (search) items = items.filter((item) => matches(`${item.name} ${item.contact_name} ${item.email}`, search));
        const status = url.searchParams.get("status");
        const type = url.searchParams.get("customer_type");
        const tagId = url.searchParams.get("tag_id");
        if (status) items = items.filter((item) => item.status === status);
        if (type) items = items.filter((item) => item.customer_type === type);
        if (tagId) items = items.filter((item) => item.tag_ids.includes(tagId));
        items = sortByQuery(items, url.searchParams.get("sort"));
        json(request, response, 200, paginate(items.map((item) => publicCustomer(state, item)), url));
        return;
      }
      if (request.method === "POST") {
        const payload = await readJson(request);
        const item = {
          id: randomUUID(),
          company_id: account.user.company_id,
          customer_type: payload.customer_type,
          status: payload.status,
          name: payload.name,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          contact_name: payload.contact_name ?? null,
          notes: payload.notes ?? null,
          tag_ids: payload.tag_ids ?? [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false,
        };
        state.customers.push(item);
        addActivity(state, account, "customer", item.id, "created", `${item.name} was created`);
        json(request, response, 201, publicCustomer(state, item));
        return;
      }
    }
    const customerMatch = path.match(/^\/customers\/([^/]+)$/);
    if (customerMatch) {
      if (account.user.role === "employee") {
        permissionDenied(request, response);
        return;
      }
      const item = findTenantItem(state.customers, customerMatch[1], account);
      if (!item) {
        notFound(request, response, "Customer was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicCustomer(state, item));
        return;
      }
      if (request.method === "PATCH") {
        Object.assign(item, await readJson(request), { updated_at: new Date().toISOString() });
        addActivity(state, account, "customer", item.id, "updated", `${item.name} was updated`);
        json(request, response, 200, publicCustomer(state, item));
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        addActivity(state, account, "customer", item.id, "deleted", `${item.name} was deleted`);
        noContent(request, response);
        return;
      }
    }

    if (path === "/projects") {
      if (request.method === "GET") {
        let items = state.projects.filter((item) => item.company_id === account.user.company_id && !item.deleted);
        const visibleIds = visibleProjectIds(state, account);
        if (visibleIds) items = items.filter((item) => visibleIds.has(item.id));
        const search = url.searchParams.get("search");
        if (search) items = items.filter((item) => matches(`${item.name} ${item.description}`, search));
        for (const [parameter, key] of [["status", "status"], ["owner_id", "owner_id"], ["customer_id", "customer_id"]]) {
          const value = url.searchParams.get(parameter);
          if (value) items = items.filter((item) => item[key] === value);
        }
        const tagId = url.searchParams.get("tag_id");
        if (tagId) items = items.filter((item) => item.tag_ids.includes(tagId));
        items = sortByQuery(items, url.searchParams.get("sort"));
        json(request, response, 200, paginate(items.map((item) => publicProject(state, item)), url));
        return;
      }
      if (request.method === "POST") {
        if (account.user.role === "employee") {
          permissionDenied(request, response);
          return;
        }
        const payload = await readJson(request);
        const item = {
          id: randomUUID(),
          company_id: account.user.company_id,
          department_id: account.user.department_id,
          customer_id: payload.customer_id ?? null,
          owner_id: payload.owner_id ?? account.user.id,
          name: payload.name,
          description: payload.description ?? null,
          status: payload.status,
          start_date: payload.start_date ?? null,
          end_date: payload.end_date ?? null,
          tag_ids: payload.tag_ids ?? [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false,
        };
        state.projects.push(item);
        addActivity(state, account, "project", item.id, "created", `${item.name} was created`);
        json(request, response, 201, publicProject(state, item));
        return;
      }
    }
    const projectMatch = path.match(/^\/projects\/([^/]+)$/);
    if (projectMatch) {
      const item = findTenantItem(state.projects, projectMatch[1], account);
      const visibleIds = visibleProjectIds(state, account);
      if (!item || (visibleIds && !visibleIds.has(item.id))) {
        notFound(request, response, "Project was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicProject(state, item));
        return;
      }
      if (account.user.role === "employee") {
        permissionDenied(request, response);
        return;
      }
      if (request.method === "PATCH") {
        Object.assign(item, await readJson(request), { updated_at: new Date().toISOString() });
        addActivity(state, account, "project", item.id, "updated", `${item.name} was updated`);
        json(request, response, 200, publicProject(state, item));
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        addActivity(state, account, "project", item.id, "deleted", `${item.name} was deleted`);
        noContent(request, response);
        return;
      }
    }

    if (path === "/tasks") {
      if (request.method === "GET") {
        let items = state.tasks.filter((item) => item.company_id === account.user.company_id && !item.deleted);
        if (account.user.role === "employee") items = items.filter((item) => item.assignee_id === account.user.id);
        const search = url.searchParams.get("search");
        if (search) items = items.filter((item) => matches(`${item.title} ${item.description}`, search));
        for (const [parameter, key] of [["status", "status"], ["priority", "priority"], ["assignee_id", "assignee_id"], ["project_id", "project_id"]]) {
          const value = url.searchParams.get(parameter);
          if (value) items = items.filter((item) => item[key] === value);
        }
        const tagId = url.searchParams.get("tag_id");
        if (tagId) items = items.filter((item) => item.tag_ids.includes(tagId));
        items = sortByQuery(items, url.searchParams.get("sort"), "title");
        json(request, response, 200, paginate(items.map((item) => publicTask(state, item)), url, 100));
        return;
      }
      if (request.method === "POST") {
        if (account.user.role === "employee") {
          permissionDenied(request, response);
          return;
        }
        const payload = await readJson(request);
        const project = findTenantItem(state.projects, payload.project_id, account);
        if (!project) {
          notFound(request, response, "Project was not found");
          return;
        }
        const item = {
          id: randomUUID(),
          company_id: account.user.company_id,
          project_id: payload.project_id,
          assignee_id: payload.assignee_id ?? null,
          created_by_user_id: account.user.id,
          title: payload.title,
          description: payload.description ?? null,
          status: payload.status,
          priority: payload.priority,
          progress: payload.progress,
          due_date: payload.due_date ?? null,
          tag_ids: payload.tag_ids ?? [],
          comments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false,
        };
        state.tasks.push(item);
        addActivity(state, account, "task", item.id, "created", `${item.title} was created`);
        json(request, response, 201, publicTask(state, item));
        return;
      }
    }
    const taskCommentMatch = path.match(/^\/tasks\/([^/]+)\/comments$/);
    if (taskCommentMatch && request.method === "POST") {
      const item = findTenantItem(state.tasks, taskCommentMatch[1], account);
      if (!item || (account.user.role === "employee" && item.assignee_id !== account.user.id)) {
        notFound(request, response, "Task was not found");
        return;
      }
      const payload = await readJson(request);
      const comment = {
        id: randomUUID(),
        task_id: item.id,
        author_id: account.user.id,
        body: payload.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      item.comments.push(comment);
      json(request, response, 201, comment);
      return;
    }
    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const item = findTenantItem(state.tasks, taskMatch[1], account);
      if (!item || (account.user.role === "employee" && item.assignee_id !== account.user.id)) {
        notFound(request, response, "Task was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicTask(state, item, true));
        return;
      }
      if (request.method === "PATCH") {
        const payload = await readJson(request);
        if (account.user.role === "employee") {
          const keys = Object.keys(payload);
          if (keys.some((key) => !["status", "progress"].includes(key))) {
            permissionDenied(request, response);
            return;
          }
        }
        Object.assign(item, payload, { updated_at: new Date().toISOString() });
        addActivity(state, account, "task", item.id, "updated", `${item.title} was updated`);
        json(request, response, 200, publicTask(state, item));
        return;
      }
      if (request.method === "DELETE") {
        if (account.user.role === "employee") {
          permissionDenied(request, response);
          return;
        }
        item.deleted = true;
        addActivity(state, account, "task", item.id, "deleted", `${item.title} was deleted`);
        noContent(request, response);
        return;
      }
    }

    if (path === "/notes") {
      if (request.method === "GET") {
        let items = state.notes.filter((item) => item.company_id === account.user.company_id && !item.deleted);
        if (account.user.role === "employee") items = items.filter((item) => item.owner_id === account.user.id || item.scope !== "personal");
        const search = url.searchParams.get("search");
        if (search) items = items.filter((item) => matches(`${item.title} ${item.body}`, search));
        const mapping = {
          scope: "scope",
          project_id: "project_id",
          owner_id: "owner_id",
          employee_id: "employee_id",
          customer_id: "customer_id",
          task_id: "task_id",
          document_id: "document_id",
        };
        for (const [parameter, key] of Object.entries(mapping)) {
          const value = url.searchParams.get(parameter);
          if (value) items = items.filter((item) => item[key] === value);
        }
        const tagId = url.searchParams.get("tag_id");
        if (tagId) items = items.filter((item) => item.tag_ids.includes(tagId));
        items = sortByQuery(items, url.searchParams.get("sort"), "title");
        json(request, response, 200, paginate(items.map((item) => publicNote(state, item)), url, 100));
        return;
      }
      if (request.method === "POST") {
        const payload = await readJson(request);
        const item = {
          id: randomUUID(),
          company_id: account.user.company_id,
          project_id: payload.project_id ?? null,
          owner_id: account.user.id,
          employee_id: payload.employee_id ?? null,
          customer_id: payload.customer_id ?? null,
          task_id: payload.task_id ?? null,
          document_id: payload.document_id ?? null,
          scope: payload.scope,
          title: payload.title,
          body: payload.body,
          tag_ids: payload.tag_ids ?? [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false,
        };
        state.notes.push(item);
        addActivity(state, account, "note", item.id, "created", `${item.title} was created`);
        json(request, response, 201, publicNote(state, item));
        return;
      }
    }
    const noteMatch = path.match(/^\/notes\/([^/]+)$/);
    if (noteMatch) {
      const item = findTenantItem(state.notes, noteMatch[1], account);
      if (!item || (account.user.role === "employee" && item.owner_id !== account.user.id && item.scope === "personal")) {
        notFound(request, response, "Note was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicNote(state, item));
        return;
      }
      if (request.method === "PATCH") {
        Object.assign(item, await readJson(request), { updated_at: new Date().toISOString() });
        addActivity(state, account, "note", item.id, "updated", `${item.title} was updated`);
        json(request, response, 200, publicNote(state, item));
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        addActivity(state, account, "note", item.id, "deleted", `${item.title} was deleted`);
        noContent(request, response);
        return;
      }
    }

    if (path === "/tags") {
      if (request.method === "GET") {
        let items = state.tags.filter((item) => item.company_id === account.user.company_id && !item.deleted);
        const search = url.searchParams.get("search");
        if (search) items = items.filter((item) => matches(item.name, search));
        items.sort((a, b) => a.name.localeCompare(b.name));
        json(request, response, 200, paginate(items.map((item) => publicTag(state, item)), url, 100));
        return;
      }
      if (request.method === "POST") {
        if (account.user.role === "employee") {
          permissionDenied(request, response);
          return;
        }
        const payload = await readJson(request);
        const item = { id: randomUUID(), company_id: account.user.company_id, name: payload.name, color: payload.color ?? null, deleted: false };
        state.tags.push(item);
        addActivity(state, account, "tag", item.id, "created", `${item.name} was created`);
        json(request, response, 201, publicTag(state, item));
        return;
      }
    }
    const tagMatch = path.match(/^\/tags\/([^/]+)$/);
    if (tagMatch) {
      const item = findTenantItem(state.tags, tagMatch[1], account);
      if (!item) {
        notFound(request, response, "Tag was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicTag(state, item));
        return;
      }
      if (account.user.role === "employee") {
        permissionDenied(request, response);
        return;
      }
      if (request.method === "PATCH") {
        Object.assign(item, await readJson(request));
        addActivity(state, account, "tag", item.id, "updated", `${item.name} was updated`);
        json(request, response, 200, publicTag(state, item));
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        for (const collection of [state.customers, state.projects, state.tasks, state.notes]) {
          for (const entity of collection) entity.tag_ids = entity.tag_ids.filter((id) => id !== item.id);
        }
        addActivity(state, account, "tag", item.id, "deleted", `${item.name} was deleted`);
        noContent(request, response);
        return;
      }
    }

    if (path === "/activity" && request.method === "GET") {
      if (account.user.role === "employee") {
        permissionDenied(request, response, "Activity is available to managers and administrators");
        return;
      }
      let items = state.activities.filter((item) => item.company_id === account.user.company_id);
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id");
      if (entityType) items = items.filter((item) => item.entity_type === entityType);
      if (entityId) items = items.filter((item) => item.entity_id === entityId);
      json(request, response, 200, paginate(items, url, 8));
      return;
    }

    if (path === "/folders" && request.method === "GET") {
      json(request, response, 200, state.folders.filter((item) => item.company_id === account.user.company_id));
      return;
    }
    if (path === "/folders" && request.method === "POST") {
      const payload = await readJson(request);
      const item = {
        id: randomUUID(),
        company_id: account.user.company_id,
        parent_id: payload.parent_id ?? null,
        owner_id: account.user.id,
        department_id: null,
        name: payload.name,
        visibility: payload.visibility,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.folders.push(item);
      json(request, response, 201, item);
      return;
    }

    if (path === "/documents/favorites/list" && request.method === "GET") {
      const items = state.documents.filter((item) => item.company_id === account.user.company_id && !item.deleted && state.favoriteIds.has(item.id));
      json(request, response, 200, items);
      return;
    }
    if (path === "/documents/recent/list" && request.method === "GET") {
      const items = state.recentIds.map((id) => state.documents.find((item) => item.id === id)).filter((item) => item && item.company_id === account.user.company_id && !item.deleted);
      json(request, response, 200, items);
      return;
    }
    if (path === "/documents" && request.method === "GET") {
      let items = state.documents.filter((item) => item.company_id === account.user.company_id && !item.deleted);
      const query = url.searchParams.get("q");
      const folderId = url.searchParams.get("folder_id");
      const ownerId = url.searchParams.get("owner_id");
      const customerId = url.searchParams.get("customer_id");
      if (query) items = items.filter((item) => matches(`${item.title} ${item.filename} ${item.tags.map((tag) => tag.name).join(" ")}`, query));
      if (folderId) items = items.filter((item) => item.folder_id === folderId);
      if (ownerId) items = items.filter((item) => item.owner_id === ownerId);
      if (customerId) items = items.filter((item) => item.customer_id === customerId);
      json(request, response, 200, paginate(items, url, 100));
      return;
    }
    if (path === "/documents/upload" && request.method === "POST") {
      const raw = (await readBuffer(request)).toString("latin1");
      const match = raw.match(/filename="([^"]+)"/i);
      const filename = match?.[1] ?? "uploaded-file.txt";
      const item = {
        id: randomUUID(),
        company_id: account.user.company_id,
        folder_id: null,
        owner_id: account.user.id,
        department_id: account.user.department_id,
        customer_id: null,
        title: filename,
        filename,
        mime_type: filename.endsWith(".txt") ? "text/plain" : "application/octet-stream",
        size_bytes: Math.max(1, Buffer.byteLength(raw)),
        description: null,
        visibility: "private",
        status: "active",
        version: 1,
        processing_status: "processing",
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false,
      };
      state.documents.unshift(item);
      state.recentIds.unshift(item.id);
      addActivity(state, account, "document", item.id, "created", `${item.title} was uploaded`);
      json(request, response, 201, item);
      return;
    }
    const documentVersionsMatch = path.match(/^\/documents\/([^/]+)\/versions$/);
    if (documentVersionsMatch && request.method === "GET") {
      const item = findTenantItem(state.documents, documentVersionsMatch[1], account);
      if (!item) {
        notFound(request, response, "Document was not found");
        return;
      }
      json(request, response, 200, [{
        id: randomUUID(),
        version: item.version,
        filename: item.filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        uploaded_by_user_id: item.owner_id,
        created_at: item.created_at,
      }]);
      return;
    }
    const documentSignedMatch = path.match(/^\/documents\/([^/]+)\/signed-url$/);
    if (documentSignedMatch && request.method === "GET") {
      const item = findTenantItem(state.documents, documentSignedMatch[1], account);
      if (!item) {
        notFound(request, response, "Document was not found");
        return;
      }
      json(request, response, 200, { url: `http://${host}:${port}/__e2e/preview/${item.id}`, expires_in_seconds: 300 });
      return;
    }
    const documentFavoriteMatch = path.match(/^\/documents\/([^/]+)\/favorite$/);
    if (documentFavoriteMatch && ["POST", "DELETE"].includes(request.method)) {
      const item = findTenantItem(state.documents, documentFavoriteMatch[1], account);
      if (!item) {
        notFound(request, response, "Document was not found");
        return;
      }
      if (request.method === "POST") state.favoriteIds.add(item.id);
      else state.favoriteIds.delete(item.id);
      noContent(request, response);
      return;
    }
    const documentDownloadMatch = path.match(/^\/documents\/([^/]+)\/download$/);
    if (documentDownloadMatch && request.method === "GET") {
      const item = findTenantItem(state.documents, documentDownloadMatch[1], account);
      if (!item) {
        notFound(request, response, "Document was not found");
        return;
      }
      cors(request, response);
      response.writeHead(200, {
        "Content-Type": item.mime_type,
        "Content-Disposition": `attachment; filename="${item.filename}"`,
      });
      response.end(`Authorized contents for ${item.title}`);
      return;
    }
    const documentMatch = path.match(/^\/documents\/([^/]+)$/);
    if (documentMatch) {
      const item = findTenantItem(state.documents, documentMatch[1], account);
      if (!item) {
        notFound(request, response, "Document was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, item);
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        state.favoriteIds.delete(item.id);
        noContent(request, response);
        return;
      }
    }

    if (path === "/conversations" && request.method === "GET") {
      let items = state.conversations.filter((item) => item.company_id === account.user.company_id && item.owner_id === account.user.id && !item.deleted);
      const search = url.searchParams.get("search");
      if (search) items = items.filter((item) => matches(item.title, search) || item.messages.some((message) => matches(message.content, search)));
      items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      json(request, response, 200, paginate(items.map((item) => publicConversation(item)), url, 20));
      return;
    }
    if (path === "/conversations" && request.method === "POST") {
      const payload = await readJson(request);
      const item = {
        id: randomUUID(),
        company_id: account.user.company_id,
        owner_id: account.user.id,
        title: payload.title ?? null,
        last_message_preview: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
        deleted: false,
      };
      state.conversations.unshift(item);
      json(request, response, 201, publicConversation(item));
      return;
    }
    const conversationMatch = path.match(/^\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const item = state.conversations.find((conversation) => conversation.id === conversationMatch[1] && conversation.company_id === account.user.company_id && conversation.owner_id === account.user.id && !conversation.deleted);
      if (!item) {
        notFound(request, response, "Conversation was not found");
        return;
      }
      if (request.method === "GET") {
        json(request, response, 200, publicConversation(item, true));
        return;
      }
      if (request.method === "PATCH") {
        const payload = await readJson(request);
        item.title = payload.title;
        item.updated_at = new Date().toISOString();
        json(request, response, 200, publicConversation(item));
        return;
      }
      if (request.method === "DELETE") {
        item.deleted = true;
        noContent(request, response);
        return;
      }
    }

    if (path === "/chat/stream" && request.method === "POST") {
      const payload = await readJson(request);
      const conversation = state.conversations.find((item) => item.id === payload.conversation_id && item.owner_id === account.user.id && !item.deleted);
      if (!conversation) {
        notFound(request, response, "Conversation was not found");
        return;
      }
      const citations = matches(payload.content, "without sources") ? [] : [state.citation];
      const userMessage = {
        id: randomUUID(),
        conversation_id: conversation.id,
        role: "user",
        content: payload.content,
        citations: [],
        created_at: new Date().toISOString(),
      };
      const assistantId = randomUUID();
      conversation.messages.push(userMessage);
      const content = citations.length ? "Streaming answer with citations." : "Streaming answer without sources.";
      const tokens = citations.length ? ["Streaming ", "answer ", "with citations."] : ["Streaming ", "answer ", "without sources."];
      stream(request, response, tokens, { message_id: assistantId, citations }, () => {
        conversation.messages.push({
          id: assistantId,
          conversation_id: conversation.id,
          role: "assistant",
          content,
          citations,
          created_at: new Date().toISOString(),
        });
        conversation.title ??= payload.content.split(/\s+/).slice(0, 8).join(" ");
        conversation.last_message_preview = content;
        conversation.updated_at = new Date().toISOString();
      });
      return;
    }
    if (path === "/chat/regenerate/stream" && request.method === "POST") {
      const payload = await readJson(request);
      const conversation = state.conversations.find((item) => item.id === payload.conversation_id && item.owner_id === account.user.id && !item.deleted);
      const assistant = conversation?.messages.find((message) => message.id === payload.assistant_message_id && message.role === "assistant");
      if (!conversation || !assistant) {
        notFound(request, response, "Assistant message was not found");
        return;
      }
      stream(request, response, ["Regenerated ", "answer ", "in place."], { message_id: assistant.id, citations: [state.citation] }, () => {
        assistant.content = "Regenerated answer in place.";
        assistant.citations = [state.citation];
        conversation.last_message_preview = assistant.content;
        conversation.updated_at = new Date().toISOString();
      });
      return;
    }

    notFound(request, response, `No E2E fixture exists for ${request.method} ${path}`);
  } catch (error) {
    json(request, response, 500, { detail: error instanceof Error ? error.message : "Mock API failure" });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Orbit E2E mock API listening on http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
