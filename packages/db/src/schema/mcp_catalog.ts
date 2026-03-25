import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const mcpCatalog = pgTable(
  "mcp_catalog",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    category: text("category"),
    npmPackage: text("npm_package"),
    transport: text("transport").notNull().default("stdio"),
    defaultCommand: text("default_command"),
    defaultArgs: jsonb("default_args").$type<string[]>(),
    requiredEnv: jsonb("required_env").$type<{ key: string; label: string; required: boolean }[]>(),
    docsUrl: text("docs_url"),
    popularity: integer("popularity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);
