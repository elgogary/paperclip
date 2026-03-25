import { api } from "./client";

export interface AttachmentMeta {
  id: string;
  issueId: string;
  commentId: string | null;
  uploaderType: string;
  uploaderId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  versionOf: string | null;
  versionNum: number | null;
  status: "uploading" | "assembling" | "processing" | "ready" | "error";
  publishUrl: string | null;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  thumbnailUrl: string | null;
}

interface InitUploadParams {
  issueId: string;
  companyId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  commentId?: string | null;
}

interface InitUploadResult {
  uploadId: string;
  attachmentId: string;
}

interface CompleteUploadResult {
  url: string;
  attachmentId: string;
  status: AttachmentMeta["status"];
}

export const attachmentsApi = {
  get: (attachmentId: string, opts?: { signal?: AbortSignal }) =>
    api.get<AttachmentMeta>(`/attachments/${attachmentId}`, opts?.signal ? { signal: opts.signal } : undefined),

  delete: (attachmentId: string) =>
    api.delete<void>(`/attachments/${attachmentId}`),

  initUpload: (params: InitUploadParams) =>
    api.post<InitUploadResult>("/attachments/init", params),

  uploadChunk: async (
    attachmentId: string,
    chunk: Blob,
    start: number,
    total: number,
  ): Promise<void> => {
    const end = start + chunk.size - 1;
    const res = await fetch(`/api/attachments/${attachmentId}/chunk`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        (body as { error?: string } | null)?.error ?? `Chunk upload failed: ${res.status}`,
      );
    }
  },

  completeUpload: (attachmentId: string, commentId?: string | null) =>
    api.post<CompleteUploadResult>(`/attachments/${attachmentId}/complete`, {
      ...(commentId ? { commentId } : {}),
    }),
};
