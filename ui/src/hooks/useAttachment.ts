import { useEffect, useState } from "react";
import { attachmentsApi, type AttachmentMeta } from "../api/attachments";

interface UseAttachmentResult {
  attachment: AttachmentMeta | null;
  loading: boolean;
  error: boolean;
}

export function useAttachment(attachmentId: string): UseAttachmentResult {
  const [attachment, setAttachment] = useState<AttachmentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    setAttachment(null);
    setLoading(true);
    setError(false);

    attachmentsApi
      .get(attachmentId, { signal: controller.signal })
      .then((data) => {
        if (mounted) setAttachment(data);
      })
      .catch((err: unknown) => {
        if (mounted && (err as { name?: string }).name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [attachmentId]);

  return { attachment, loading, error };
}
