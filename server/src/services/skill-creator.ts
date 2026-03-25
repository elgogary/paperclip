import type { Db } from "@paperclipai/db";
import { toSlug } from "../utils/slug.js";

export type GeneratedSkill = {
  name: string;
  slug: string;
  description: string;
  instructions: string;
  category: string;
  triggerHint: string;
};

// TODO: Replace with LLM-based generation when LiteLLM integration is ready
function generateFromTemplate(description: string, category: string): GeneratedSkill {
  const name = description
    .split(" ")
    .slice(0, 4)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const slug = toSlug(name);

  const instructions = `---
name: ${slug}
description: ${description}
---

# ${name}

## When to Use
Use this skill when: ${description}

## Instructions
1. [Step 1 -- describe first action]
2. [Step 2 -- describe next action]
3. [Step 3 -- verify results]

## Examples
[Add examples of when this skill applies]

## Edge Cases
[Add edge cases and how to handle them]
`;

  return {
    name,
    slug,
    description,
    instructions,
    category,
    triggerHint: `Use when: ${description}`,
  };
}

export function skillCreatorService(_db: Db) {
  return {
    async generateSkill(input: {
      description: string;
      category?: string;
      companyId: string;
    }): Promise<GeneratedSkill> {
      const category = input.category ?? "custom";
      return generateFromTemplate(input.description, category);
    },
  };
}
