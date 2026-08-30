import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readdir, readFile as fsReadFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, relative } from "path";
import { config } from "../config.js";
import { resolvePath, validateFilename } from "../fs/file-ops.js";

/**
 * Register context resources on the MCP server.
 * - context://{filename} — returns full markdown content
 * - context://list — returns JSON list of all context files
 */
export function registerContextResources(server: McpServer): void {
  // context://{filename} — read a context file
  server.resource(
    "context-file",
    new ResourceTemplate("context://{filename}", { list: undefined }),
    {
      title: "Context File",
      description: "A personal context markdown file with YAML frontmatter",
      mimeType: "text/markdown",
    },
    async (uri, { filename }) => {
      try {
        const safeFilename = Array.isArray(filename) ? filename[0] : filename;
        validateFilename(safeFilename);

        const filePath = resolvePath(safeFilename);

        if (!existsSync(filePath)) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "text/markdown",
                text: "",
              },
            ],
          };
        }

        const stats = await stat(filePath);
        if (stats.size > config.maxFileSize) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "text/markdown",
                text: `File exceeds maximum size of ${config.maxFileSize} bytes`,
              },
            ],
          };
        }

        const content = await fsReadFile(filePath, "utf-8");

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `Error reading file: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // context://list — list all context files
  server.resource(
    "context-list",
    "context://list",
    {
      title: "Context File List",
      description: "List of all available context files with metadata",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        const dir = config.contextDir;
        const filesList: any[] = [];

        if (existsSync(dir)) {
          const entries = await readdir(dir, { withFileTypes: true, recursive: true });
          const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));

          for (const entry of mdFiles) {
            try {
              const filePath = join(entry.parentPath ?? dir, entry.name);
              const stats = await stat(filePath);
              const relPath = relative(dir, filePath).replace(/\\/g, "/");

              filesList.push({
                filename: relPath,
                path: filePath,
                size: stats.size,
                last_modified: stats.mtime.toISOString(),
              });
            } catch {
              // Skip files that error
            }
          }
        }

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  files: filesList,
                  total: filesList.length,
                  directory: dir,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: err.message }),
            },
          ],
        };
      }
    }
  );
}
