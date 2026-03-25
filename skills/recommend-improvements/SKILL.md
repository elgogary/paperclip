---
name: recommend-improvements
description: Analyze any ERPNext/Frappe app and provide actionable recommendations for UI/UX improvements and business logic enhancements. Supports domain-specific patterns via config.md.
arguments: "request_text"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Scope**: One of:
  - Module name (e.g., "sales", "inventory", "manufacturing")
  - DocType name (e.g., "Invoice", "Work Order")
  - "system" - Overall system analysis
  - "ui" - UI/UX focused analysis only
  - "business" - Business logic focused analysis only

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Quick wins, 1-pass research, 10-15 recommendations
  - **deep**: Thorough analysis, 2-3 passes, 20-30 recommendations with alternatives

**Fallback behavior**:
- No arguments → Perform overall system analysis
- Module/DocType not found → Analyze closest match, ask confirmation
- Invalid category → Default to comprehensive analysis

---

## Preflight Rules (HARD GATES — MUST RUN BEFORE ANALYSIS)

### Gate 1 — Project Docs & Structure Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for domain-specific patterns)
2) Verify target module/DocType exists:
   - List modules in app
   - Find DocType definition
   - Identify documentation gaps
3) If UI analysis: Read UI documentation
   - Client scripts, workspace definitions
   - Frontend architecture docs
4) If business analysis: Read module docs
   - Workflows, integrations, controllers
5) Flag documentation gaps

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Analyze target structure (DocTypes, controllers, workflows)
- Identify obvious pain points (TODOs, error handling gaps)
- Compare with ERPNext/Frappe standards
- Check for common anti-patterns

**Deep Mode (2-3 passes)**:

*Pass 1: Structure Analysis*
- If module: List all DocTypes, key workflows
- If DocType: Read JSON schema, controller, client scripts
- If system: Map all modules and interconnections
- If UI: Analyze workspaces, forms, lists, reports
- If business: Analyze controllers, hooks, workflows, integrations

*Pass 2: Context & Patterns*
- Find similar DocTypes/modules for comparison
- Search for user-facing issues (comments, error gaps)
- Identify missing integrations
- Check anti-patterns (validations, permissions, error handling)

*Pass 3: Domain Best Practices (Deep Mode Only)*
- Read `config.md` for domain-specific patterns
- Research domain best practices (if internet available)
- Compare with industry standards for specific domain
- Identify missing domain-specific features

Stop after configured passes. Use patterns as baseline.

### Gate 3 — Clarifying Questions (MANDATORY)
Ask ONLY if critical:

**Fast Mode**:
- "Focus on quick wins (1-2 days) or strategic improvements (1-2 weeks)?"
- "Target audience: All users or specific role?"

**Deep Mode**:
- "Primary goal: Efficiency, error reduction, or new capabilities?"
- "User roles to prioritize?"
- "Any specific pain points reported?"
- "Integration priorities (ERPNext, third-party, custom)?"

Default assumptions:
- High-impact, medium-effort improvements
- All user roles
- Balance efficiency and error reduction
- No specific pain points known

### Gate 4 — Analysis Plan (MANDATORY)
Before recommendations, output:

**Fast Mode**:
```
Scope: [module/DocType/system]
Focus: UI/UX/Business/Comprehensive
Approach: Quick analysis vs. ERPNext standards
Expected Output: 10-15 recommendations
```

**Deep Mode**:
```
Scope: [module/DocType/system]
Focus: UI/UX/Business/Comprehensive
Approach:
  - Analyze current workflows and pain points
  - Compare with domain best practices (from config.md)
  - Check against ERPNext/Frappe standards
  - Research industry patterns (if applicable)
  - Prioritize by impact/effort matrix

Recommendation Areas:
  - UI/Usability: [X areas]
  - Business Logic: [Y areas]
  - Integrations: [Z gaps]
  - Performance: [N bottlenecks]
  - Domain-Specific: [D areas]

Expected Output: 20-30 prioritized recommendations with alternatives
```

Then proceed with analysis.

---

## Rules (Engineering Standards)

### Domain Adaptability (via config.md)
Read `config.md` for:
- **Domain name**: (e.g., Construction, Healthcare, Manufacturing)
- **Domain entities**: Key business objects
- **Domain workflows**: Industry-specific processes
- **Domain patterns**: Mobile-first, offline-first, regulatory, etc.

### General ERPNext/Frappe Best Practices
- **Mobile-Friendly**: Responsive design for field/hospital use
- **Performance**: Efficient queries, minimal DOM updates
- **Permissions**: Role-based access, proper validation
- **Error Handling**: Graceful failures, clear messages
- **Integration**: ERPNext standards, API consistency
- **Data Integrity**: Transactions, validations, constraints

### Common Domain Patterns

**Field Operations** (Construction, Healthcare, Logistics):
- Mobile-first design
- Offline-first with sync
- Photo-rich documentation
- GPS/location awareness
- Real-time updates when online
- Quick data entry (voice-to-text, barcode scanning)

**Office Operations** (Finance, HR, Admin):
- Keyboard shortcuts
- Bulk operations
- Advanced filters and search
- Export to Excel/CSV
- Approval workflows
- Audit trails

**Manufacturing/Production**:
- Real-time status updates
- Machine integration
- Quality check workflows
- Batch/lot tracking
- Multi-level BOMs
- Production scheduling

