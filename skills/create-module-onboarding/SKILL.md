---
name: create-module-onboarding
description: Create Module Onboarding setups for any ERPNext/Frappe app with wizard configs, custom fields, and optional Sanad AI video walkthroughs via AI Selenium Job
argument-hint: "module-name app-name --with-video --narration-voice en-US-GuyNeural"
---

## Input
Target: $ARGUMENTS

**Required**:
- **Module name**: The Frappe module to create onboarding for (e.g., "Setup", "Accounts", "HR")
- **App name**: The custom app that owns the onboarding (e.g., "accubuild_core", "frappe_theme_switcher")

**Optional**:
- **--with-video**: Generate walkthrough videos for each step using Sanad AI Selenium Job
- **--narration-voice**: Edge-TTS voice for video narration (default: "en-US-GuyNeural")
- **--site-url**: Target site URL for API calls (default: reads from .env or asks)
- **--api-token**: API auth token (default: reads from .env `API_KEY:API_SECRET`)
- **--steps**: Comma-separated DocType names to include as steps (auto-detected if omitted)
- **--priority-split**: How many steps are Required vs Optional (default: auto-detect)
- **mode**: "fast" (fixtures only) or "deep" (fixtures + video + Custom HTML Blocks)

**Fallback behavior**:
- Module missing -> Ask user
- App missing -> Detect from current working directory
- Steps missing -> Scan module DocTypes and suggest
- Site URL missing -> Check .env, then ask
- API token missing -> Check .env, then ask

---

## Preflight Rules (HARD GATES)

### Gate 1 -- Project & App Validation (MANDATORY)
1) Verify target app exists:
   - Check `pyproject.toml` or `setup.py` for app name
   - Read `hooks.py` for module registration
   - Read `modules.txt` to confirm module exists
2) Read project docs:
   - `CLAUDE.md` for conventions
   - `config.md` if present
   - Existing fixture files in `fixtures/`
3) Check if onboarding already exists:
   - Search for existing `Module Onboarding` fixtures
   - If exists -> Ask: "Update existing or create new?"
4) Verify custom field fixtures exist for `Onboarding Step`:
   - `custom_ab_*` fields (priority, task_key, sort_order, icon, enable_ai_help, wizard_fields, html_block)
   - If missing -> Will create them

### Gate 2 -- DocType Discovery (MANDATORY)
1) **List all DocTypes in target module**:
   - Get all non-child-table DocTypes
   - Identify Settings (is_single=1) vs regular DocTypes
2) **Classify steps**:
   - Settings DocTypes -> "Update Settings" action
   - Regular DocTypes -> "Create Entry" action
   - Pages/Reports -> "Go to Page" action
3) **Auto-detect priority**:
   - Required: Core setup DocTypes (Company, Fiscal Year, Chart of Accounts, etc.)
   - Optional: Enhancement DocTypes (Logo, Email, Users, etc.)
4) **For each step, auto-generate wizard_fields JSON**:
   - Read DocType meta (field list)
   - Group fields by Section Break into wizard steps
   - Include only user-facing fields (skip hidden, read_only, internal)
   - Format: `[{"step": "Section Name", "fields": ["field1", "field2"]}, ...]`

### Gate 3 -- Sanad AI / Video Check (ONLY if --with-video)
1) Check if `sanad_business_intelligence_ai` app is installed on target site:
   ```
   GET {site_url}/api/method/frappe.client.get_list
     ?doctype=Module Def&filters=[["app_name","=","sanad_business_intelligence_ai"]]
   ```
   - If not installed -> Warn user, skip video generation
2) Check AI Selenium Settings:
   ```
   GET {site_url}/api/resource/AI Selenium Settings
   ```
   - Verify `enabled=1`, `chrome_binary_path` set, `default_login_user` set
   - If not configured -> Show setup instructions, skip video
3) Confirm with user:
   - "Will create {N} AI Selenium Jobs to record walkthrough videos. Each job takes ~30-60s. Proceed?"

### Gate 4 -- Implementation Plan (MANDATORY)
Before creating any files, output:

```
ONBOARDING PLAN
===============
Module:          {module}
App:             {app_name}
Onboarding Name: "{App Title} Setup"

Steps ({N} total, {R} Required, {O} Optional):
  1. [Required] {Step Title} -> {DocType} ({action})
     Wizard: {N} steps, {M} fields
     Video:  {yes/no}
  2. ...

Files to create/modify:
  - fixtures/onboarding_step.json (NEW)
  - fixtures/module_onboarding.json (NEW)
  - fixtures/custom_field.json (MODIFY -- add Onboarding Step fields)
  - hooks.py (MODIFY -- add fixture entries)

Custom Fields on Onboarding Step:
  - custom_ab_priority (Select)
  - custom_ab_task_key (Data)
  - custom_ab_sort_order (Int)
  - custom_ab_icon (Data)
  - custom_ab_enable_ai_help (Check)
  - custom_ab_wizard_fields (Code/JSON)
  - custom_ab_html_block (Link -> Custom HTML Block)
```

