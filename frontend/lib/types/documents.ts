export type Visibility = "private" | "department" | "company";
export type ProcessingStatus = "uploaded" | "processing" | "ready" | "failed";

export interface Tag { id: string; name: string }
export interface Folder {
  id: string; parent_id: string | null; owner_id: string; department_id: string | null;
  name: string; visibility: Visibility; created_at: string; updated_at: string;
}
export interface DocumentItem {
  id: string; folder_id: string | null; owner_id: string; department_id: string | null; customer_id: string | null;
  title: string; filename: string; mime_type: string; size_bytes: number; description: string | null;
  visibility: Visibility; status: "active" | "archived"; version: number;
  processing_status: ProcessingStatus; tags: Tag[]; created_at: string; updated_at: string;
}
export interface DocumentPage { items: DocumentItem[]; page: { offset: number; limit: number; total: number } }
export interface DocumentVersion { id: string; version: number; filename: string; mime_type: string; size_bytes: number; uploaded_by_user_id: string; created_at: string }
export interface UploadInput { file: File; folderId?: string | null; visibility?: Visibility }
