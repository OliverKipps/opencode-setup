---
id: context-guide
title: "CONTEXT GUIDE — Personal Context System"
created: 2026-06-16T13:39:40.744Z
updated: 2026-06-16T13:39:40.744Z
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
- Use `context_read` before `context_edit` to get the latest version.
- Always check `version` in frontmatter before writing to avoid conflicts.
- When you notice old/incorrect information, suggest pruning via feedback.md.
- Keep files focused on a single topic. Split large files.

## Frontmatter Schema
Every context file should have YAML frontmatter with these fields:
- `id`: Unique identifier (kebab-case, matches filename stem)
- `title`: Human-readable title
- `created`: ISO 8601 timestamp
- `updated`: ISO 8601 timestamp
- `version`: Monotonic integer (incremented on every write)
- `importance`: critical | high | medium | low | archived
- `tags`: Array of free-form string tags
- `source`: Which AI tool last wrote (opencode | chatgpt | claude | gemini | manual)
- `stale`: Boolean, set to true when content is outdated
- `stale_reason`: Explanation if stale is true

## Conflict Resolution
If you receive a version mismatch error:
1. Re-read the file with `context_read` to get the latest version.
2. Re-apply your changes on top of the new content.
3. Retry with the new version number.

## Session Logging
At the end of each conversation, append to journal.md with:
- What was discussed
- What context files were read/written
- Any decisions or changes made
- Next steps or follow-up items