Wait for user approval before proceeding.

---

## Implementation

### Phase 1: Generate Fixtures

#### 1.1 Onboarding Step Fixtures
For each step, create a fixture record:

```json
{
  "doctype": "Onboarding Step",
  "name": "{Step Title}",
  "title": "{Step Title}",
  "description": "{Auto-generated from DocType description or field labels}",
  "action": "{Create Entry | Update Settings | Go to Page}",
  "reference_document": "{DocType name}",
  "show_full_form": 0,
  "is_complete": 0,
  "is_skipped": 0,
  "custom_ab_priority": "{Required | Optional}",
  "custom_ab_task_key": "{snake_case_key}",
  "custom_ab_sort_order": {N},
  "custom_ab_icon": "{fa-icon-name}",
  "custom_ab_enable_ai_help": 1,
  "custom_ab_wizard_fields": "{JSON array of wizard steps}"
}
```

**Icon auto-detection rules**:
- Company/Organization -> "fa-building"
- Chart of Accounts / Accounting -> "fa-sitemap"
- Fiscal Year / Calendar -> "fa-calendar"
- Logo / Image -> "fa-image"
- Email -> "fa-envelope"
- Users -> "fa-users"
- Settings -> "fa-cog"
- Items / Products -> "fa-cube"
- Warehouse / Storage -> "fa-warehouse"
- Default fallback -> "fa-check-circle"

**wizard_fields generation algorithm**:
```
1. Get DocType meta fields
2. Filter: skip fieldtype in [Section Break, Column Break, Tab Break, HTML, Button, Table]
3. Filter: skip hidden=1, read_only=1, fieldname starts with "amended_from"
4. Group remaining fields by preceding Section Break label
5. For each group with > 0 fields:
   - Create wizard step: {"step": section_label, "fields": [fieldnames]}
6. If no Section Breaks, put all fields in one step: "Basic Details"
7. Cap at 5 wizard steps max (merge small sections)
8. Cap at 8 fields per step (move overflow to next step)
```

#### 1.2 Module Onboarding Fixture
```json
{
  "doctype": "Module Onboarding",
  "name": "{App Title} Setup",
  "title": "{App Title} Setup",
  "subtitle": "Complete these steps to configure {module}",
  "module": "{module}",
  "is_complete": 0,
  "success_message": "Congratulations! {module} setup is complete.",
  "steps": [
    {"step": "{Step 1 Name}"},
    {"step": "{Step 2 Name}"}
  ],
  "allow_roles": [
    {"role": "System Manager"},
    {"role": "Administrator"}
  ]
}
```

#### 1.3 Custom Field Fixtures
Ensure these custom fields exist on `Onboarding Step`:

| Fieldname | Fieldtype | Label | Options | Insert After |
|---|---|---|---|---|
| custom_ab_section | Section Break | AccuBuild Settings | - | is_skipped |
| custom_ab_priority | Select | Priority | Required\nOptional | custom_ab_section |
| custom_ab_task_key | Data | Task Key | - | custom_ab_priority |
| custom_ab_sort_order | Int | Sort Order | - | custom_ab_task_key |
| custom_ab_col1 | Column Break | - | - | custom_ab_sort_order |
| custom_ab_icon | Data | Icon Class | - | custom_ab_col1 |
| custom_ab_enable_ai_help | Check | Enable AI Help | - | custom_ab_icon |
| custom_ab_wizard_fields | Code | Wizard Fields (JSON) | JSON | custom_ab_enable_ai_help |
| custom_ab_html_block | Link | HTML Block | Custom HTML Block | custom_ab_wizard_fields |

If custom_field.json already has these, skip. Otherwise merge.

#### 1.4 Update hooks.py
Add fixture entries:
```python
fixtures = [
    # ... existing ...
    {"dt": "Custom Field", "filters": [["module", "=", "{App Module}"]]},
    {"dt": "Onboarding Step", "filters": [["name", "in", [list_of_step_names]]]},
    {"dt": "Module Onboarding", "filters": [["name", "=", "{Onboarding Name}"]]},
]
```

### Phase 2: Video Generation (--with-video only)

#### 2.1 Build Selenium Test Steps per Onboarding Step

For each step with `reference_document`, build a `test_steps_json`:

