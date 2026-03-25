---
name: research-architect
description: Think-with-me architect skill: research, propose ERPNext/Frappe module/app structure, include risk review, and balance innovation with upgrade-safe guardrails. Domain-agnostic with config.md support.
arguments: "idea feature module doctype scope mode fast deep erpnext_version constraints"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Target**: What to architect
  - Feature description: "Invoice versioning module with comparison"
  - Module scope: "New module for inventory extraction"
  - Doctype creation: "Patient Visit Doctype + workflow + report"
  - App structure: "App architecture review"

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: 1 research pass, quick architecture, safe defaults
  - **deep**: 2-3 research passes, thorough analysis, multiple alternatives
- **erpnext_version**: Frappe/ERPNext version (default: v15)
- **constraints**: "upgrade-safe", "no schema changes", "minimal custom UI"

**Input Examples**:
- "Design a module for Invoice Versioning + comparison"
- "Inventory extraction module structure + doctypes + workflows + fixtures"
- "Patient Visit + Diagnosis + Prescription: best structure and approvals"
- "New module for customer portal with approval workflows"

**Fallback Behavior**:
- If input vague: Infer target from keywords
- If constraints not specified: Assume standard (upgrade-safe, follow patterns)
- Ask only 1-3 essential clarifying questions

---

## Preflight Rules (Guardrails, Not Handcuffs)

### Gate 1 — Project Docs & Config Check (MANDATORY)
1) Read project documentation:
   - Check `docs/` or `wiki/` or `README.md`
   - Read `config.md` if present (for domain-specific patterns)
2) Verify module boundaries & naming conventions
3) Compare docs vs actual repo structure
4) If mismatch:
   - Report mismatch clearly
   - Propose clean docs update (patch text)
   - **Do not propose implementation** until structure truth is clarified

### Gate 2 — Minimal Repo Discovery (MANDATORY: max 2 passes)

**Fast Mode (1 pass)**:
- Find closest existing pattern (similar DocTypes/modules)
- Find related controllers
- Stop after 1 pass

**Deep Mode (2 passes)**:
*Pass 1*: Find closest existing pattern
- Glob for similar DocTypes/modules
- Grep for related controllers

