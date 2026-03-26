import { Router } from "express";
import type { Db } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { listAvailableSkills, readSkillMarkdown } from "./access-helpers.js";

export function accessSkillsRoutes(
  _db: Db,
  _opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  }
) {
  const router = Router();

  router.get("/skills/available", (_req, res) => {
    res.json({ skills: listAvailableSkills() });
  });

  router.get("/skills/index", (_req, res) => {
    res.json({
      skills: [
        { name: "paperclip", path: "/api/skills/paperclip" },
        {
          name: "para-memory-files",
          path: "/api/skills/para-memory-files"
        },
        {
          name: "paperclip-create-agent",
          path: "/api/skills/paperclip-create-agent"
        }
      ]
    });
  });

  router.get("/skills/:skillName", (req, res) => {
    const skillName = (req.params.skillName as string).trim().toLowerCase();
    const markdown = readSkillMarkdown(skillName);
    if (!markdown) throw notFound("Skill not found");
    res.type("text/markdown").send(markdown);
  });

  return router;
}