**For "Create Entry" steps (e.g., Company form)**:
```json
[
  {"action": "navigate", "url": "/app/{doctype-slug}/new"},
  {"action": "wait_for", "selector": ".form-page", "timeout": 10},
  {"action": "screenshot", "label": "Empty {DocType} form"},
  {"action": "wait", "seconds": 1},

  // For each wizard step section:
  {"action": "screenshot", "label": "Section: {section_label}"},

  // Final overview
  {"action": "screenshot", "label": "{DocType} form overview"},
  {"action": "wait", "seconds": 1}
]
```

**For "Update Settings" steps (single DocTypes)**:
```json
[
  {"action": "navigate", "url": "/app/{doctype-slug}"},
  {"action": "wait_for", "selector": ".form-page", "timeout": 10},
  {"action": "screenshot", "label": "{DocType} settings page"},
  {"action": "wait", "seconds": 2},
  {"action": "screenshot", "label": "{DocType} settings complete"}
]
```

**For "Go to Page" steps**:
```json
[
  {"action": "navigate", "url": "{step.path}"},
  {"action": "wait", "seconds": 3},
  {"action": "screenshot", "label": "{step.title} page"}
]
```

#### 2.2 Create AI Selenium Job via API

For each step:
```
POST {site_url}/api/resource/AI Selenium Job
Authorization: token {api_key}:{api_secret}
Content-Type: application/json

{
  "job_name": "Onboarding Video: {step_title}",
  "target_doctype": "{reference_document}",
  "target_url": "/app/{doctype-slug}",
  "action_preset": "Read Only",
  "execution_mode": "Background (Headless)",
  "log_level": "Detailed",
  "window_width": 1920,
  "window_height": 1080,
  "page_load_timeout": 30,
  "step_timeout": 15,
  "max_runtime": 120,
  "test_steps_json": "{steps_json_string}"
}
```

#### 2.3 Enqueue and Monitor

```
POST {site_url}/api/method/run_doc_method
Authorization: token {api_key}:{api_secret}
Content-Type: application/json

{
  "dt": "AI Selenium Job",
  "dn": "{job_name}",
  "method": "enqueue_run"
}
```

**Polling loop** (max 120s per job):
```
GET {site_url}/api/resource/AI Selenium Job/{job_name}
  ?fields=["status","video_file","narrated_video_file","error_log"]
```

Wait 5s between polls. Status transitions: Queued -> Starting -> Running -> Completed/Failed.

#### 2.4 Attach Video URL to Step Fixture

When job completes with `video_file`:
- Use `narrated_video_file` if available (has TTS voice-over), else `video_file`
- Set step fixture's `intro_video_url` to the file URL
- Log: "Video generated for step: {title} -> {video_url}"