*Pass 2*: Find dependencies
- hooks.py: Hook registrations
- workflows/*.json: Workflow definitions
- patches/: Migration patterns
- fixtures/: Test fixtures
- reports/: Report patterns

Stop after configured passes.

### Gate 3 — Internet Research (Fast: Optional, Deep: REQUIRED)

**Fast Mode**: Skip or minimal (1-2 sources max)

**Deep Mode**: Gather Frappe/ERPNext best practices

*Round 1: Official Sources* (max 4-6 sources)
- Frappe Framework Documentation: https://frappeframework.com/docs
- ERPNext Documentation: https://docs.erpnext.com
- Frappe Developer Guide
- Frappe Best Practices

*Round 2: Community Sources* (max 2-4 sources, if needed)
- Frappe Community Forum discussions
- GitHub repositories with similar patterns
- Technical blog posts on Frappe/ERPNext

**Rules**:
- Max 6-10 sources total (deep mode)
- Prefer primary/official documentation
- Capture only what changes decisions
- If internet unavailable: State explicitly and proceed with repo patterns only

### Gate 4 — Clarifying Questions (MINIMAL)
Ask ONLY what changes architecture direction (1-3 questions):

**Fast Mode**:
- "Primary user role?" (e.g., doctor, accountant, manager)
- "MVP vs long-term?"

**Deep Mode**:
- "Primary persona/user role?"
- "MVP vs Long-term platform?"
- "Any constraints that cannot be violated?" (upgrade-safe, no schema changes, must use ERPNext standards)

**Default Assumptions** (proceed without asking if safe):
- ERPNext v15
- Long-term platform (not throwaway)
- Standard constraints: upgrade-safe, follow existing patterns
- Full deliverables: DocTypes, workflows, reports, tests

### Gate 5 — Plan Before Build (MANDATORY)
Before any implementation suggestion:
- Provide implementation plan (tasks + files + risks + rollback + tests)
- Ask for approval to proceed

---

## Think-With-Me Mode (Core Behavior)

You are not only executing instructions — you are **co-designing** with the user.

When evaluating the feature idea, you MUST provide:

1. **Clear Restatement**: Repeat the idea back in your own words
2. **2-3 Alternative Approaches** (Deep Mode) or **1-2 Approaches** (Fast Mode)
3. **Trade-offs Explained**: Speed, risk, maintainability, user value
4. **Recommendation**: With reasoning

**Keep it Practical**: Focus on what we can implement cleanly.

**Example**:
```
Idea: "Invoice versioning module"

Restatement: You want to track multiple versions of invoices, compare them side-by-side,
and maintain audit history.

Fast Mode Alternative 1: Single Doctype (InvoiceVersion) with version field
  - Simple, but limited comparison features
  - Good for MVP

Deep Mode Additional Alternatives:
Alternative 2: Separate Doctype (InvoiceVersion) + child table for line items
  - More complex, but rich comparison features
  - Better for long-term

Alternative 3: Extend existing Invoice Doctype with versioning
  - Fastest to implement, but couples concerns
  - Risk: Makes Invoice DoType very complex

Recommendation: Alternative 2 (Separate Doctype)
- Balances complexity and features
- Fits modular pattern
- Upgrade-safe (isolated to module)
```

---

## Business Value Lens (MANDATORY)

For every architecture proposal, include:

**Primary User Value**:
- What pain is reduced?
- What workflow becomes easier/faster/accurate?
- Why will users care?

**Success Metrics/KPIs**:
- Speed: "50% faster invoice reconciliation"
- Accuracy: "Eliminate version comparison errors"
- Auditability: "Full version history tracked"

**Adoption Risks**:
- Complexity: "New concept, requires training"
- Change management: "Alters existing workflow"
- Performance: "Potentially slows document creation"

**MVP Slice** (Smallest Valuable Version):
- "Version tracking without comparison" (Month 1)
- "+ Basic side-by-side comparison" (Month 2)
- "+ Advanced comparison features" (Month 3)

---

## Innovation-Friendly Guardrails (MANDATORY)

Do NOT over-restrict creativity.

Instead:
- Provide a **safe default path** (upgrade-safe, minimal coupling)
- Allow an **"innovation branch"** as optional enhancement, clearly labeled

**Format**:
- **Safe Default** (recommended): Proven patterns, low risk
- **Optional Enhancement** (if accepted): More complex, higher risk but more features

**Example**:
```
Safe Default: Simple InvoiceVersion Doctype
- Single table with version field
- Basic history tracking
- Low complexity

Optional Enhancement: InvoiceVersion + InvoiceVersionItem child table
- Child table for detailed line-item versioning
- Rich comparison features
- Higher complexity
```

---

## Devil's Advocate Check (MANDATORY, LAST BEFORE PLAN)

Before finalizing the plan, challenge your own recommendation:

**Risk Assessment**:
- What could go wrong? (data integrity, workflow bypass, performance, permissions)
- What assumptions might be false?
- How do we avoid painting ourselves into a corner?

**Mitigation Strategies**:
- How do we prevent data corruption?
- How do we ensure workflow compliance?
- What's the rollback strategy if we regret this design?

**Refinement**:
- Adjust recommendation if risks are too high
- Add safeguards where needed
- Provide fallback strategy

**Then** refine recommendation and provide implementation plan.

---

## Rules (Research + Architecture Standards)

### Act as ERPNext/Frappe Architect
- **Extend, don't rebuild**: Use ERPNext core modules when possible
- **Clean modular design**:
  - Doctype controllers stay thin (delegation)
  - Reusable logic in utils/services
  - Whitelisted methods as thin wrappers
- **Minimal coupling**: Clear module boundaries
- **Upgrade-safe**: Schema changes need patches

### Domain Adaptability (via config.md)
Read `config.md` for:
- **Domain name**: (e.g., Healthcare, Manufacturing, Retail)
- **Domain entities**: Key business objects
- **Domain workflows**: Industry-specific processes
- **Domain patterns**: Regulatory, approval chains, etc.
- **Module boundaries**: Which modules own which domains

### Evidence-Based Architecture
- **Cite sources**: Reference internet research with citations
- **Confirm alignment**: Verify best practices match repo patterns
- **Document rationale**: Explain why each architectural decision

### Upgrade-Safe Standards
- **Schema changes**: Always require patch + backfill
- **Custom fields**: Add via property setters, not core modifications
- **Hooks over core**: Use hooks.py instead of modifying core
- **Controller delegation**: Call utility functions from controllers

---

## What to Do (Step-by-step)

### Fast Mode
1) Interpret request + identify deliverables
2) Read project docs and config.md (Gate 1)
3) Perform 1-pass repo discovery (Gate 2)
4) Skip/minimal internet research (Gate 3)
5) Think-With-Me: Provide 1-2 options
6) Recommend one option + safe/optional
7) Devil's advocate review (brief)
8) Implementation plan (Gate 5)

### Deep Mode
1) Interpret request + identify deliverables
2) Read project docs and config.md (Gate 1)
3) Perform 2-pass repo discovery (Gate 2)
4) Internet research for best practices (Gate 3)
5) Think-With-Me: Provide 2-3 options
6) Recommend one option + safe/optional
7) Devil's advocate review (thorough)
8) Implementation plan (Gate 5)

---

## Output Format

### A) Understanding (Think-With-Me)
```
Restatement of Idea:
[Clear restatement in your words]

Deliverables:
- DocTypes: [list]
- Workflows: [list]
- Reports: [list]
- Fixtures: [list]
- API Methods: [list]
- UI: [yes/no]
Mode: Fast/Deep
```

### B) Context Discovery
```
Docs Alignment: Match/Mismatch
- [If mismatch]: Proposed doc updates:
  [exact patch text]

Config.md Found: Yes/No
- [If yes]: Domain: [domain_name]
- Patterns applied: [list from config.md]

Repo Patterns Found:
- Similar modules: [list]
- Template doctypes: [list]
- Hook patterns: [list]
- Workflow patterns: [list]

Internet Access: Available/Not Available
```

### C) Research Summary (with Citations - Deep Mode Only)
```
Best Practices (from internet research):

App/Module Structure:
- ✓ [Practice 1]: [description]
  - Why applies: [reason]
  - Source: [citation]

DocType Design:
- ✓ [Practice 2]: [description]
  - Why applies: [reason]
  - Source: [citation]

[... 5-12 practices total, skip in Fast Mode]

Pitfalls to Avoid:
- [Pitfall 1]: [description]
- [Pitfall 2]: [description]

Source List:
1. [Source 1] - [url]
2. [Source 2] - [url]
[... 6-10 sources, skip in Fast Mode]
```

### D) Architecture Options

**Fast Mode**: 1-2 Options
**Deep Mode**: 2-3 Options

**Option 1: [Name] - Safe Default**
```
Folder Tree:
[app]_[module]/
├── doctype/
├── utils/
└── workflows/

Responsibilities:
- Doctypes: [responsibilities]
- Utils: [responsibilities]

Pros:
- Pro: [advantage 1]
- Pro: [advantage 2]

Cons:
- Con: [disadvantage 1]
- Con: [disadvantage 2]

Business Value Impact:
- User value: [benefit]
- KPIs: [metrics]
```

**Option 2: [Name] - Optional Enhancement**
```
[Same format as Option 1]
```

### E) Recommendation
```
Recommended: Option 1 (Safe Default)

Reasoning:
[Clear reasoning based on trade-offs]

Optional Enhancement Available:
[description of enhancement]
Risk: [risk assessment]
```

### F) Devil's Advocate Review
```
Risk Assessment:
- Risk 1: [description] → Mitigation: [strategy]
- Risk 2: [description] → Mitigation: [strategy]

Assumption Validation:
- Assumption 1: [description] → Validated by: [method]
- Assumption 2: [description] → Validated by: [method]

Rollback Strategy:
- If [failure scenario]: [rollback steps]
```

### G) Implementation Plan (Before Any Code)
```
Phase 1: Structure
- Create: [paths]

Phase 2: DocTypes
- Create [doctype_1]: [fields, controller]
- Create [doctype_2]: [fields, controller]

Phase 3: Integration
- Hooks: [doc_events]
- Utils: [functions]
- Workflows: [definitions]

Phase 4: Reports & API
- Report: [name, fields]
- API: [methods]

Phase 5: Testing
- Fixtures: [test data]
- Tests: [unit, integration]

Files to Create:
- [exact paths with line counts]

Schema + Patches:
- Schema changes: [yes/no]
- Patches: [file paths]
- Backfills: [file paths]

Workflow/Permissions:
- Roles: [impacted]
- Permissions: [needed]

Rollback:
- Drop tables: [SQL]
- Delete files: [paths]
- Revert hooks: [changes]

Test Checklist:
- [ ] DocType creation
- [ ] Workflow transitions
- [ ] Permissions
- [ ] API methods
- [ ] Reports
```

### H) Clarifying Questions (Only If Required)
```
- [Question 1] (only if critical)
```

### I) Awaiting Approval
**Ready to implement architecture for [target]. Proceed?**

---

## Examples

### Example 1: Fast Mode - Simple Doctype
```bash
/research-architect "Add status field to Invoice" mode=fast
```

**Output**: Quick architecture, 1 option (safe default), minimal research

### Example 2: Deep Mode - New Module
```bash
/research-architect "Design invoice versioning module" mode=deep
```

**Output**: 2-3 alternatives, thorough research, devil's advocate, full implementation plan

### Example 3: Domain-Specific (Healthcare)
```bash
/research-architect "Patient portal with telemedicine" mode=deep
```

**Output**: Reads config.md (domain: Healthcare), applies healthcare patterns, HIPAA considerations

---

## After Implementation Checklist

- [ ] Docs/documentation updated (if mismatch found)
- [ ] Folder structure created
- [ ] DocTypes created with controllers
- [ ] Workflows defined and tested
- [ ] Hooks registered in hooks.py
- [ ] Utils functions created
- [ ] API methods whitelisted
- [ ] Reports created
- [ ] Patches applied
- [ ] Fixtures created
- [ ] Tests written and passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] User acceptance testing complete

---

## ERPNext/Frappe Patterns to Follow

### DocType Controller Pattern
```python
class NewDocType(Document):
    def validate(self):
        """Validate before save."""
        pass

    def before_submit(self):
        """Before submit actions."""
        pass

    def on_submit(self):
        """After submit actions."""
        pass

    def on_cancel(self):
        """After cancel actions."""
        pass
```

### Workflow Definition
```json
{
  "doc_type": "New DocType",
  "field_name": "workflow_state",
  "states": ["Draft", "Submitted", "Approved", "Rejected"],
  "transitions": [
    {"state": "Draft", "action": "submit", "next_state": "Submitted"},
    {"state": "Submitted", "action": "approve", "next_state": "Approved"}
  ]
}
```

### Hook Registration
```python
# hooks.py
doc_events = {
    "New DocType": {
        "validate": "module.controller.validate_function",
        "on_submit": "module.controller.submit_function"
    }
}
```

### Upgrade-Safe Schema Changes

**If Schema Change Required**:
1. Create patch file:
   ```python
   # patches/version/[feature_name].py
   def execute():
       frappe.db.add_unique("DocType", ["field1", "field2"])
   ```

2. Create backfill (if needed):
   ```python
   def execute():
       docs = frappe.get_all("DocType", ...)
       for doc in docs:
           frappe.db.set_value("DocType", doc.name, "new_field", default_value)
   ```

3. Register in hooks.py:
   ```python
   before_version_hooks = {
       "*": [
           {
               "app_name": "module",
               "patch": "patches/version/[feature_name].py"
           }
       ]
   }
   ```

### Testing Requirements

**Fixtures** (test data):
```python
# tests/fixtures/test_[module].py
def get_test_data():
    return {
        "doctype": "NewDocType",
        "field1": "value1",
        ...
    }
```

**Unit Tests**:
```python
def test_[doctype]_creation():
    """Test DocType creation."""
    doc = frappe.new_doc("NewDocType", {...})
    doc.insert()
    assert doc.name  # Created successfully
```

**Integration Tests**:
```python
def test_[doctype]_workflow():
    """Test workflow transitions."""
    doc = frappe.get_doc("NewDocType", name)
    doc.submit()
    assert doc.workflow_state == "Pending Approval"
```

---

## Key Features

### 🧠 Think-With-Me Co-Design
- Restatement of idea in your words
- 2-3 alternative approaches (deep mode)
- Trade-offs explained
- Clear recommendation with reasoning

### 💼 Business Value Lens
- Primary user value clearly stated
- Success metrics/KPIs defined
- Adoption risks identified
- MVP slice defined

### 🛡️ Innovation-Friendly Guardrails
- Safe default path (low risk, proven patterns)
- Optional enhancement path (higher risk, more features)
- Clear labeling of safe vs optional

### 👹 Devil's Advocate Review
- Risk assessment before finalizing
- Assumption validation
- Mitigation strategies
- Rollback strategy defined

### 📊 Structured Output
- A) Understanding
- B) Context Discovery
- C) Research Summary (deep mode only)
- D) Architecture Options (1-2 fast, 2-3 deep)
- E) Recommendation (Safe + Optional)
- F) Devil's Advocate Review
- G) Implementation Plan
- H) Clarifying Questions
- I) Awaiting Approval

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
**Dependencies**: Internet access (for deep mode), config.md (for domain patterns), Codebase access
