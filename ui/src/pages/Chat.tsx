import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useEffect } from "react";
import { ChatView } from "../components/chat/ChatView";

export default function Chat() {
  const params = useParams();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  return (
    <ChatView
      initialAgentId={params.agentId}
      initialIssueId={params.issueId}
    />
  );
}
