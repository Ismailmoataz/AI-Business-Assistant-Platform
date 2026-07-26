import { api, apiErrorFromResponse, authorizedFetch } from "./client";
import { useAuthStore } from "@/stores/auth-store";
import type { DocumentItem, DocumentPage, DocumentVersion, Folder, UploadInput } from "@/lib/types/documents";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const documentsApi = {
  list(params: { q?: string; folderId?: string | null; ownerId?: string; customerId?: string; offset?: number; limit?: number } = {}) {
    const query = new URLSearchParams({ offset: String(params.offset ?? 0), limit: String(params.limit ?? 100) });
    if (params.q) query.set("q", params.q);
    if (params.folderId) query.set("folder_id", params.folderId);
    if (params.ownerId) query.set("owner_id", params.ownerId);
    if (params.customerId) query.set("customer_id", params.customerId);
    return api<DocumentPage>(`/documents?${query}`);
  },
  folders: () => api<Folder[]>("/folders"),
  createFolder: (name: string, parentId: string | null) => api<Folder>("/folders", { method: "POST", body: JSON.stringify({ name, parent_id: parentId, visibility: "private" }) }),
  favorites: () => api<DocumentItem[]>("/documents/favorites/list"),
  recents: () => api<DocumentItem[]>("/documents/recent/list"),
  versions: (id: string) => api<DocumentVersion[]>(`/documents/${id}/versions`),
  signedUrl: (id: string) => api<{ url: string; expires_in_seconds: number }>(`/documents/${id}/signed-url`),
  favorite: (id: string, enabled: boolean) => api<void>(`/documents/${id}/favorite`, { method: enabled ? "POST" : "DELETE" }),
  remove: (id: string) => api<void>(`/documents/${id}`, { method: "DELETE" }),
  upload(input: UploadInput, onProgress: (value: number) => void, signal: AbortSignal): Promise<DocumentItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", input.file); form.append("title", input.file.name);
      form.append("visibility", input.visibility ?? "private");
      if (input.folderId) form.append("folder_id", input.folderId);
      xhr.open("POST", `${API_URL}/documents/upload`);
      const token = useAuthStore.getState().tokens?.access_token;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText) as DocumentItem) : reject(new Error("Upload failed. Please try again."));
      xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(form);
    });
  },
  async download(documentId: string): Promise<Blob> {
    const response = await authorizedFetch(`/documents/${documentId}/download`, {
      headers: { Accept: "*/*" },
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return response.blob();
  },
};
