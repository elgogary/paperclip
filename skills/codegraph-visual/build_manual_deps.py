#!/usr/bin/env python3
"""
Add manual dependency layers (hooks, doctype_link, js_call) to codegraph-data.json.

Usage:
  python3 build_manual_deps.py /path/to/codegraph-data.json

Edit the MANUAL_DEPS list below for your project, then run.
The script merges manual deps into existing codegraph data, boosting weights
where both layers found the same connection.
"""
import json
import sys

if len(sys.argv) < 2:
    print("Usage: build_manual_deps.py <codegraph-data.json>")
    sys.exit(1)

data_path = sys.argv[1]
with open(data_path) as f:
    data = json.load(f)

# ── EDIT THIS LIST FOR YOUR PROJECT ─────────────────────────────────
# Format: (source_module, target_module, weight, description, layer)
# Layers: "hooks", "doctype_link", "js_call"
MANUAL_DEPS = [
    # Example entries — replace with your project's actual deps:
    # ("hooks.py", "my_module", 6, "Project after_insert → auto_create", "hooks"),
    # ("module_a", "module_b", 4, "DocType Link field: doc_a.field → DocType B", "doctype_link"),
    # ("public", "module_c", 3, "JS frappe.call to module_c API", "js_call"),
]

if not MANUAL_DEPS:
    print("No manual deps defined. Edit MANUAL_DEPS in this file first.")
    sys.exit(0)

# Build lookup of existing depends links
existing = {}
for link in data["links"]:
    if link["type"] == "depends":
        key = link["source"] + "|" + link["target"]
        existing[key] = link

node_ids = set(n["id"] for n in data["nodes"])
added = 0

for src, tgt, weight, desc, layer in MANUAL_DEPS:
    src_id = "mod:" + src
    tgt_id = "mod:" + tgt

    # Add module node if missing
    for mid, mname in [(src_id, src), (tgt_id, tgt)]:
        if mid not in node_ids:
            data["nodes"].append({
                "id": mid, "name": mname, "kind": "module", "fullName": mname,
                "size": 0, "classes": 0, "functions": 0, "imports": 0,
                "topClasses": [], "topFunctions": [],
            })
            node_ids.add(mid)

    key = src_id + "|" + tgt_id
    if key in existing:
        # Merge: boost weight, add layer
        existing[key]["weight"] += int(weight * 0.3)
        if layer not in existing[key].get("layers", []):
            existing[key].setdefault("layers", []).append(layer)
        existing[key]["description"] = existing[key].get("description", "") + " | " + desc
    else:
        link = {
            "source": src_id, "target": tgt_id,
            "type": "depends", "weight": weight,
            "layers": [layer], "description": desc,
        }
        data["links"].append(link)
        existing[key] = link
        added += 1

# Update stats
layer_counts = {"codegraph": 0, "hooks": 0, "doctype_link": 0, "js_call": 0}
for link in data["links"]:
    if link["type"] == "depends":
        for ly in link.get("layers", []):
            layer_counts[ly] = layer_counts.get(ly, 0) + 1

data["stats"]["layers"] = layer_counts
data["stats"]["crossModuleEdges"] = sum(1 for l in data["links"] if l["type"] == "depends")

with open(data_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"Added {added} new deps, merged into {len(existing) - added} existing. Total deps: {data['stats']['crossModuleEdges']}")