When job fails:
- Log warning: "Video generation failed for step: {title}: {error_log}"
- Continue with next step (don't block fixture generation)

---

## Lessons Learned

Living knowledge base. Updated after each run. Consult BEFORE creating new
onboarding setups or Selenium jobs to avoid repeating mistakes.

**Update rule**: When a lesson is confirmed by experience, change `[ ]` to `[x]`.
When a lesson is wrong, strike it and add the correction.

---

### A. Frappe Onboarding System (Native)

#### A1. DocType Relationships
```
Module Onboarding (parent)
  -> steps: child table "Onboarding Step Map" (field: step = Link to Onboarding Step)
  -> allow_roles: child table "Onboarding Permission" (field: role = Link to Role)

Onboarding Step (standalone)
  -> action: Select (Create Entry | Update Settings | Show Form Tour | View Report | Go to Page | Watch Video)
  -> reference_document: Link to DocType (for Create Entry / Update Settings)
  -> path: Data (for Go to Page -- relative URL like /app/chart-of-accounts)
  -> form_tour: Link to Form Tour (for Show Form Tour)
  -> intro_video_url: Data (URL to video -- displayed in widget)
```

#### A2. How Frappe Loads Onboarding
- Frappe checks `Module Onboarding` records matching the user's allowed modules
- Displayed on the Setup Wizard / module home page
- Native widget is basic -- our custom `onboarding_widget.js` replaces it entirely
- Custom widget calls `frappe_theme_switcher.utils.onboarding.get_onboarding_data()`

#### A3. Step Actions Behavior
| Action | What happens when user clicks |
|---|---|
| Create Entry | Opens new form: `/app/{doctype}/new` |
| Update Settings | Opens settings form: `/app/{doctype}` (is_single=1) |
| Show Form Tour | Opens form + starts guided tour overlay |
| View Report | Opens report page |
| Go to Page | Navigates to `step.path` |
| Watch Video | Opens video player with `intro_video_url` |

#### A4. Custom Fields on Onboarding Step (`custom_ab_*`)
These extend native steps for our widget:
- `custom_ab_priority` (Select: Required/Optional) -- groups steps in UI
- `custom_ab_task_key` (Data) -- machine key for auto-completion checks (e.g., "company_created")
- `custom_ab_sort_order` (Int) -- display order within priority group
- `custom_ab_icon` (Data) -- Font Awesome class (e.g., "fa-building")
- `custom_ab_enable_ai_help` (Check) -- shows "Ask Sanad" button if sanad app installed
- `custom_ab_wizard_fields` (Code/JSON) -- multi-step wizard dialog config
- `custom_ab_html_block` (Link -> Custom HTML Block) -- rich content in wizard dialog

#### A5. Wizard Fields JSON Format
```json
[
  {"step": "Company Info", "fields": ["company_name", "domain", "country"]},
  {"step": "Defaults", "fields": ["default_currency", "default_letter_head"]},
  {"step": "Review", "fields": ["abbr", "is_group"]}
]
```
- Each `step` is a wizard page with prev/next navigation
- `fields` must be valid fieldnames in the `reference_document` DocType
- Fields are rendered using real DocType meta (fieldtype, options, reqd from meta)
- Section visibility via `depends_on: eval:cur_dialog.__wizard_step === N`
- Max 5 steps recommended (users abandon long wizards)
- Max 8 fields per step (scrolling in dialog is bad UX)

---

### B. Fixture Patterns

#### B1. Fixture Export Rules
- [ ] Fixtures are JSON arrays exported via `bench export-fixtures`
- [ ] `hooks.py` `fixtures` list controls what gets exported
- [ ] Filter syntax: `{"dt": "DocType", "filters": [["field", "op", "value"]]}`
- [ ] Custom Fields filter by `module` (not individual names) -- catches all at once
- [ ] Onboarding Steps filter by `name` (explicit list) -- because they're shared DocType
- [ ] Module Onboarding filter by `name` (usually just one per app)

#### B2. Fixture Gotchas
- [ ] **`name` field in fixtures is the primary key** -- if you change it, Frappe creates a duplicate instead of updating
- [ ] **Child table rows need `parenttype` and `parentfield`** -- but `bench export-fixtures` handles this automatically
- [ ] **Custom fields need `module` set** to your app's module name, or the filter won't catch them
- [ ] **Don't include `modified` or `creation` timestamps** -- Frappe sets these on import
- [ ] **Order of fixtures in hooks.py matters** -- Custom Fields must come before DocTypes that use them
- [ ] **`bench migrate` applies fixtures** -- no separate import command needed
- [ ] **Fixture JSON must be valid** -- trailing commas or unescaped strings break `bench migrate` silently

#### B3. Custom Field `insert_after` Chain
Custom fields must form a valid chain:
```
is_skipped (native field)
  -> custom_ab_section (Section Break, insert_after: is_skipped)
    -> custom_ab_priority (insert_after: custom_ab_section)
      -> custom_ab_task_key (insert_after: custom_ab_priority)
        -> ... and so on
```
If you break the chain (insert_after points to non-existent field), the field lands at the bottom of the form.

---

### C. AI Selenium Job Patterns

#### C1. API Access
- **Auth**: `Authorization: token {api_key}:{api_secret}` (NOT Bearer, NOT Basic)
- **Create**: `POST /api/resource/AI Selenium Job` with JSON body
- **Run method**: `POST /api/method/run_doc_method` with `{dt, dn, method: "enqueue_run"}`
- **Preflight**: `POST /api/method/run_doc_method` with `{dt, dn, method: "preflight_check"}`
- **Poll**: `GET /api/resource/AI Selenium Job/{name}?fields=["status","video_file","error_log"]`
- **Enqueue returns immediately** -- job runs async in RQ `long` queue

#### C2. Key Fields
| Field | Type | Notes |
|---|---|---|
| `job_name` | Data (required) | Human label, NOT the Frappe doc name |
| `name` | Auto | Pattern: `AISJ-.#####` (e.g., AISJ-00001) |
| `status` | Select (read_only) | Queued/Starting/Running/Completed/Failed/Cancelled |
| `execution_mode` | Select | "Background (Headless)" for API, "Live Stream" for debug |
| `action_preset` | Select | "Read Only" for videos (safe, no data changes) |
| `test_steps_json` | Code/JSON | JSON string of step array |
| `video_file` | Attach | Raw MP4 URL (populated async after completion) |
| `narrated_video_file` | Attach | MP4 + TTS narration URL |
| `target_doctype` | Link | Which DocType being tested/recorded |
| `login_user` | Link to User | Who the browser logs in as |

#### C3. Action Presets
| Preset | Allowed Actions | Use Case |
|---|---|---|
| Read Only | navigate, wait, wait_for, screenshot, read_field, assert_* | Video walkthroughs, safe |
| Form Tester | + fill_field, set_frappe_field, click, save_document, add_child_row | QA form testing |
| Full QA | + submit_document, amend_document | Full workflow tests |
| Custom | User-defined JSON | Special cases |

#### C4. Complete Step Action Reference (All 18 Handlers)

**IMPORTANT**: Step JSON uses `"type"` key (not `"action"`). Example: `{"type": "navigate", "url": "/app/company"}`

##### Navigation & Timing
| Action | Params | Notes |
|---|---|---|
| `navigate` | `url` (required) | Relative paths auto-prepend `site_url`. Sleeps 1s after. |
| `wait` | `seconds` (required) | Clamped to [0.1, 30]. Chain multiple for longer waits. |
| `wait_for` | `selector` (required), `timeout` (optional, default=step_timeout) | CSS selector only, not XPath. Checks DOM presence, not visibility. |

##### Capture
| Action | Params | Notes |
|---|---|---|
| `screenshot` | none | Handler is a no-op — actual capture is in runner post-processing. **Only captured if log_level is Detailed or Full Debug** (Summary = zero screenshots). |

##### Read / Assert
| Action | Params | Notes |
|---|---|---|
| `read_field` | `fieldname` (required) | Runs `cur_frm.doc[fieldname]`. Fieldname sanitized: `^[a-zA-Z_][a-zA-Z0-9_]*$`. Only works on form pages. |
| `assert_text` | `expected` (required), `selector` (optional, default="body") | **Substring match**, not exact. `"Draft"` matches `"Draft Order"`. |
| `assert_url` | `expected` (required) | **Substring match** on full URL. Use distinctive fragments. |
| `assert_element_exists` | `selector` (required) | Uses `find_elements` (plural). Hidden elements still pass. |

##### Form Fill (Form Tester preset+)
| Action | Params | Notes |
|---|---|---|
| `fill_field` | `selector` (CSS, required), `value` (required) | Raw `.clear()` + `.send_keys()`. Does NOT trigger Frappe JS events. Use only for HTML inputs (login, search). |
| `set_frappe_field` | `fieldname` (required), `value` (required) | Runs `cur_frm.set_value()`. Sleeps 0.5s. Does NOT await async fetches — add `wait` after for dependent fields. |
| `set_link_field` | `fieldname` (required), `value` (required) | Like `set_frappe_field` but verifies value was set + waits 1s. Has API fallback for saved docs. Use for Link fields that trigger fetches. |
| `click` | `selector` OR `label` (one required) | `label` is case-insensitive substring on button text. `"Save"` matches `"Save & Submit"`. Sleeps 1s after. |
| `add_child_row` | `table_fieldname` (required), `row_data` (dict, required) | Removes empty default rows first. Sets fields sequentially (not parallel) to allow fetch triggers. Takes ~1.5-2s minimum. Add `wait` after. |

##### Document Actions (Full QA preset)
| Action | Params | Notes |
|---|---|---|
| `save_document` | none | Three-layer: JS save -> auto-fill mandatory -> API fallback. **API fallback reloads the page** (URL may change). |
| `submit_document` | none | Calls `cur_frm.submit()`, clicks confirm modal. **No fallback, no verification.** Always follow with `assert_text` to verify. |
| `amend_document` | none | Calls `cur_frm.amend_doc()`, sleeps 2s. No verification — follow with `assert_url`. |

##### Custom JS (Custom preset ONLY — not in Read Only/Form Tester/Full QA)
| Action | Params | Notes |
|---|---|---|
| `execute_js` | `code` (required) | Blocked keywords (case-insensitive): `frappe.call`, `frappe.xcall`, `fetch(`, `eval(`, `document.cookie`, `XMLHttpRequest`, `window.open`, `localStorage`, `sessionStorage`, `importScripts`. |

##### Key Pitfalls for Steps
1. **Blocked steps are SKIPPED, not failed** — `steps_skipped` increments, not `steps_failed`
2. **`execute_js` is in NO default preset** — must use Custom + explicit `allowed_actions`
3. **`screenshot` at Summary level = zero captures** — always use Detailed for video
4. **Fieldname regex is strict**: `^[a-zA-Z_][a-zA-Z0-9_]*$` — digits-first or dots fail
5. **`set_frappe_field` doesn't await fetches** — use `set_link_field` for Link fields, add `wait` after
6. **`add_child_row` removes empty rows** — intentional, but can delete sparse intentional rows

#### C5. AI Agent Tool API (tools/selenium_testing.py)
| Tool | Required | Returns |
|---|---|---|
| `selenium_run_test` | `job_name`, `test_steps` | `{job_name, status, steps_count}` |
| `selenium_check_job` | `job_name` (AISJ-XXXXX) | `{status, step_log, error_log, duration}` |
| `selenium_get_screenshots` | `job_name` | `{screenshot_count, screenshots: [...]}` |
| `selenium_get_video` | `job_name` | `{video_file, narrated_video_file}` |
| `selenium_cancel_job` | `job_name` | Cancels via Redis flag |
| `selenium_quick_screenshot` | `url` | Creates 3-step Read Only job |
| `selenium_list_jobs` | (optional) `limit`, `status_filter` | List of recent jobs |

**Concurrency**: `max_concurrent_jobs` (default 2) global, `max_jobs_per_user` (default 1) per user.

#### C6. Login Flow (helpers.py)
```
API Key Auth (preferred, use_api_key_auth=1):
  1. Python requests verify key via GET /api/method/frappe.auth.get_logged_user
  2. Browser JS fetch to get cookies set natively
  3. Fallback: Python requests + inject cookies into driver
  4. Last resort: XHR from browser

Password Auth:
  1. Browser JS fetch to /api/method/login
  2. Python requests + cookie injection
  3. Form-fill fallback: navigate /login, fill #login_email/#login_password, click .btn-login

Remote Site:
  - Set remote_site on job -> reads Remote Frappe Site doctype for site_url + credentials
  - All navigate steps auto-prepend remote site URL
```

#### C7. Chrome Configuration
```
Flags: --headless --no-sandbox --disable-dev-shm-usage --disable-gpu
       --disable-extensions --disable-infobars --disable-notifications
       --start-maximized --window-size=WxH
       --user-data-dir=/tmp/selenium_profile_{job_name}  (isolated per job)
```
Profile dir created fresh per job, cleaned up in `cleanup_chrome()`.

#### C8. AI Selenium Settings (Key Fields)
| Field | Default | Notes |
|---|---|---|
| `enabled` | 0 | Must be 1 or all tools return error |
| `chrome_binary_path` | `/usr/bin/chromium` | |
| `chromedriver_path` | `/usr/bin/chromedriver` | Falls back to webdriver-manager |
| `default_window_width/height` | 1920/1080 | |
| `default_page_load_timeout` | 30s | |
| `default_step_timeout` | 15s | Used by `wait_for` |
| `default_max_runtime` | 540s | Job killed after this |
| `max_concurrent_jobs` | 2 | Global limit |
| `max_jobs_per_user` | 1 | Per-user limit |
| `use_api_key_auth` | 1 | Preferred over password |
| `video_fps` | 2 | Frames per second |
| `narration_enabled` | 0 | Requires edge-tts + ffmpeg |
| `narration_voice` | en-US-GuyNeural | Any edge-tts voice |
| `cleanup_after_days` | 30 | Daily cleanup of old files |
| `min_free_disk_mb` | 500 | Pre-flight disk check |

#### C9. Video Pipeline (How It Works)
```
1. SeleniumTestRunner executes steps
   -> Captures JPEG frame at each `screenshot` action
   -> Frames saved to temp dir: /tmp/selenium_frames_{job_name}_*/

2. After all steps complete (status=Completed):
   -> Runner calls frappe.enqueue(process_video_and_narration)
   -> This is a SEPARATE background job (not the same RQ job)

3. process_video_and_narration():
   a. stitch_video() -- imageio reads JPEGs, writes MP4 (libx264, 2fps)
   b. save_video_as_file() -- creates Frappe File, sets video_file URL
   c. If narration enabled:
      - generate_narration_script() -- parses step_log text into segments
      - generate_voice_clips() -- edge-tts async generates MP3 per segment
      - merge_video_audio() -- ffmpeg positions audio at timestamps
      - save_video_as_file() -- sets narrated_video_file URL
   d. Cleanup: shutil.rmtree(frame_dir)
```

#### C6. Server Requirements for Video
- **Chrome/Chromium** -- headless browser (path in AI Selenium Settings)
- **imageio** -- Python package for JPEG -> MP4 stitching
- **edge-tts** -- Free TTS (Microsoft Edge voices, no API key needed)
- **ffmpeg** -- Audio/video merge (only needed for narrated video)
- If any dependency missing, the job still runs but video/narration may not generate

---

### D. Confirmed Gotchas (from code review + experience)

Mark `[x]` when confirmed by a real run, add date.

#### D1. Job Lifecycle
- [ ] **Preflight before enqueue**: Always call `preflight_check` first -- catches missing Chrome, auth, etc.
- [ ] **User Browser mode = server crash**: Never use "User Browser" for API-triggered jobs
- [ ] **Poll interval**: 5s between polls, max 120s total per job, then timeout
- [ ] **job_name != name**: `job_name` is the human label, `name` is `AISJ-XXXXX` auto-generated
- [ ] **test_steps_json is a string**: Must `JSON.stringify()` / `json.dumps()` the array
- [ ] **Empty test_steps_json blocks enqueue**: `enqueue_run` throws if no steps defined
- [ ] **`frappe.enqueue` reserves `job_name`**: Runner uses `selenium_job_name=` param instead
- [ ] **Cancel is Redis-based, not interrupt**: Flag checked only between steps. A 30s `wait` won't be interrupted mid-sleep.

#### D2. Step Execution
- [ ] **Blocked steps are SKIPPED, not failed**: `steps_skipped` counter, not `steps_failed`. Verify preset includes all your step types.
- [ ] **`execute_js` is in NO default preset**: Must use Custom preset + explicit `allowed_actions` JSON
- [ ] **`screenshot` at Summary log level = zero captures**: Always use Detailed or Full Debug for video
- [ ] **`set_frappe_field` doesn't await async fetches**: Link fields that trigger `item_code -> item_name` etc. need a `wait` step after
- [ ] **Use `set_link_field` for Link fields**: It verifies value was set + has API fallback
- [ ] **`add_child_row` removes empty default rows**: Removes rows where none of the `row_data` keys have a value. Can delete intentionally sparse rows.
- [ ] **`save_document` fallback reloads the page**: URL may change after API save. Add explicit `navigate` after if subsequent steps depend on URL.
- [ ] **`submit_document` has no verification**: Always follow with `assert_text` or `assert_url`
- [ ] **`click` label is substring match**: `"Save"` matches `"Save & Submit"`. Use `selector` for precision.
- [ ] **Fieldname regex strict**: `^[a-zA-Z_][a-zA-Z0-9_]*$`. Digits-first or dots/hyphens fail with ValueError.
- [ ] **Step JSON uses `"type"` key**: `{"type": "navigate"}` not `{"action": "navigate"}`

#### D3. Video & Narration
- [ ] **Video is async**: After status=Completed, video stitching runs as SEPARATE background job. Poll `video_file` with 10s delay.
- [ ] **Chrome orphan killer**: Hourly task kills stuck Chrome after `max_runtime + 120s`
- [ ] **Even dimensions required**: libx264 needs even height/width -- `stitch_video()` auto-trims odd pixels
- [ ] **ffmpeg missing = no narration**: Raw video still works, just no voice-over
- [ ] **edge-tts needs asyncio**: Uses `asyncio.new_event_loop()` in synchronous frappe context
- [ ] **Frame cleanup automatic**: `shutil.rmtree(frame_dir)` runs in `finally` block
- [ ] **Video silently fails if imageio missing**: Logs to `AI Agent Action Log`, job itself still shows Completed
- [ ] **Log lines written to Redis every 5 steps**: `selenium_check_job` during execution reads Redis, after completion reads DB `step_log`

#### D4. Auth & Remote Sites
- [ ] **API Key auth preferred**: Set `use_api_key_auth=1` in Settings. Reads from User record `api_key`/`api_secret`.
- [ ] **Remote site auto-prepends URL**: All `navigate` steps use remote site URL, not local. Dry-run first.
- [ ] **Settings defaults apply on insert**: `_apply_settings_defaults()` fills blanks from AI Selenium Settings
- [ ] **Concurrency limits**: `max_concurrent_jobs=2` global, `max_jobs_per_user=1`. Will fail if exceeded.
- [ ] **Chrome profile isolated per job**: `/tmp/selenium_profile_{job_name}/` created fresh, cleaned up after

---

### E. Onboarding-Specific Lessons

- [ ] **Step names must be globally unique** -- Onboarding Step is a standalone DocType, names are shared across all apps
  - Use descriptive names: "Add Your Company Details" not "Step 1"
  - Prefix with app context if needed: "AB: Configure Bid Settings"
- [ ] **wizard_fields must reference real fields** -- If a fieldname doesn't exist in the reference_document meta, the wizard silently skips it
- [ ] **Section Break labels become wizard step titles** -- Make them user-friendly, not technical
- [ ] **Required vs Optional grouping** -- Users complete Required first; Optional shown dimmed but accessible
- [ ] **icon must be full FA class** -- "fa-building" not just "building"
- [ ] **task_key is for auto-complete detection** -- Backend checks like "does Company exist?" use this key
- [ ] **HTML Block in wizard** -- Uses `frappe.create_shadow_element()` for sandboxed rendering
  - Fallback: HTML + CSS only, NO script execution (security)
- [ ] **Sanad AI button** -- Only shows if `enable_ai_help=1` AND `sanad_business_intelligence_ai` app installed
  - Detection: `frappe.sanadAI && frappe.sanadAI.isAvailable()`
  - Bridge: `frappe_theme_switcher/public/js/sanad_ai.js` wraps `window.sanadAIWidget`
- [ ] **intro_video_url validation** -- Widget only opens URLs with `http:` or `https:` protocol (XSS protection)
- [ ] **Multi-language** -- ALL user-facing strings must use `__()`, including wizard step labels, button text, error messages
  - Common miss: `caption:` in DevExtreme, `label:` in dialog fields, fallback strings in `||` expressions
- [ ] **Duplicate detection on save** -- Wizard checks `autoname` pattern:
  - `field:fieldname` -> checks if value exists
  - `naming_series` or `hash` -> skips check
  - `prompt` -> checks if `name` value exists
  - Shows confirm dialog if duplicate found

---

### F. Improving Video Quality (iterate each run)

- [ ] Add 1-2s `wait` AFTER navigation before first screenshot (let CSS animations settle)
- [ ] Use `wait_for` with specific selectors: `.form-page`, `.frappe-control[data-fieldname=X]`
- [ ] For long forms: add `scroll` steps between screenshot groups (TODO: verify action exists)
- [ ] FPS=2 is good for step-by-step walkthroughs (smooth enough, small files ~1-5MB)
- [ ] FPS=4-6 for smoother demo videos (larger files, better for marketing)
- [ ] Window 1920x1080 for desktop screenshots (text is readable)
- [ ] Window 1280x720 for smaller file size if quality isn't critical
- [ ] Screenshot labels become narration text -- write them as natural speech:
  - Good: "The Company form is now loaded with all fields visible"
  - Bad: "screenshot_company_form_1"
- [ ] Add `assert_element_exists` before screenshots to confirm page loaded (prevents blank frames)
- [ ] Consider recording wizard dialog interactions (not just the DocType form)

---

### G. Troubleshooting Decision Tree

```
Job stuck in "Queued"?
  -> Check: Is RQ worker running? (`bench doctor`)
  -> Check: Is `long` queue enabled? (`bench worker --queue long`)
  -> Orphan killer will mark Failed after max_runtime + 120s

Job fails immediately (status: Failed)?
  -> Read error_log field
  -> Common: Chrome binary not found -> set path in AI Selenium Settings
  -> Common: Login user not set -> set default_login_user in Settings
  -> Common: test_steps_json invalid JSON -> validate with json.loads()

Job completes but no video_file?
  -> Check: Is imageio installed? (`pip install imageio[ffmpeg]`)
  -> Check: Were any screenshots taken? (look at screenshots child table)
  -> Check: Did process_video_and_narration background job run? (check RQ dashboard)
  -> Video processing error logged in error_log field

Video exists but no narrated_video_file?
  -> Check: Is ffmpeg installed? (`ffmpeg -version`)
  -> Check: Is edge-tts installed? (`pip install edge-tts`)
  -> Check error_log for "ffmpeg not found" or "tts_clip_failed"

Narration sounds wrong / misaligned?
  -> Step log timestamps drive narration positioning
  -> If steps run too fast, narration overlaps
  -> Fix: Add longer `wait` between screenshot steps (2-3s)
  -> Voice options: "en-US-GuyNeural" (male), "en-US-JennyNeural" (female)
```

---

## Output Checklist

After completion, verify:
- [ ] `fixtures/onboarding_step.json` has all step records with valid wizard_fields JSON
- [ ] `fixtures/module_onboarding.json` links all steps in correct order
- [ ] `fixtures/custom_field.json` has all `custom_ab_*` fields for Onboarding Step
- [ ] `hooks.py` fixture entries updated
- [ ] All strings use `__()` for translation (in widget/wizard JS)
- [ ] If --with-video: `intro_video_url` set on steps that got video
- [ ] No hardcoded site URLs in fixtures (only in video generation API calls)
- [ ] Step names are unique and descriptive
- [ ] wizard_fields JSON validates (parseable, fields exist in DocType meta)

---

## Reference Skills (auto-consulted)

- `erpnext-syntax-hooks` -- hooks.py fixture syntax
- `erpnext-syntax-customapp` -- app structure, fixtures
- `erpnext-impl-hooks` -- fixture export patterns
- `erpnext-api-patterns` -- REST API call patterns
- `clean-code` -- validate generated code