### Fast Mode Analysis Focus
- Obvious pain points
- Quick wins (1-2 days)
- Common anti-patterns
- Missing standard features
- Performance bottlenecks

### Deep Mode Analysis Focus
- Workflow optimization opportunities
- Integration gaps
- Domain-specific enhancements
- User experience improvements
- Scalability concerns
- Security considerations
- Regulatory compliance (if applicable)

---

## What to do (Step-by-step)

### Fast Mode
1) Read project docs and config.md
2) Perform 1-pass analysis of target
3) Identify 10-15 obvious improvements
4) Prioritize by impact/effort (Quick wins → Medium → Strategic)
5) Output recommendations with brief rationale

### Deep Mode
1) Read project docs and config.md
2) Perform 2-3 pass analysis:
   - Pass 1: Structure and current state
   - Pass 2: Patterns and anti-patterns
   - Pass 3: Domain best practices (if applicable)
3) Identify 20-30 improvements including:
   - Quick wins (high impact, low effort)
   - Strategic improvements (high impact, high effort)
   - Domain-specific enhancements
   - Integration opportunities
4) For major improvements, provide 2-3 alternative approaches
5) Prioritize by impact/effort matrix
6) Output detailed recommendations with:
   - Rationale and business value
   - Implementation approach
   - Alternatives (for major items)
   - Estimated effort
   - Dependencies

---

## Output format

### A) Preflight Results
```
Scope: [module/DocType/system]
Mode: Fast/Deep
Docs found: Yes/No
Config.md: Yes/No (domain: [domain_name])
```

### B) Analysis Summary
```
Current State:
- Modules/DocTypes analyzed: [list]
- Key workflows identified: [list]
- Domain patterns applied: [list from config.md]

Analysis Approach:
- Research passes: [1 for fast, 2-3 for deep]
- Comparison baseline: ERPNext standards + [domain] best practices
- Focus areas: [UI, Business, Integration, Performance, Domain]
```

### C) Recommendations (Prioritized)

**Format for each recommendation**:

```markdown
**[Priority] - [Area]: [Title]**

Impact: [High/Medium/Low]
Effort: [Low/Medium/High]
Target: [Specific module/DocType/form]

Current State:
[What exists now, what's the problem]

Proposed Improvement:
[What to add/change, how it helps]

Business Value:
[Why users will care, metrics if applicable]

Implementation:
[High-level approach, alternatives if deep mode]

Estimated Effort:
[Time estimation, dependencies]

---
```

**Fast Mode**: 10-15 recommendations
**Deep Mode**: 20-30 recommendations with alternatives for major items

### D) Implementation Roadmap

**Fast Mode**:
```markdown
**Phase 1: Quick Wins (1-2 days each)**
- [Rec 1]
- [Rec 2]
- [Rec 3]

**Phase 2: Medium Effort (3-5 days each)**
- [Rec 4]
- [Rec 5]

**Phase 3: Strategic (1-2 weeks each)**
- [Rec 6]
```

**Deep Mode**:
```markdown
**Phase 1: Quick Wins (1-2 days each, high impact)**
- [Rec 1] - [effort]
- [Rec 2] - [effort]
- [Rec 3] - [effort]

**Phase 2: High Value (3-5 days each)**
- [Rec 4] - [effort]
- [Rec 5] - [effort]
- [Rec 6] - [effort]

**Phase 3: Strategic (1-2 weeks each, may need research-architect)**
- [Rec 7] - [effort, alternatives]
- [Rec 8] - [effort, alternatives]

**Phase 4: Domain Enhancements (may require additional analysis)**
- [Rec 9] - [effort, domain-specific]
```

### E) Next Steps
```
Recommended next actions:
1. [High-priority quick win to start with]
2. [If architecture needed]: /research-architect "[major improvement]"
3. [If code quality needed]: /clean-code [target]
4. [If UX needed]: Consider UI/UX specialist review
```

---

## Examples

### Example 1: Fast Mode - Module Analysis
```bash
/recommend-improvements sales mode=fast
```

**Output**: 10-15 quick wins for sales module (Invoice, Payment, Customer)

### Example 2: Deep Mode - System Analysis
```bash
/recommend-improvements system mode=deep
```

**Output**: 20-30 recommendations covering:
- UI improvements (mobile, workspaces, forms)
- Business logic (workflows, integrations, automation)
- Domain-specific (from config.md: e.g., healthcare, manufacturing)
- Performance (queries, caching, indexing)
- Security (permissions, validations)

### Example 3: Fast Mode - UI Analysis
```bash
/recommend-improvements ui mode=fast
```

**Output**: 10-15 UI/UX quick wins across all modules

### Example 4: Deep Mode - DocType Analysis
```bash
/recommend-improvements Invoice mode=deep
```

**Output**: 15-20 detailed recommendations for Invoice DocType including:
- Form usability improvements
- Workflow enhancements
- Integration opportunities
- Alternative approaches for major changes

---

## Checklist

- [ ] Read project docs and config.md
- [ ] Verify target exists (module/DocType)
- [ ] Perform research passes (1 for fast, 2-3 for deep)
- [ ] Apply domain patterns from config.md (if present)
- [ ] Compare with ERPNext/Frappe standards
- [ ] Generate prioritized recommendations
- [ ] Provide implementation roadmap
- [ ] Suggest next steps
