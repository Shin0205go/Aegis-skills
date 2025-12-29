#!/usr/bin/env node
/**
 * Agent Skills MCP Server
 * 
 * Turns directory-based skills (SKILL.md plus optional resources) into callable 
 * MCP tools for any MCP client (Codex, Copilot, Cursor, Claude, etc.)
 * 
 * Features:
 * - Discovers skills from directories
 * - Exposes skill instructions and resources
 * - Can run bundled helper scripts
 * 
 * Tools provided:
 * - list_skills: List all available skills with metadata
 * - get_skill: Get the full SKILL.md instructions for a skill
 * - list_resources: List all resources bundled with a skill  
 * - get_resource: Read a specific resource file
 * - run_script: Execute a bundled script
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const { spawn } = require('child_process');
const { z } = require('zod');

// Store loaded skills metadata
const skillsCache = new Map();

// Default skills directory (can be overridden by command line arg)
const SKILLS_DIR = process.argv[2] || path.join(require('os').homedir(), '.skills');

const server = new McpServer({
  name: "agent-skills",
  version: "1.0.0"
});

/**
 * Recursively finds all files in a directory.
 * @param {string} dir - The directory to search.
 * @returns {Promise<string[]>} A promise that resolves to a list of absolute file paths.
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
 * Generate <available_skills> XML for agent context
 * This format is recommended by the Agent Skills specification for Claude models
 */
