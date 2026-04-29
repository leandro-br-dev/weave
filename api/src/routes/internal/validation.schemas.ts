import { z } from 'zod'

// ───────────────────────────────────────────────────────────
// Plan (Plano de Trabalho)
// ───────────────────────────────────────────────────────────

/** Individual task inside a plan's tasks array. */
export const taskSchema = z.object({
  id: z.string().min(1, "Campo 'id': é obrigatório e não pode ser vazio."),
  name: z.string().min(1, "Campo 'name': é obrigatório e não pode ser vazio."),
  prompt: z.string().min(1, "Campo 'prompt': é obrigatório e não pode ser vazio."),
  cwd: z.string().min(1, "Campo 'cwd': é obrigatório e não pode ser vazio."),
  workspace: z.string().min(1, "Campo 'workspace': é obrigatório e não pode ser vazio."),

  // Optional fields with defaults
  tools: z.array(z.string()).optional(),
  permission_mode: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  max_turns: z.number().int().positive().optional(),
  system_prompt: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  agent_file: z.string().optional(),
  env_context: z.string().optional(),
  attachment_ids: z.array(z.string()).optional(),
})

/** Full plan body as sent by the Claude orchestrator. */
export const planSchema = z.object({
  name: z.string().min(1, "Campo 'name': é obrigatório e não pode ser vazio."),
  tasks: z
    .array(taskSchema)
    .min(1, "Campo 'tasks': deve conter pelo menos 1 tarefa."),
  project_id: z.string().optional(),
  status: z
    .enum(['pending', 'running', 'completed', 'failed', 'awaiting_approval'])
    .optional(),
})

// ───────────────────────────────────────────────────────────
// Team (Equipe / Workspace)
// ───────────────────────────────────────────────────────────

const validRoles = ['planner', 'coder', 'reviewer', 'tester', 'debugger', 'devops', 'generic'] as const
type ValidRole = (typeof validRoles)[number]

const validModels = [
  'default',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const
type ValidModel = (typeof validModels)[number]

/** Sub-agent within a team template. */
export const subAgentSchema = z.object({
  name: z.string().min(1, "Campo 'subAgents[].name': é obrigatório."),
  role: z.enum(validRoles, {
    message: `Campo 'subAgents[].role': deve ser um de: ${validRoles.join(', ')}.`,
  }),
  description: z.string().optional(),
  suggestedModel: z.string().optional(),
})

/** Team creation / update body. */
export const teamSchema = z.object({
  name: z.string().min(1, "Campo 'name': é obrigatório e não pode ser vazio."),
  project_id: z.string().min(1, "Campo 'project_id': é obrigatório."),
  role: z.enum(validRoles, {
    message: `Campo 'role': deve ser um de: ${validRoles.join(', ')}.`,
  }).optional(),
  model: z.enum(validModels, {
    message: `Campo 'model': deve ser um de: ${validModels.join(', ')}.`,
  }).optional(),
  anthropic_base_url: z.string().url().optional().or(z.literal('')),
  project_path: z.string().optional(),
  template_id: z.string().optional(),
  team_id: z.string().optional(),
  environment_variables: z.record(z.string(), z.string()).optional(),
})

/** Team template (used when configuring a pre-built team). */
export const teamTemplateSchema = z.object({
  id: z.string().min(1, "Campo 'id': é obrigatório."),
  name: z.string().min(1, "Campo 'name': é obrigatório."),
  label: z.string().min(1, "Campo 'label': é obrigatório."),
  description: z.string().optional(),
  role: z.enum(validRoles, {
    message: `Campo 'role': deve ser um de: ${validRoles.join(', ')}.`,
  }),
  subAgents: z.array(subAgentSchema).optional(),
  permissions: z.object({
    allow: z.array(z.string()),
    deny: z.array(z.string()),
  }).optional(),
  claudeMd: z.string().optional(),
})

/** Team improvement output (used by improve-claude-md / improve-agent quick actions). */
export const teamImprovementSchema = z
  .object({
    claudeMd: z
      .string()
      .min(1, "Campo 'claudeMd': deve conter o conteúdo melhorado do CLAUDE.md (não vazio).")
      .optional(),
    agentContent: z
      .string()
      .min(1, "Campo 'agentContent': deve conter a definição melhorada do agente (não vazio).")
      .optional(),
  })
  .refine(
    (data) => data.claudeMd !== undefined || data.agentContent !== undefined,
    {
      message: "Pelo menos um dos campos 'claudeMd' ou 'agentContent' deve ser fornecido.",
    },
  )

// ───────────────────────────────────────────────────────────
// Agent Improvement (improve-agent quick action output)
// ───────────────────────────────────────────────────────────

/** Agent improvement output (used by improve-agent quick action).
 *  The LLM writes the improved agent definition (YAML frontmatter + markdown)
 *  to a JSON file with this schema, then validates via `weave-validate agent`. */
export const agentImprovementSchema = z.object({
  agentContent: z
    .string()
    .min(1, "Campo 'agentContent': deve conter a definição melhorada do agente (não vazio)."),
})

// ───────────────────────────────────────────────────────────
// Agent (Skills / CLAUDE.md update)
// ───────────────────────────────────────────────────────────

/** CLAUDE.md content update body. */
export const agentClaudeMdSchema = z.object({
  content: z
    .string()
    .min(1, "Campo 'content': é obrigatório e não pode ser vazio — deve conter o texto do CLAUDE.md."),
})

/** Agent settings (settings.local.json) update body. */
export const agentSettingsSchema = z.object({
  settings: z.object({
    $schema: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    permissions: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
      additionalDirectories: z.array(z.string()).optional(),
    }).optional(),
  }, {
    message: "Campo 'settings': deve ser um objeto válido com chaves '$schema', 'env' e/ou 'permissions'.",
  }),
})

/** Agent model / role update body. */
export const agentUpdateSchema = z.object({
  model: z.enum(validModels, {
    message: `Campo 'model': deve ser um de: ${validModels.join(', ')}.`,
  }).optional(),
  role: z.enum(validRoles, {
    message: `Campo 'role': deve ser um de: ${validRoles.join(', ')}.`,
  }).optional(),
}).refine(
  (data) => data.model !== undefined || data.role !== undefined,
  { message: "Pelo menos um dos campos 'model' ou 'role' deve ser fornecido." },
)

// ───────────────────────────────────────────────────────────
// Workspace Builder (batch agent/skill operations)
// ───────────────────────────────────────────────────────────

export const workspaceBuilderOperationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['create_agent', 'update_agent', 'delete_agent', 'create_skill', 'update_skill', 'delete_skill', 'update_claude_md']),
  name: z.string().min(1).optional(),
  content: z.string().optional(),
  previousContent: z.string().optional(),
  reason: z.string().min(1, "Each operation must have a 'reason' field explaining the change."),
}).refine(
  (op) => {
    if (op.type.startsWith('create')) return !!op.name && !!op.content
    if (op.type.startsWith('delete')) return !!op.name
    if (op.type.startsWith('update')) return !!op.content
    return true
  },
  { message: "Operation missing required fields for its type." }
)

export const workspaceBuilderSchema = z.object({
  summary: z.string().min(1, "Campo 'summary': deve conter um resumo das alterações propostas."),
  operations: z.array(workspaceBuilderOperationSchema).min(0),
})

