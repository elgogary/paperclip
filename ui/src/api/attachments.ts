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
  htmlPreviewKey: string | null;
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

  uploadChunk: (
    attachmentId: string,
    chunk: Blob,
    start: number,
    total: number,
  ): Promise<void> => {
    const end = start + chunk.size - 1;
    return api.putRaw<void>(`/attachments/${attachmentId}/chunk`, chunk, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Type": "application/octet-stream",
    });
  },

  completeUpload: (attachmentId: string, commentId?: string | null) =>
    api.post<CompleteUploadResult>(`/attachments/${attachmentId}/complete`, {
      ...(commentId ? { commentId } : {}),
    }),
};