function generateAvailableSkillsXml() {
  const lines = ['<available_skills>'];
  
  for (const [, skill] of skillsCache) {
    lines.push('<skill>');
    lines.push('<name>');
    lines.push(escapeXml(skill.name));
    lines.push('</name>');
    lines.push('<description>');
    lines.push(escapeXml(skill.description));
    lines.push('</description>');
    lines.push('<location>');
    lines.push(escapeXml(skill.filePath));
    lines.push('</location>');
    lines.push('</skill>');
  }
  
  lines.push('</available_skills>');
  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.py': 'text/x-python',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.sh': 'application/x-sh',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.xml': 'application/xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
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
        const { data: frontmatter, content: skillContent } = matter(skillFileContent);

        if (frontmatter.name && frontmatter.description) {
          // Cache skill metadata
          const resourceFiles = allFiles.filter(
            file => file.startsWith(skillDirPath) && path.basename(file) !== 'SKILL.md'
          );
          
          skillsCache.set(frontmatter.name, {
            name: frontmatter.name,
            description: frontmatter.description,
            folderName: skillFolderName,
            dirPath: skillDirPath,
            filePath: skillFilePath,
            content: skillContent,
            frontmatter: frontmatter,
            resources: resourceFiles.map(f => path.relative(skillDirPath, f))
          });
          
          console.error(`  -> Cached skill: ${frontmatter.name} with ${resourceFiles.length} resources`);
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
 * Register all MCP tools
 */
function registerToolsAndResources() {
  
  // ============================================================
  // TOOL: list_skills
  // List all available skills with their metadata
  // ============================================================
  server.tool(
    'list_skills',
    'List all available skills with their name and description. IMPORTANT: When asked to use a skill, ALWAYS call this first to find the skill, then call get_skill to read its instructions before proceeding.',
    {},
    async () => {
      const skills = Array.from(skillsCache.values()).map(skill => ({
        name: skill.name,
        description: skill.description,
        resource_count: skill.resources.length
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(skills, null, 2)
        }]
      };
    }
  );
  console.error('Registered tool: list_skills');

  // ============================================================
  // TOOL: get_skill
  // Get the full SKILL.md instructions for a skill
  // ============================================================
  server.tool(
    'get_skill',
    'Get the full instructions from a skill\'s SKILL.md file. IMPORTANT: You MUST call this and follow the instructions before performing any task with the skill. The SKILL.md contains critical prompts and guidelines.',
    {
      name: z.string().describe('The name of the skill')
    },
    async ({ name }) => {
      const skill = skillsCache.get(name) || 
        Array.from(skillsCache.values()).find(s => s.folderName === name);
      
      if (!skill) {
        return {
          content: [{ type: 'text', text: `Error: Skill '${name}' not found. Use list_skills to see available skills.` }],
          isError: true
        };
      }
      
      // Return full SKILL.md content (frontmatter + body)
      const fullContent = await fs.readFile(skill.filePath, 'utf8');
      return {
        content: [{
          type: 'text',
          text: fullContent
        }]
      };
    }
  );
  console.error('Registered tool: get_skill');

  // ============================================================
  // TOOL: list_resources
  // List all resources bundled with a skill
  // ============================================================
  server.tool(
    'list_resources',
    'List all resources (files) bundled with a skill. Use this to discover what scripts, references, and assets are available.',
    {
      skill: z.string().describe('The name of the skill')
    },
    async ({ skill: skillName }) => {
      const skill = skillsCache.get(skillName) || 
        Array.from(skillsCache.values()).find(s => s.folderName === skillName);
      
      if (!skill) {
        return {
          content: [{ type: 'text', text: `Error: Skill '${skillName}' not found.` }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(skill.resources, null, 2)
        }]
      };
    }
  );
  console.error('Registered tool: list_resources');

  // ============================================================
  // TOOL: get_resource
  // Read a specific resource file from a skill
  // ============================================================
  server.tool(
    'get_resource',
    'Read the contents of a resource file from a skill. Use this to access scripts, references, or other files.',
    {
      skill: z.string().describe('The name of the skill'),
      path: z.string().describe('Relative path to the resource (e.g., "scripts/run.py", "prompts/example.txt")')
    },
    async ({ skill: skillName, path: resourcePath }) => {
      const skill = skillsCache.get(skillName) || 
        Array.from(skillsCache.values()).find(s => s.folderName === skillName);
      
      if (!skill) {
        return {
          content: [{ type: 'text', text: `Error: Skill '${skillName}' not found.` }],
          isError: true
        };
      }
      
      const fullPath = path.join(skill.dirPath, resourcePath);
      
      // Security: ensure path is within skill directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedSkillDir = path.resolve(skill.dirPath);
      if (!resolvedPath.startsWith(resolvedSkillDir)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid resource path. Must be within skill directory.' }],
          isError: true
        };
      }
      
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        return { content: [{ type: 'text', text: content }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error reading resource: ${err.message}` }],
          isError: true
        };
      }
    }
  );
  console.error('Registered tool: get_resource');

  // ============================================================
  // TOOL: run_script
  // Execute a bundled script from a skill
  // ============================================================
  server.tool(
    'run_script',
    'Execute a script bundled with a skill. Supports Python (.py), Shell (.sh), and Node.js (.js) scripts.',
    {
      skill: z.string().describe('The name of the skill'),
      path: z.string().describe('Relative path to the script (e.g., "scripts/run.py", "run.sh")'),
      args: z.array(z.string()).optional().describe('Arguments to pass to the script')
    },
    async ({ skill: skillName, path: scriptPath, args = [] }) => {
      const skill = skillsCache.get(skillName) || 
        Array.from(skillsCache.values()).find(s => s.folderName === skillName);
      
      if (!skill) {
        return {
          content: [{ type: 'text', text: `Error: Skill '${skillName}' not found.` }],
          isError: true
        };
      }
      
      const fullPath = path.join(skill.dirPath, scriptPath);
      
      // Security: ensure path is within skill directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedSkillDir = path.resolve(skill.dirPath);
      if (!resolvedPath.startsWith(resolvedSkillDir)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid script path.' }],
          isError: true
        };
      }
      
      if (!await fs.pathExists(fullPath)) {
        return {
          content: [{ type: 'text', text: `Error: Script not found: ${scriptPath}` }],
          isError: true
        };
      }
      
      // Determine interpreter
      const ext = path.extname(fullPath).toLowerCase();
      const interpreters = {
        '.py': 'python3',
        '.sh': 'bash',
        '.js': 'node'
      };
      const interpreter = interpreters[ext];
      
      if (!interpreter) {
        return {
          content: [{ type: 'text', text: `Error: Unsupported script type: ${ext}. Supported: .py, .sh, .js` }],
          isError: true
        };
      }
      
      return new Promise((resolve) => {
        console.error(`Executing: ${interpreter} ${fullPath} ${args.join(' ')}`);
        const proc = spawn(interpreter, [fullPath, ...args], { cwd: skill.dirPath });
        let stdout = '', stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        proc.on('close', (code) => {
          console.error(`Script exited with code ${code}`);
          if (code !== 0) {
            resolve({
              content: [{ type: 'text', text: `Script exited with code ${code}\n\nStderr:\n${stderr}\n\nStdout:\n${stdout}` }],
              isError: true
            });
          } else {
            resolve({ content: [{ type: 'text', text: stdout || '(No output)' }] });
          }
        });
        
        proc.on('error', (err) => {
          resolve({
            content: [{ type: 'text', text: `Failed to execute script: ${err.message}` }],
            isError: true
          });
        });
      });
    }
  );
  console.error('Registered tool: run_script');
}

async function main() {
  try {
    console.error('Starting agent-skills-server...');
    
    // Load skills into cache
    await loadSkills();
    console.error(`Loaded ${skillsCache.size} skills into cache.`);
    
    // Register all tools and resources
    registerToolsAndResources();
    console.error('All tools and resources registered. Server is ready.');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Agent skills server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
