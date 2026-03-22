import { useState } from "react";
import { useEffect } from "react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { MarkdownBody } from "../components/MarkdownBody";
import { SanadLogo } from "../components/SanadLogo";
import {
  BookOpen,
  MessageSquare,
  Shield,
  Users,
  Wrench,
  Cpu,
  FileText,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";

type DocSection = {
  id: string;
  title: string;
  icon: typeof BookOpen;
  content: string;
};

const DOCS: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: `# Sanad AI EOI

**Enterprise Operational Intelligence** — AI agent crew coordination platform.

Sanad AI EOI manages your autonomous AI agent crew: task assignment, heartbeat monitoring, approvals, budgets, and real-time chat. Each agent runs Claude Code (or other LLM adapters) and reports back through the Paperclip heartbeat protocol.

## Key Concepts

- **Company** — Your organization. Agents, projects, and issues belong to a company.
- **Agent** — An AI worker with a role (CEO, CTO, Engineer, etc.), budget, and instructions (SOUL.md).
- **Issue** — A task assigned to an agent. Agents pick up issues via heartbeat and work autonomously.
- **Heartbeat** — The agent lifecycle: wake → read task → work → report → sleep. Runs are logged with cost, tokens, and duration.
- **Approval** — Write operations that need human review before execution.
`,
  },
  {
    id: "chat",
    title: "Chat",
    icon: MessageSquare,
    content: `# Chat

Chat with any agent in real-time. Messages are stored as issue comments — the agent wakes, reads your message, and responds.

## How to Use

1. Click the **S** button (bottom-right FAB) or go to **Chat** in the sidebar
2. Select an agent
3. Start or continue a conversation
4. The agent wakes automatically when you send a message

## Features

- **Markdown rendering** — agent responses render with syntax highlighting and Mermaid diagrams
- **Slash commands** — \`/help\`, \`/clear\`, \`/status\`, \`/retry\`
- **Voice input** — click the mic icon, supports Arabic and English
- **File attachments** — attach images to your messages
- **Quick suggestions** — context-aware prompts based on agent role
- **Copy message** — hover any message to copy its text
- **Export** — download conversation as markdown
- **Debug panel** — see agent status, cost, tokens, tool calls, and budget in real-time
`,
  },
  {
    id: "agents",
    title: "Agents",
    icon: Cpu,
    content: `# Agents

Each agent has a role, model, budget, and instruction file (SOUL.md).

## Agent Tabs

| Tab | What it shows |
|-----|---------------|
| **Dashboard** | Status, recent runs, cost summary |
| **Configuration** | Model, adapter, runtime settings |
| **Runs** | Heartbeat run history with logs and events |
| **Access** | Per-user access control (who can see this agent) |
| **Instructions** | Read the agent's SOUL.md + add improvement notes |

## Models

Switch agent models anytime from the Debug panel or Configuration tab:
- **Claude Opus** — most capable, highest cost
- **Claude Sonnet** — balanced performance and cost
- **Claude Haiku** — fastest, lowest cost

## Budget

Each agent has a monthly budget in cents. The Debug panel shows a progress bar with spent vs. allocated. Agents stop when budget is exhausted.
`,
  },
  {
    id: "access",
    title: "Access Control",
    icon: Shield,
    content: `# Per-Agent Access Control

Restrict which users can see and interact with specific agents.

## How It Works

1. Go to any agent → **Access** tab
2. Click **Add User** → select from company members
3. Once ANY user is added, only listed users can see that agent

## Rules

- **No grants** = everyone sees the agent (default, backwards-compatible)
- **Any grants** = only listed users see the agent
- **Instance admins** always see all agents (bypass)
- Access is enforced server-side on the agent list API

## Use Case

Dev users shouldn't see sales agents. Sales users shouldn't see engineering agents. Add the right users to each agent's access list.
`,
  },
  {
    id: "instructions",
    title: "Instructions",
    icon: FileText,
    content: `# Agent Instructions

Each agent has a SOUL.md file that defines its personality, capabilities, and rules.

## Instructions Tab

Go to any agent → **Instructions** tab to:
- **Read** the full SOUL.md rendered as markdown
- **Add notes** for the next improvement cycle (right panel)
- **Delete notes** when they've been addressed

## Improvement Cycle

1. Watch the agent work via Chat or Runs
2. Notice areas for improvement
3. Add notes on the Instructions tab
4. Edit the agent's SOUL.md (in the container at \`/workspace/.agents/<role>/SOUL.md\`)
5. Delete addressed notes
`,
  },
  {
    id: "issues",
    title: "Issues & Tasks",
    icon: Wrench,
    content: `# Issues & Tasks

Issues are the work units that agents execute.

## Creating Issues

- **From Chat** — conversations auto-create issues assigned to the agent
- **From Issues page** — click "New Issue" with title, description, assignee
- **From API** — \`POST /api/companies/:id/issues\`

## Issue Lifecycle

\`\`\`
todo → in_progress → done
         ↓
       blocked
\`\`\`

Agents pick up \`todo\` issues during heartbeat, move to \`in_progress\`, and mark \`done\` when complete. If stuck, they set \`blocked\` with a reason.

## Projects

Issues can belong to a project. Projects have workspaces that define the working directory for agents. Chat conversations should always be assigned to a project to avoid workspace resolution issues.
`,
  },
  {
    id: "crew",
    title: "Crew Structure",
    icon: Users,
    content: `# Agent Crew Structure

Agents form a hierarchy with reporting lines.

\`\`\`
Board (You)
└── CEO → Strategy, budgets, team coordination
    ├── TechLead (CTO) → Code review, architecture
    │   ├── BackendEngineer → APIs, Python, TDD
    │   └── FrontendEngineer → React, UI, a11y
    ├── SalesManager → Pipeline, deals, revenue
    │   └── SalesRep → Prospecting, demos
    ├── ProductManager → Roadmap, beta, metrics
    │   └── BetaTester (QA) → Testing, bugs
    └── DevOps → Deployments, monitoring
\`\`\`

## Task Routing

| Task type | Route to |
|-----------|----------|
| Code/architecture | TechLead → Engineers |
| Sales/leads | SalesManager → SalesRep |
| Product/roadmap | ProductManager → BetaTester |
| Deploy/infra | DevOps |
| Strategy/planning | CEO |

## Agent Files

Each agent has 4 files in \`/workspace/.agents/<role>/\`:
- **SOUL.md** — personality, rules, capabilities
- **HEARTBEAT.md** — heartbeat protocol instructions
- **SKILLS.md** — available skills and tools
- **LESSONS.md** — learned patterns from past work
`,
  },
  {
    id: "debug",
    title: "Debug Panel",
    icon: Zap,
    content: `# Debug Panel

The debug panel (right side of chat) shows real-time agent telemetry.

## Sections

| Section | What it shows |
|---------|---------------|
| **Agent Overview** | Status, role badge, adapter, max turns, heartbeat interval, last run |
| **Monthly Budget** | Spent vs. allocated with progress bar |
| **Capabilities** | Agent's capability tags from config |
| **Instructions** | Path to SOUL.md file |
| **Model** | Current model with dropdown to switch |
| **Current Run** | Cost, tokens (in/out/cached), duration, tool calls, lessons |
| **Events** | Live event log from the current run |

## Model Switching

Change the agent's model mid-conversation from the Debug panel dropdown. Takes effect on the next heartbeat run.
`,
  },
];

export function Docs() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    setBreadcrumbs([{ label: "Documentation" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const activeDoc = DOCS.find((d) => d.id === activeSection) ?? DOCS[0];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-[240px] shrink-0 border-r bg-card overflow-y-auto p-3">
        <div className="flex items-center gap-2 mb-4 px-2">
          <SanadLogo size={20} className="text-primary" />
          <span className="text-sm font-semibold">Documentation</span>
        </div>
        <nav className="space-y-0.5">
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            return (
              <button
                key={doc.id}
                onClick={() => setActiveSection(doc.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-all",
                  activeSection === doc.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{doc.title}</span>
                {activeSection === doc.id && (
                  <ChevronRight className="h-3 w-3 ml-auto" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <MarkdownBody className="prose prose-sm dark:prose-invert max-w-none">
            {activeDoc.content}
          </MarkdownBody>
        </div>
      </div>
    </div>
  );
}
