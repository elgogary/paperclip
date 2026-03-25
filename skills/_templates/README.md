# Project-Agnostic ERPNext/Frappe Skills

This directory contains reusable skills for any ERPNext/Frappe project.

## Quick Start

### 1. Configure for Your Project

Copy the config template to your project root:

```bash
cp .claude/skills/_templates/config.md .claude/skills/config.md
```

Edit `config.md` with your project's:
- App name and modules
- Folder structure
- Naming conventions
- Architecture patterns

### 2. Use Skills

All skills automatically read `config.md` if present:

```bash
# Start any task (meta-router)
/start-task "Implement multi-currency support"

# Or use individual skills
/research-architect "Add versioning to Invoice DocType"
/clean-code my_app/sales/invoice
/create-doctype PaymentGateway my_app
```

## Think Modes

All skills support two modes:

### Fast Mode (Default)
- Quick analysis
- Minimal research (1 pass)
- Direct to implementation
- Best for: Routine tasks, clear requirements, small changes

```bash
/start-task "Add status field to Sales Order" mode=fast
```

### Deep Think Mode
- Thorough analysis
- Multiple research passes (2-3)
- Alternative approaches
- Risk assessment
- Devil's advocate review
- Best for: New features, architectural changes, complex refactors

```bash
/start-task "Implement multi-company support" mode=deep
```

## Available Skills

### 🚀 Task Orchestration
- **start-task** - Meta-skill router (recommended starting point)

### 🔍 Analysis & Improvement
- **recommend-improvements** - UI/UX & business improvement recommendations
- **research-architect** - Architectural co-design with alternatives
- **clean-code** - Code quality, file structure, JSON validation
- **review-pr** - Pull request review

### 🏗️ Backend Development
- **create-doctype** - DocType scaffolding
- **create-controller** - Shared controllers
- **add-api-method** - Whitelisted API methods

### 🎨 Frontend Development
- **create-client-script** - Form/list/page scripts
- **[component-name]-feature** - Feature-specific implementations

### ✅ Testing & Documentation
- **create-test** - Unit/integration tests
- **update-docs** - Documentation updates

## Skill Customization

### Project-Specific Config

Create `config.md` in each skill folder or use global config:

```bash
# Option 1: Global config (recommended)
.claude/skills/config.md

# Option 2: Per-skill config
.claude/skills/create-doctype/config.md
.claude/skills/clean-code/config.md
```

### Custom Rules

Add project-specific rules in `config.md`:

```yaml
Custom Rules:
- Never extend ERPNext core DocTypes
- Always use transactions for multi-document operations
- Validate fiscal year before any financial operation
```

## Architecture Patterns

Skills support common ERPNext/Frappe patterns:

- **DocType Controllers**: Standard controller class with hooks
- **Shared Controllers**: Cross-DocType business logic
- **Client Scripts**: Form/list/page customization
- **API Methods**: Whitelisted endpoints
- **Hooks**: Document events, app hooks
- **Patches**: Schema migrations and data backfills
- **Workflows**: Document state transitions

## Domain Adaptation

Skills are domain-agnostic. Configure `config.md` for your domain:

### Construction
- Modules: bidding, site_ops, finance, documents
- Entities: Projects, Bids, WBS Elements, Sites

### Healthcare
- Modules: patient, clinical, billing, pharmacy
- Entities: Patients, Appointments, Encounters, Prescriptions

### Education
- Modules: student, faculty, course, admissions
- Entities: Students, Courses, Programs, Batches

### Manufacturing
- Modules: production, inventory, quality, maintenance
- Entities: BOM, Work Orders, Production Plans, Quality Checks

## Version History

- **2.0** (2026-01-22): Project-agnostic refactor with think modes
  - Removed hardcoded AccuBuild references
  - Added config.md system for project customization
  - Added Fast/Deep think modes to all skills
  - Enhanced domain adaptability

- **1.4** (2026-01-22): Meta-skill router added
- **1.3** (2026-01-22): Architect and clean-code skills added
- **1.2** (2026-01-22): Enhanced with 4-gate preflight rules
- **1.0** (2026-01-22): Initial skill set

## Contributing

When adding new skills:

1. Make them project-agnostic (no hardcoded app names)
2. Add config.md support for project-specific patterns
3. Support Fast/Deep think modes
4. Follow the 4-gate preflight pattern
5. Use structured output (A/B/C/D sections)

## Support

For issues or questions:
- Check `config.md` is correctly configured
- Verify folder structure matches config
- Review skill-specific SKILL.md for requirements
