#!/usr/bin/env python3
"""
Auto-detect ERPNext/Frappe DocType Link field dependencies and add them to codegraph-data.json.

Scans all DocType JSON files for Link fields pointing to standard ERPNext/Frappe/HRMS DocTypes.
Also detects override_doctype_class in hooks.py.

Usage:
  python3 add_erpnext_layer.py <codegraph-data.json> <project-root> [--module-map <func>]

The --module-map argument is a Python function name that maps a DocType folder name to a
logical module name. If not provided, uses the folder name directly.
"""
import json, os, sys, glob
from collections import defaultdict
from pathlib import Path

if len(sys.argv) < 3:
    print("Usage: add_erpnext_layer.py <codegraph-data.json> <project-root>")
    sys.exit(1)

data_path = sys.argv[1]
project_root = sys.argv[2]

# Load graph
with open(data_path) as f:
    data = json.load(f)

# Load ERPNext module map
skill_dir = Path(__file__).parent
with open(skill_dir / 'erpnext_modules.json') as f:
    erpnext_modules = json.load(f)

# Build reverse lookup: DocType name -> ERPNext module
doctype_to_module = {}
for mod, doctypes in erpnext_modules.items():
    for dt in doctypes:
        doctype_to_module[dt] = mod

# Collect all ERPNext DocType names for matching
all_erpnext_doctypes = set(doctype_to_module.keys())

# ── Scan DocType JSONs ──────────────────────────────────────────────────
node_ids = set(n['id'] for n in data['nodes'])
module_names = set(n['name'] for n in data['nodes'] if n['kind'] == 'module')

# Auto-detect module mapper from existing graph modules
# Scan all JSON files for Link fields
deps = defaultdict(lambda: defaultdict(set))  # lipton_mod -> erpnext_mod -> set(descriptions)

for jf in glob.glob(os.path.join(project_root, '**/doctype/**/*.json'), recursive=True):
    if '/__' in jf or '/node_modules/' in jf:
        continue
    try:
        with open(jf) as f:
            doc = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError):
        continue

    if not isinstance(doc, dict) or 'fields' not in doc:
        continue

    dt_folder = os.path.basename(os.path.dirname(jf))

    # Find which module this doctype belongs to in our graph
    lipton_mod = None
    for node in data['nodes']:
        if node['kind'] == 'class' and node.get('file', ''):
            if dt_folder in node['file']:
                lipton_mod = node.get('module')
                break
    if not lipton_mod:
        # Try matching module name directly
        for mn in module_names:
            if dt_folder.startswith(mn.replace('doctypes_', '')):
                lipton_mod = mn
                break
    if not lipton_mod:
        lipton_mod = 'doctypes_other'

    for field in doc.get('fields', []):
        options = field.get('options', '')
        if field.get('fieldtype') == 'Link' and options in all_erpnext_doctypes:
            erpnext_mod = doctype_to_module[options]
            deps[lipton_mod][erpnext_mod].add(f"{field.get('fieldname', '?')} -> {options}")

# ── Scan hooks.py for override_doctype_class ────────────────────────────
hooks_path = None
for hp in glob.glob(os.path.join(project_root, '**/hooks.py'), recursive=True):
    if 'node_modules' not in hp:
        hooks_path = hp
        break

if hooks_path:
    with open(hooks_path) as f:
        hooks_content = f.read()
    # Parse override_doctype_class
    if 'override_doctype_class' in hooks_content:
        import ast
        try:
            tree = ast.parse(hooks_content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name) and target.id == 'override_doctype_class':
                            if isinstance(node.value, ast.Dict):
                                for key in node.value.keys:
                                    if isinstance(key, ast.Constant) and key.value in all_erpnext_doctypes:
                                        erpnext_mod = doctype_to_module[key.value]
                                        deps['overrides'][erpnext_mod].add(f'override -> {key.value}')
        except SyntaxError:
            pass

# ── Add ERPNext virtual modules and links ───────────────────────────────
ERPNEXT_COLORS = {
    'erpnext_selling': '#2da44e', 'erpnext_buying': '#1a7f37', 'erpnext_stock': '#bf8700',
    'erpnext_accounts': '#8250df', 'erpnext_setup': '#57606a', 'erpnext_crm': '#0969da',
    'erpnext_manufacturing': '#e16f24', 'erpnext_projects': '#1a7f37', 'erpnext_assets': '#0550ae',
    'erpnext_support': '#cf222e', 'hrms_hr': '#e16f24', 'hrms_payroll': '#953800',
    'frappe_core': '#6e7781', 'frappe_workflow': '#d1242f', 'frappe_email': '#57606a',
}

ERPNEXT_LABELS = {
    'erpnext_selling': 'ERPNext Selling', 'erpnext_buying': 'ERPNext Buying',
    'erpnext_stock': 'ERPNext Stock', 'erpnext_accounts': 'ERPNext Accounts',
    'erpnext_setup': 'ERPNext Setup', 'erpnext_crm': 'ERPNext CRM',
    'erpnext_manufacturing': 'ERPNext Manufacturing', 'erpnext_projects': 'ERPNext Projects',
    'erpnext_assets': 'ERPNext Assets', 'erpnext_support': 'ERPNext Support',
    'hrms_hr': 'HRMS HR', 'hrms_payroll': 'HRMS Payroll',
    'frappe_core': 'Frappe Core', 'frappe_workflow': 'Frappe Workflow',
    'frappe_email': 'Frappe Email',
}

# Only add ERPNext modules that are actually referenced
referenced_erpnext_mods = set()
for lipton_mod, erpnext_mods in deps.items():
    for em in erpnext_mods:
        referenced_erpnext_mods.add(em)

added_nodes = 0
added_links = 0

for em in referenced_erpnext_mods:
    eid = 'ext:' + em
    if eid not in node_ids:
        data['nodes'].append({
            'id': eid, 'name': ERPNEXT_LABELS.get(em, em), 'kind': 'external',
            'fullName': ERPNEXT_LABELS.get(em, em), 'size': 0, 'classes': 0, 'functions': 0,
            'imports': 0, 'topClasses': [], 'topFunctions': [],
            'systemType': 'framework', 'protocol': 'DocType Link Fields',
            'description': ERPNEXT_LABELS.get(em, em),
        })
        node_ids.add(eid)
        added_nodes += 1

for lipton_mod, erpnext_mods in deps.items():
    src_id = 'mod:' + lipton_mod
    if src_id not in node_ids:
        continue
    for em, fields in erpnext_mods.items():
        tgt_id = 'ext:' + em
        desc = ', '.join(sorted(fields))
        data['links'].append({
            'source': src_id, 'target': tgt_id,
            'type': 'external', 'weight': len(fields),
            'layers': ['doctype_link'], 'description': desc,
        })
        added_links += 1

# Update stats
data['stats']['layers'] = data['stats'].get('layers', {})
data['stats']['layers']['doctype_link'] = data['stats']['layers'].get('doctype_link', 0) + added_links
data['stats']['externalEdges'] = data['stats'].get('externalEdges', 0) + added_links

with open(data_path, 'w') as f:
    json.dump(data, f, indent=2)

print(f"ERPNext layer added: {added_nodes} module nodes, {added_links} dependency links")
print(f"Referenced ERPNext modules: {sorted(referenced_erpnext_mods)}")