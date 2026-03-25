# AccuBuild Core Skills

Project-agnostic, fast/deep mode skills for ERPNext/Frappe development.

## Skills (14 Total)

### Core Development Skills

| Skill | Purpose | Fast/Deep |
|-------|---------|-----------|
| [create-doctype](create-doctype/) | Create new DocTypes with controllers, permissions, tests | ✅ |
| [create-controller](create-controller/) | Create/update controllers with hooks | ✅ |
| [create-client-script](create-client-script/) | Create Form/List/Page client scripts | ✅ |
| [add-api-method](add-api-method/) | Add whitelisted API methods | ✅ |
| [create-test](create-test/) | Create unit/integration tests | ✅ |

### Architecture & Planning

| Skill | Purpose | Fast/Deep |
|-------|---------|-----------|
| [research-architect](research-architect/) | Design architecture with think-with-me approach | ✅ |
| [component-feature](component-feature/) | Add features to modular components (DevExtreme/Vue/React) | ✅ |

### Code Quality & Review

| Skill | Purpose | Fast/Deep |
|-------|---------|-----------|
| [clean-code](clean-code/) | Enforce clean code standards, file split plans | ✅ |
| [code-review](code-review/) | Targeted file/line review with A/B/C decision tables | ✅ |
| [review-pr](review-pr/) | Review PRs/diffs for security & performance | ✅ |
| [recommend-improvements](recommend-improvements/) | Suggest code improvements | ✅ |

### Documentation & Utilities

| Skill | Purpose | Fast/Deep |
|-------|---------|-----------|
| [update-docs](update-docs/) | Update project documentation | ✅ |
| [project-audit-wiki](project-audit-wiki/) | Full repo audit + wiki builder | ✅ |
| [start-task](start-task/) | Meta-router to other skills | - |

## Quick Start

All skills support **Fast** (quick wins) and **Deep** (comprehensive) modes:

```bash
# Fast mode - quick implementation
/skill-name <arguments> mode=fast

# Deep mode - comprehensive analysis
/skill-name <arguments> mode=deep
```

## Project Configuration

All skills read `config.md` for project-specific patterns:

```yaml
# Create in your project root
Project:
  name: My App
  domain: Healthcare  # or Manufacturing, Retail, etc.

Modules:
  - module_name: DocTypes list

DocType Patterns:
  custom_field_prefix: "custom_"
```

See `_templates/config.md` for full configuration options.

## Skill Usage Examples

```bash
# Create a new DocType
/create-doctype Patient hospital 0 mode=deep

# Add feature to component
/component-feature data_grid "Add bulk edit" api,helpers mode=deep

# Targeted code review (section + file:lines)
/code-review Performance accubuild_core/api.py:50-100
/code-review Code my_app/controllers/budget.py size=small
/code-review All accubuild_core/api.py mode=deep

# Review PR
/review-pr 123 mode=deep

# Clean code analysis
/clean-code sales mode=deep

# Audit entire project
/project-audit-wiki "scan full app" mode=full
```

## Architecture

All skills follow this pattern:

1. **Preflight Gates** (4 gates)
   - Read docs/config
   - Minimal research loop
   - Clarifying questions (minimal)
   - Implementation plan

2. **Output Format** (Structured)
   - A) Preflight Results
   - B) Analysis/Findings
   - C) Implementation Plan
   - D) Approval Request

3. **Think Modes**
   - **Fast**: 1-pass research, quick wins
   - **Deep**: 2-3 passes, thorough analysis

## Templates

- `_templates/config.md` - Project configuration template
- `_templates/README.md` - Template documentation

## Version

**Version**: 2.1 (Project-Agnostic)
**Last Updated**: 2026-02-19
