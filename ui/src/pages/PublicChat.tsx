/**
 * PublicChat — Ephemeral agent chat page (no auth required).
 *
 * Customer clicks a time-limited link from email → lands here.
 * Messages are issue comments. Polls every 3s for new agent replies.
 * Shows countdown timer, agent profile, original email context.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { MarkdownBody } from "../components/MarkdownBody";
import { cn } from "../lib/utils";
import {
  Send,
  Clock,
  Shield,
  MessageCircle,
  AlertCircle,
  User,
  Bot,
} from "lucide-react";

const API_BASE = "/api";

interface SessionInfo {
  sessionId: string;
  issueId: string;
  companyId: string;
  agentName: string;
  agentTitle: string;
  agentIcon: string;
  agentRole: string;
  agentMetadata: Record<string, unknown>;
  customerName: string | null;
  customerEmail: string;
  expiresAt: string;
  messageCount: number;
  maxMessages: number;
}

interface ChatMessage {
  id: string;
  role: "agent" | "customer";
  body: string;
  createdAt: string;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getIdentity(metadata: Record<string, unknown>) {
  const id = metadata?.identity as Record<string, string> | undefined;
  return {
    arabicName: id?.arabicName ?? "",
    character: id?.character ?? "",
    email: id?.email ?? "",
  };
}

export default function PublicChat() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch session info
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/chat/${token}`)
      .then((r) => {
        if (r.status === 403) { setExpired(true); return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => { if (data) setSession(data); })
      .catch((e) => setError(e.message));
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!session) return;
    const update = () => {
      const diff = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) { setExpired(true); setSecondsLeft(0); return; }
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Poll messages every 3s
  useEffect(() => {
    if (!token || expired) return;
    const fetchMessages = () => {
      fetch(`${API_BASE}/chat/${token}/messages`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.messages) setMessages(data.messages); });
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [token, expired]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!token || !input.trim() || sending || expired) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/chat/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: input.trim() }),
      });
      if (res.status === 429) {
        setError("Message limit reached for this session.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setInput("");
      inputRef.current?.focus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }, [token, input, sending, expired]);

  const totalSeconds = session ? 60 * 60 : 1;
  const timerPct = Math.max(0, (secondsLeft / totalSeconds) * 100);
  const timerColor = secondsLeft < 300 ? "text-red-400" : secondsLeft < 900 ? "text-amber-400" : "text-foreground";
  const barColor = secondsLeft < 300 ? "bg-red-500" : secondsLeft < 900 ? "bg-amber-500" : "bg-indigo-500";
  const identity = session ? getIdentity(session.agentMetadata) : null;

  // Expired overlay
  if (expired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
            <Clock className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Session Expired</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            This chat session has ended. Your conversation has been saved
            and your agent will follow up via email.
          </p>
          <a
            href="mailto:sanad.ai@optiflowsys.com"
            className="inline-flex items-center gap-2 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-indigo-400 hover:bg-muted/80"
          >
            <MessageCircle className="h-4 w-4" />
            sanad.ai@optiflowsys.com
          </a>
        </div>
      </div>
    );
  }

  // Loading
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {error ? <span className="text-red-400">{error}</span> : "Connecting..."}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex">
      {/* ── Sidebar ── */}
      <div className="w-[320px] shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto hidden lg:flex">
        {/* Brand */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">S</div>
            <div>
              <div className="text-sm font-bold">Sanad AI</div>
              <div className="text-[10px] text-muted-foreground">Optiflow Systems</div>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Session expires in</span>
              <span className={cn("text-lg font-bold font-mono tabular-nums", timerColor)}>
                {formatTime(secondsLeft)}
              </span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", barColor)} style={{ width: `${timerPct}%` }} />
            </div>
          </div>
        </div>

        {/* Agent */}
        <div className="p-5 border-b border-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2.5">Your Agent</div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {session.agentName}
                {identity?.arabicName && (
                  <span className="text-xs text-muted-foreground ml-1.5">{identity.arabicName}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{session.agentTitle}</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Online
              </div>
            </div>
          </div>
          {identity?.character && (
            <p className="text-[11px] text-muted-foreground mt-2 italic">"{identity.character}"</p>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-green-500 bg-green-500/10 rounded px-2 py-1">
            <Shield className="h-3 w-3" /> Secure encrypted session
          </div>
        </div>

        {/* Session info */}
        <div className="p-5 text-xs text-muted-foreground space-y-2">
          <div className="flex justify-between">
            <span>Messages</span>
            <span>{session.messageCount} / {session.maxMessages}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer</span>
            <span className="text-foreground">{session.customerName || session.customerEmail}</span>
          </div>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border bg-card flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-semibold">{session.agentName} — {session.agentTitle}</div>
          </div>
          <div className="ml-auto lg:hidden">
            <span className={cn("text-sm font-mono font-bold tabular-nums", timerColor)}>
              {formatTime(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* System message */}
          <div className="text-center">
            <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
              <Shield className="inline h-3 w-3 mr-1" />
              Secure session started
            </span>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2.5 max-w-[75%]", msg.role === "customer" ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs",
                msg.role === "agent" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {msg.role === "agent" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div>
                <div className={cn(
                  "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "agent"
                    ? "bg-muted border border-border rounded-tl-sm"
                    : "bg-indigo-600 text-white rounded-tr-sm"
                )}>
                  {msg.role === "agent" ? <MarkdownBody markdown={msg.body} /> : msg.body}
                </div>
                <div className={cn("text-[10px] text-muted-foreground mt-1 px-1", msg.role === "customer" && "text-right")}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border bg-card">
          <div className="flex items-end gap-2.5 bg-muted border border-border rounded-xl px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-sm resize-none min-h-[20px] max-h-[120px] placeholder:text-muted-foreground/50"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-indigo-500 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[10px] text-muted-foreground/50">
            Powered by <strong>Sanad AI</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
