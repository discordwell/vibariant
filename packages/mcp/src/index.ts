import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { VibariantAPI, getCredentials, getDefaultProject } from './api.js';
import { generateCode } from './codegen.js';

const server = new McpServer({
  name: 'vibariant',
  version: '0.1.0',
});

function getApi(): VibariantAPI {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      'Not authenticated with Vibariant. Run `npx @vibariant/cli auth login` first.',
    );
  }
  return new VibariantAPI(creds.apiUrl, creds.token);
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

server.tool(
  'vibariant_auth',
  'Check Vibariant authentication status. If not authenticated, instructs how to log in.',
  {},
  async () => {
    const creds = getCredentials();
    if (!creds) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Not authenticated. Run `npx @vibariant/cli auth login` to sign in.',
          },
        ],
      };
    }

    try {
      const api = new VibariantAPI(creds.apiUrl, creds.token);
      const me = await api.me();
      return {
        content: [
          {
            type: 'text' as const,
            text: `Authenticated as ${me.email} (${me.user_id}). API: ${creds.apiUrl}`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Token expired. Run `npx @vibariant/cli auth login` to re-authenticate.',
          },
        ],
      };
    }
  },
);

// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

server.tool(
  'vibariant_list_projects',
  'List all Vibariant projects for the authenticated user.',
  {},
  async () => {
    const api = getApi();
    const projects = await api.listProjects();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'vibariant_create_project',
  'Create a new Vibariant project. Returns project ID, token, and API key.',
  { name: z.string().describe('Project name') },
  async ({ name }) => {
    const api = getApi();
    const project = await api.createProject(name);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────
// Experiments
// ─────────────────────────────────────────────────────────────

server.tool(
  'vibariant_list_experiments',
  'List all experiments for a Vibariant project.',
  {
    project_id: z.string().describe('Project UUID. If omitted, uses the default project from CLI config.').optional(),
  },
  async ({ project_id }) => {
    const api = getApi();
    const pid = project_id ?? getDefaultProject()?.id;
    if (!pid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No project_id provided and no default project configured. Run `npx @vibariant/cli init` or pass project_id.',
          },
        ],
      };
    }
    const experiments = await api.listExperiments(pid);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(experiments, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'vibariant_create_experiment',
  'Create a new AB test experiment.',
  {
    project_id: z.string().describe('Project UUID. If omitted, uses the default project.').optional(),
    key: z.string().describe('Experiment key, e.g. "hero-headline"'),
    name: z.string().describe('Human-readable experiment name'),
    variants: z
      .string()
      .describe('Comma-separated variant keys (default: "control,variant")')
      .optional(),
  },
  async ({ project_id, key, name, variants }) => {
    const api = getApi();
    const pid = project_id ?? getDefaultProject()?.id;
    if (!pid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No project_id provided and no default project configured.',
          },
        ],
      };
    }
    const variantKeys = variants?.split(',').map((v) => v.trim()) ?? ['control', 'variant'];
    const experiment = await api.createExperiment({
      project_id: pid,
      key,
      name,
      variant_keys: variantKeys,
    });

    // Auto-start the experiment
    await api.updateExperiment(experiment.id, { status: 'running' });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Created and started experiment:\n${JSON.stringify({ ...experiment, status: 'running' }, null, 2)}`,
        },
      ],
    };
  },
);

server.tool(
  'vibariant_update_experiment',
  'Update an experiment status or configuration.',
  {
    experiment_id: z.string().describe('Experiment UUID'),
    status: z.enum(['draft', 'running', 'paused', 'completed']).describe('New status').optional(),
    name: z.string().describe('New display name').optional(),
  },
  async ({ experiment_id, status, name }) => {
    const api = getApi();
    const updates: Record<string, string> = {};
    if (status) updates.status = status;
    if (name) updates.name = name;
    const experiment = await api.updateExperiment(experiment_id, updates);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(experiment, null, 2),
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────

server.tool(
  'vibariant_get_results',
  'Get statistical results and recommendation for an experiment. Includes decision status, variant metrics, and ROPE analysis.',
  {
    experiment_id: z.string().describe('Experiment UUID'),
  },
  async ({ experiment_id }) => {
    const api = getApi();
    const results = await api.getResults(experiment_id);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────
// Code Generation
// ─────────────────────────────────────────────────────────────

server.tool(
  'vibariant_generate_code',
  'Generate SDK integration code for a specific framework. Returns code snippets to add to the project.',
  {
    framework: z.enum(['nextjs', 'react', 'vanilla']).describe('Target framework'),
    project_token: z.string().describe('Project token (vv_proj_xxx)'),
    experiment_key: z.string().describe('Experiment key to include in example code').optional(),
  },
  async ({ framework, project_token, experiment_key }) => {
    const code = generateCode(framework, project_token, experiment_key);
    return {
      content: [
        {
          type: 'text' as const,
          text: code,
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
