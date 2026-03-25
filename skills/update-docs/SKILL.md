---
name: update-docs
description: Update documentation for any ERPNext/Frappe project, ensuring docs stay synchronized with codebase
arguments: "request_text"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Documentation type**: api, module, guide, or README
- **Changes**: What was modified

**Optional**:
- **mode**: "fast" (default) or "deep"
  - **fast**: Basic doc update with essential changes
  - **deep**: Comprehensive update with examples, diagrams, cross-references

**Fallback**:
- Type unclear → Ask "API, module guide, or README?"
- Changes unclear → Search recent git changes

---

## Preflight Rules (HARD GATES)

### Gate 1 — Project Docs Check (MANDATORY)
1) Read project documentation structure
2. Confirm target doc exists
3. Check if docs match code
4. Flag outdated docs

### Gate 2 — Minimal Research Loop (MANDATORY)

**Fast Mode (1 pass)**:
- Read changed files
- Identify key changes

**Deep Mode (2 passes)**:
*Pass 1*: Read changed files, identify changes
*Pass 2*: Find related documentation

Stop after configured passes.

### Gate 3 — Clarifying Questions
Ask ONLY if critical:
- "Breaking changes that need migration docs?"
- "Include code examples?"

**Defaults**: No breaking changes, include examples

### Gate 4 — Implementation Plan
Before updating, output:
```
Scope: Update [doc_type]
Files to update: [list]
Changes: [list]
Examples: Yes/No
```

---

## Rules

### Documentation Standards
- **Accuracy**: Docs must match code exactly
- **Code examples**: All examples must be tested
- **File paths**: Use [file.py](path) format
- **Cross-references**: Link to related docs
- **Clear purpose**: Each section has clear purpose

### Minimal Change (MANDATORY)
- Update only what changed
- Preserve structure
- Additive changes
- Focused updates

---

## What to do

### Fast Mode
1) Read code changes (Gate 1-2)
2) Ask questions (Gate 3)
3) Output plan (Gate 4)
4) Update docs:
   - Update changed sections only
   - Basic examples
   - Verify links

### Deep Mode
1) Read code changes (Gate 1-2)
2) Ask questions (Gate 3)
3) Output plan (Gate 4)
4) Update docs:
   - Comprehensive updates
   - Detailed examples
   - Cross-references
   - Diagrams (if needed)
   - Test examples
   - Verify all links

---

## Output format

### A) Preflight Results
```
Wiki structure: Match/Mismatch
Docs exist: Yes/No
Outdated sections: [list]
```

### B) Implementation Plan
```
Scope: Update [doc]
Files: [list]
Changes: [list]
Examples: [code snippets]
```

### C) Awaiting Approval
**Ready to update docs. Proceed?**

---

## Checklist

- [ ] Documentation updated
- [ ] Code examples tested (deep mode)
- [ ] Cross-references verified (deep mode)
- [ ] File paths accurate
- [ ] Links tested

---

**Last Updated**: 2026-01-22
**Version**: 2.0 (Project-Agnostic)
