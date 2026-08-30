/**
 * Template strings for seed context files.
 * All templates include proper YAML frontmatter with the required schema.
 */

import { generateFrontmatter, serializeContent } from "../fs/frontmatter.js";

/**
 * Generate frontmatter with current timestamps.
 */
function makeFm(id: string, title: string, importance: string, tags: string[]) {
  const fm = generateFrontmatter(id, title);
  fm.importance = importance as any;
  fm.tags = tags;
  fm.source = "manual";
  return fm;
}

/**
 * CONTEXT_GUIDE.md — Teaches AI agents how to use the context system.
 */
export const CONTEXT_GUIDE_MD = `---
id: context-guide
title: "CONTEXT GUIDE — Personal Context System"
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
version: 1
importance: critical
tags:
  - guide
  - system
  - core
source: manual
stale: false
stale_reason: null
---

# CONTEXT GUIDE — Personal Context System

## Purpose
This directory stores personal context files that AI agents read and write.
Use this guide to understand how the system works.

## Available MCP Tools

### context_read
Read a context file by filename. Returns the file content, frontmatter metadata, and version.

### context_write
Create a new context file. Fails if the file already exists unless overwrite=true is specified.

### context_edit
Edit an existing context file by replacing a named section (H2 heading), line range, or by providing a full replacement with version check.

### context_list
List all context files in the directory with metadata. Optionally filter by tag, importance, or pattern.

### context_delete
Move a context file to trash. Requires confirmation flag.

## How to Use Context
1. **Always read CONTEXT_GUIDE.md first** when entering a new conversation.
2. **Read who-i-am.md** to understand the user's identity and values.
3. **Read goals.md** to understand what they're working on.
4. **Read preferences-and-habits.md** for workflow and setup details.
5. **Write to journal.md** at the end of every session with a summary.

## Best Practices
- Use \`context_read\` before \`context_edit\` to get the latest version.
- Always check \`version\` in frontmatter before writing to avoid conflicts.
- When you notice old/incorrect information, suggest pruning via feedback.md.
- Keep files focused on a single topic. Split large files.

## Frontmatter Schema
Every context file should have YAML frontmatter with these fields:
- \`id\`: Unique identifier (kebab-case, matches filename stem)
- \`title\`: Human-readable title
- \`created\`: ISO 8601 timestamp
- \`updated\`: ISO 8601 timestamp
- \`version\`: Monotonic integer (incremented on every write)
- \`importance\`: critical | high | medium | low | archived
- \`tags\`: Array of free-form string tags
- \`source\`: Which AI tool last wrote (opencode | chatgpt | claude | gemini | manual)
- \`stale\`: Boolean, set to true when content is outdated
- \`stale_reason\`: Explanation if stale is true

## Conflict Resolution
If you receive a version mismatch error:
1. Re-read the file with \`context_read\` to get the latest version.
2. Re-apply your changes on top of the new content.
3. Retry with the new version number.

## Session Logging
At the end of each conversation, append to journal.md with:
- What was discussed
- What context files were read/written
- Any decisions or changes made
- Next steps or follow-up items
`;

/**
 * who-i-am.md — Identity, personality, values.
 */
export function whoIAmTemplate(): string {
  const fm = makeFm("who-i-am", "Who I Am", "critical", ["identity", "personal", "core"]);
  const body = `# Who I Am

## Identity
- Name: [Your Name]
- Primary role: Developer / Builder
- Location: [Your Location]

## Values
- [Placeholder: what matters to you]

## Personality & Communication
- [Placeholder: how you prefer to communicate]

## Skills & Expertise
- [Placeholder: what you're good at]

## Current Tech Stack
- [Placeholder: languages, frameworks, tools you use daily]
`;
  return serializeContent(fm, body);
}

/**
 * goals.md — Goals and active projects.
 */
export function goalsTemplate(): string {
  const fm = makeFm("goals", "Goals & Active Projects", "high", ["goals", "projects", "tracking"]);
  const body = `# Goals & Active Projects

## Active Projects
### [Project Name]
- **Status:** [planning | active | paused | completed]
- **Priority:** [high | medium | low]
- **Description:** [What it is]
- **Next action:** [What needs to happen next]

## Short-Term Goals (Next 30 Days)
- [Goal 1]
- [Goal 2]

## Long-Term Goals (Next 6 Months)
- [Goal 1]
- [Goal 2]

## Areas of Focus
- [Area 1]
- [Area 2]
`;
  return serializeContent(fm, body);
}

/**
 * preferences-and-habits.md — Workflow preferences and development setup.
 */
export function preferencesTemplate(): string {
  const fm = makeFm("preferences-and-habits", "Preferences & Habits", "high", ["preferences", "workflow", "habits"]);
  const body = `# Preferences & Habits

## Workflow Preferences
- [Placeholder: how you like to work]

## Development Environment
- OS: Windows
- Terminal: [your terminal]
- Editor: [your editor]
- Shell: [PowerShell | bash | etc.]

## Communication Style
- [Placeholder: how you want agents to communicate with you]

## Common Patterns
- [Placeholder: recurring tasks or workflows]

## Pet Peeves
- [Placeholder: things agents should avoid]
`;
  return serializeContent(fm, body);
}

/**
 * journal.md — Session journal (empty body with frontmatter).
 */
export function journalTemplate(): string {
  const fm = makeFm("journal", "Session Journal", "medium", ["journal", "log", "sessions"]);
  const body = `# Session Journal

<!-- New entries are appended here by session logging tools -->
`;
  return serializeContent(fm, body);
}

/**
 * feedback.md — Pruning suggestions (empty body with frontmatter).
 */
export function feedbackTemplate(): string {
  const fm = makeFm("feedback", "Feedback & Pruning Suggestions", "low", ["feedback", "pruning", "maintenance"]);
  const body = `# Feedback & Pruning Suggestions

<!-- Agents write pruning suggestions here -->
`;
  return serializeContent(fm, body);
}
