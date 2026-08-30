import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { editFile } from "../fs/file-ops.js";

/**
 * Register the context_edit tool.
 * Patches an existing file by targeting specific sections or line ranges with version check.
 */
export function registerContextEdit(server: McpServer): void {
  server.tool(
    "context_edit",
    "Edit an existing context file by replacing a named section (H2 heading), line range, or by providing a full replacement with version check.",
    {
      filename: z.string().describe("File to edit"),
      version: z.number().describe("Current version from last read — must match for edit to succeed"),
      operation: z
        .enum(["replace_section", "replace_lines", "append", "prepend"])
        .describe("Edit operation type"),
      section: z.string().optional().describe("H2 heading name for replace_section operation"),
      start_line: z.number().optional().describe("Start line number (1-indexed) for replace_lines"),
      end_line: z.number().optional().describe("End line number (inclusive) for replace_lines"),
      new_content: z.string().describe("New content to insert or replace with"),
    },
    async ({ filename, version, operation, section, start_line, end_line, new_content }) => {
      try {
        const result = await editFile({
          filename,
          version,
          operation,
          section,
          start_line,
          end_line,
          new_content,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  version: result.version,
                  section_found: result.section_found,
                  lines_replaced: result.lines_replaced,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message || "INTERNAL_ERROR: Unexpected error editing file" }],
          isError: true,
        };
      }
    }
  );
}
