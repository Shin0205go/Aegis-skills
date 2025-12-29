#!/usr/bin/env node
/**
 * Aegis Skills MCP Server
 *
 * Provides skill manifest for Aegis-CLI integration.
 * Aegis Router uses this to determine skill availability and access control.
 *
 * Designed to integrate with Aegis-CLI (https://github.com/Shin0205go/Aegis-cli)
 *
 * Tools provided:
 * - get_skill_manifest: Get complete skill manifest with permissions (for Aegis Router)
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');

// Store loaded skills metadata
const skillsCache = new Map();

// Default skills directory (can be overridden by command line arg)
const SKILLS_DIR = process.argv[2] || path.join(require('os').homedir(), '.skills');

const server = new McpServer({
  name: "aegis-skills",
  version: "1.0.0"
});

/**
 * Recursively finds all files in a directory.
 */
async function getFilesInDir(dir) {
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await getFilesInDir(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Could not read directory: ${dir}`, error);
  }
  return files;
}

/**
 * Loads skills from the specified directory and caches their metadata.
 */
async function loadSkills() {
  console.error(`Scanning for skills in: ${SKILLS_DIR}`);

  try {
    if (!await fs.pathExists(SKILLS_DIR)) {
      console.error(`Skills directory not found: ${SKILLS_DIR}`);
      return;
    }

    const allFiles = await getFilesInDir(SKILLS_DIR);
    const skillManifests = allFiles.filter(file => path.basename(file) === 'SKILL.md');

    for (const skillFilePath of skillManifests) {
      const skillDirPath = path.dirname(skillFilePath);
      const skillFolderName = path.basename(skillDirPath);

      console.error(`Found skill: ${skillFolderName}`);

      try {
        const skillFileContent = await fs.readFile(skillFilePath, 'utf8');
        const { data: frontmatter } = matter(skillFileContent);

        if (frontmatter.name && frontmatter.description) {
          // Parse allowed-tools (can be array or comma-separated string)
          let allowedTools = [];
          if (frontmatter['allowed-tools']) {
            if (Array.isArray(frontmatter['allowed-tools'])) {
              allowedTools = frontmatter['allowed-tools'];
            } else if (typeof frontmatter['allowed-tools'] === 'string') {
              allowedTools = frontmatter['allowed-tools'].split(',').map(t => t.trim());
            }
          }

          // Parse allowedRoles (can be array or comma-separated string)
          let allowedRoles = [];
          if (frontmatter.allowedRoles) {
            if (Array.isArray(frontmatter.allowedRoles)) {
              allowedRoles = frontmatter.allowedRoles;
            } else if (typeof frontmatter.allowedRoles === 'string') {
              allowedRoles = frontmatter.allowedRoles.split(',').map(r => r.trim());
            }
          }

          // Generate displayName from name if not provided
          const displayName = frontmatter.displayName ||
            frontmatter.name.split('-').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

          skillsCache.set(frontmatter.name, {
            id: frontmatter.name,
            displayName: displayName,
            description: frontmatter.description,
            allowedRoles: allowedRoles,
            allowedTools: allowedTools
          });

          console.error(`  -> Cached skill: ${frontmatter.name}`);
        } else {
          console.error(`  -> Skipping skill in '${skillFolderName}': 'name' or 'description' missing in SKILL.md frontmatter.`);
        }
      } catch (err) {
        console.error(`Error processing skill in ${skillDirPath}:`, err);
      }
    }
  } catch (error) {
    console.error('Error loading skills:', error);
  }
}

/**
 * Register MCP tools
 */
function registerTools() {
  // ============================================================
  // TOOL: get_skill_manifest
  // Get the complete skill manifest for Aegis Router integration
  // ============================================================
  server.tool(
    'get_skill_manifest',
    'Get the complete skill manifest including permissions and allowed tools. Used by Aegis Router to determine skill availability and access control.',
    {},
    async () => {
      const skills = Array.from(skillsCache.values());

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ skills }, null, 2)
        }]
      };
    }
  );
  console.error('Registered tool: get_skill_manifest');
}

async function main() {
  try {
    console.error('Starting aegis-skills-server...');

    // Load skills into cache
    await loadSkills();
    console.error(`Loaded ${skillsCache.size} skills into cache.`);

    // Register tools
    registerTools();
    console.error('Server is ready.');

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Aegis skills server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
