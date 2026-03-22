import { useState, useEffect } from "react";
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
  ChevronDown,
  Server,
  Plug,
  Code,
  Terminal,
} from "lucide-react";
import { cn } from "../lib/utils";
import { DOC_SECTIONS, type DocSection, type DocPage } from "./docs-content";

const ICON_MAP: Record<string, typeof BookOpen> = {
  BookOpen,
  MessageSquare,
  Shield,
  Users,
  Wrench,
  Cpu,
  FileText,
  Zap,
  Server,
  Plug,
  Code,
  Terminal,
};

export function Docs() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [activeSectionId, setActiveSectionId] = useState(DOC_SECTIONS[0]?.id ?? "");
  const [activePageId, setActivePageId] = useState(DOC_SECTIONS[0]?.pages[0]?.id ?? "");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([DOC_SECTIONS[0]?.id ?? ""]),
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Documentation" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const activeSection = DOC_SECTIONS.find((s) => s.id === activeSectionId);
  const activePage = activeSection?.pages.find((p) => p.id === activePageId);

  const handlePageClick = (section: DocSection, page: DocPage) => {
    setActiveSectionId(section.id);
    setActivePageId(page.id);
    setExpandedSections((prev) => new Set([...prev, section.id]));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Count total pages
  const totalPages = DOC_SECTIONS.reduce((sum, s) => sum + s.pages.length, 0);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-[260px] shrink-0 border-r bg-card overflow-y-auto">
        <div className="flex items-center gap-2 p-4 border-b">
          <SanadLogo size={20} color="#3B82F6" />
          <div>
            <span className="text-sm font-semibold">Documentation</span>
            <span className="text-[10px] text-muted-foreground ml-2">{totalPages} pages</span>
          </div>
        </div>
        <nav className="p-2">
          {DOC_SECTIONS.map((section) => {
            const Icon = ICON_MAP[section.icon] ?? BookOpen;
            const isExpanded = expandedSections.has(section.id);
            const isActiveSection = section.id === activeSectionId;

            return (
              <div key={section.id} className="mb-0.5">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-all",
                    isActiveSection
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{section.title}</span>
                  <span className="text-[9px] text-muted-foreground">{section.pages.length}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-4 pl-2 border-l border-border/50 space-y-px mt-0.5">
                    {section.pages.map((page) => {
                      const isActive = section.id === activeSectionId && page.id === activePageId;
                      return (
                        <button
                          key={page.id}
                          onClick={() => handlePageClick(section, page)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded text-[11px] transition-all",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          )}
                        >
                          {page.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {activePage ? (
            <MarkdownBody className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_pre]:text-xs">
              {activePage.content}
            </MarkdownBody>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Select a page from the sidebar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
