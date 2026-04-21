"""Processa kanban tasks ativas, gera planos via planning agent e cria workflows.

Motor de transição de fases:
  - Planning  → Plan Team (planner): analisa e gera plano
  - In Dev    → Dev Team (coder): executa o plano
  - Validation → Staging Team (reviewer): build, QA, PR review

Gates controlam transição automática entre fases.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import os
from datetime import datetime, timezone

from orchestrator import logger
from orchestrator.cron_utils import next_run_from_cron
from orchestrator.team_trigger import (
    find_team_workspace,
    find_project_settings,
    trigger_dev_team,
    trigger_staging_team,
    trigger_plan_team,
    handle_team_completion,
    _handle_needs_rework,
    PHASE_ROLE_MAP,
    PHASE_LABEL_MAP,
)


async def process_scheduled_tasks(client) -> None:
    """
    Processa templates agendados cujo next_run_at chegou.
    Cria uma task em 'planning' usando o endpoint /api/templates/:id/use
    e calcula o próximo next_run_at.
    """
    try:
        scheduled = await client.get_scheduled_tasks()
        if not scheduled:
            return

        logger.info(f'[Scheduler] Checking {len(scheduled)} scheduled templates...')

        for template in scheduled:
            template_id = template.get('id')
            template_project_id = template.get('project_id')  # Can be None for public templates
            title = template.get('title', 'Scheduled Template')
            cron_expr = template.get('recurrence', '')
            is_public = template.get('is_public', False)

            if not template_id or not cron_expr:
                continue

            # Para templates públicos (project_id = NULL), precisamos determinar
            # em qual projeto criar a task. Por ora, skip templates sem project_id
            # TODO: Adicionar configuração de projeto padrão para templates públicos
            if not template_project_id:
                logger.warning(f'[Scheduler] Skipping public template "{title}" (id={template_id}) - no target project specified')
                continue

            logger.info(f'[Scheduler] Triggering scheduled template: "{title}" ({cron_expr}) in project {template_project_id}')

            # Cria task a partir do template via novo endpoint
            result = await client._post(
                f'/api/templates/{template_id}/use',
                {'projectId': template_project_id}
            )

            if not result:
                logger.error(f'[Scheduler] Failed to create task from template {template_id}')
                continue

            new_task = result.get('data') or result
            logger.info(f'[Scheduler] Created task from template: {new_task.get("id", "?")} in planning')

            # Calcula e salva o próximo next_run_at no template
            next_run = next_run_from_cron(cron_expr)
            next_run_str = next_run.strftime('%Y-%m-%d %H:%M:%S') if next_run else None

            # Atualiza o template (não a task)
            await client._put(
                f'/api/templates/{template_id}',
                {
                    'next_run_at': next_run_str,
                }
            )
            # Nota: last_run_at já é atualizado pelo endpoint /use

            if next_run_str:
                logger.info(f'[Scheduler] Next run for "{title}": {next_run_str}')

    except Exception as e:
        logger.warning(f'[Scheduler] Error: {e}')


def load_plan_from_file(file_path: str, fallback_name: str = '') -> dict | None:
    """
    Load plan JSON from a file (Blackboard pattern).

    Reads the plan.json file that the planning agent saved directly to the
    workflow directory, instead of parsing <plan> tags from stdout.

    Args:
        file_path: Absolute path to the plan.json file
        fallback_name: Name to use if the plan has no 'name' field

    Returns:
        Dictionary with the plan data, or None if not found/invalid
    """
    if not os.path.exists(file_path):
        logger.warning(f'[KanbanPipeline] Plan file not found: {file_path}')
        return None

    try:
        with open(file_path, 'r') as f:
            raw = f.read().strip()

        if not raw:
            logger.warning(f'[KanbanPipeline] Plan file is empty: {file_path}')
            return None

        parsed = json.loads(raw)
        name = parsed.get('name', '')
        tasks = parsed.get('tasks', [])

        if name == 'Descriptive plan name':
            logger.info('[KanbanPipeline] Skipping template placeholder plan')
            return None

        if not isinstance(tasks, list) or len(tasks) == 0:
            logger.info('[KanbanPipeline] Plan has no tasks, skipping')
            return None

        # Accept plan without name — use fallback
        if not name and fallback_name:
            parsed['name'] = fallback_name
            logger.info(f'[KanbanPipeline] Plan has no name, using fallback: {fallback_name}')

        logger.info(f'[KanbanPipeline] Valid plan loaded from file: "{parsed.get("name")}" ({len(tasks)} tasks)')
        return parsed
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f'[KanbanPipeline] Failed to load plan from {file_path}: {type(e).__name__}: {e}')
        return None


def normalize_plan_tasks(plan_data: dict, planning_context: dict = None) -> dict:
    """
    Normaliza o schema das tasks para o formato esperado pelo runner.

    Args:
        plan_data: Dicionário do plano com tasks em schema variável
        planning_context: Contexto de planejamento com environments e agents para fallback

    Returns:
        Dicionário do plano com tasks normalizadas
    """
    # Extrai environment project_path como fallback de cwd
    fallback_cwd = ''
    fallback_workspace_by_role = {}

    if planning_context:
        envs = planning_context.get('environments', [])
        if envs:
            fallback_cwd = envs[0].get('project_path', '')

        # Mapa role → workspace_path para fallback
        for agent in planning_context.get('agents', []):
            role = agent.get('role', 'generic')
            ws = agent.get('workspace_path', '')
            if ws and role not in fallback_workspace_by_role:
                fallback_workspace_by_role[role] = ws

    def _extract_path(value, *fallbacks, default=''):
        """Extract a string path from a value that might be a string, dict, or other type."""
        for v in [value] + list(fallbacks):
            if isinstance(v, str) and v.strip():
                return v.strip()
            if isinstance(v, dict):
                # Try common path keys from agent/environment objects
                for key in ('path', 'workspace_path', 'workspace', 'project_path'):
                    p = v.get(key)
                    if isinstance(p, str) and p.strip():
                        return p.strip()
        return default

    normalized_tasks = []
    for i, task in enumerate(plan_data.get('tasks', [])):
        # Normaliza cwd com fallback do environment
        cwd = _extract_path(
            task.get('cwd'),
            task.get('workingDirectory'),
            task.get('working_directory'),
            fallback_cwd,
        )

        # Safety: detect and correct subdirectory cwds.
        # The planner may incorrectly set cwd to a subdirectory of project_path
        # (e.g., /root/projects/myapp/dev/backend instead of /root/projects/myapp/dev).
        # This causes auth failures because .claude/settings.local.json lives at project root.
        if cwd and fallback_cwd:
            # Check if cwd is a subdirectory of any environment's project_path
            cwd_is_subdir = False
            if planning_context:
                for env in planning_context.get('environments', []):
                    env_path = env.get('project_path', '')
                    if env_path and cwd.startswith(env_path.rstrip('/') + '/'):
                        cwd_is_subdir = True
                        corrected_cwd = env_path
                        task_name = task.get('name') or task.get('title') or f'task-{i+1}'
                        logger.warning(
                            f'[KanbanPipeline] Task "{task_name[:40]}": cwd "{cwd}" is a subdirectory '
                            f'of environment project_path — correcting to "{corrected_cwd}"'
                        )
                        cwd = corrected_cwd
                        break

        # Final fallback: if cwd is still empty, use the first environment's project_path
        if not cwd and fallback_cwd:
            logger.info(f'[KanbanPipeline] Task cwd was empty, using fallback: {fallback_cwd}')
            cwd = fallback_cwd

        # workspace pode vir em task.workspace ou task.agent.workspace
        workspace = _extract_path(task.get('workspace'))
        if not workspace and isinstance(task.get('agent'), dict):
            workspace = _extract_path(task['agent'].get('workspace'))

        # Fallback de workspace por role
        if not workspace:
            task_role = 'coder'  # default
            if isinstance(task.get('agent'), dict):
                task_role = task['agent'].get('role', 'coder')
            workspace = fallback_workspace_by_role.get(task_role, '')
            if workspace:
                logger.info(f'[KanbanPipeline] Using fallback workspace for role {task_role}: {workspace}')

        # depends_on pode vir como dependencies
        depends_on = (
            task.get('depends_on') or
            task.get('dependencies') or
            []
        )

        # Garante que depends_on é lista de strings
        if isinstance(depends_on, list):
            depends_on = [str(d) for d in depends_on]

        normalized_tasks.append({
            'id': task.get('id') or f'task-{i+1}',
            'name': task.get('name') or task.get('title') or f'Task {i+1}',
            'prompt': task.get('prompt') or task.get('description') or task.get('instructions') or '',
            'cwd': cwd,
            'workspace': workspace,
            'tools': task.get('tools') or ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
            'permission_mode': task.get('permission_mode') or 'acceptEdits',
            'depends_on': depends_on,
        })

    # Loga resultado final
    for t in normalized_tasks:
        logger.info(f'[KanbanPipeline] Task "{t["name"][:30]}": cwd={t["cwd"][-40:] if t["cwd"] else "EMPTY"}, workspace={t["workspace"][-30:] if t["workspace"] else "EMPTY"}')

    plan_data['tasks'] = normalized_tasks
    return plan_data


async def build_planning_prompt(
    task: dict,
    planning_context: dict,
    skill_content: str,
    workflow_context: str = '',
    workflow_dir: str = '',
    environment_id: str = None,
) -> str:
    """Monta o prompt completo para o agente planejador."""
    project = planning_context.get('project', {})
    environments = planning_context.get('environments', [])
    # Support both 'teams' (new) and 'agents' (legacy) key for backward compatibility
    teams = planning_context.get('teams', planning_context.get('agents', []))

    # Seção de contexto do projeto
    project_section = f"""## Project Context

Name: {project.get('name', 'Unknown')}
Description: {project.get('description', 'No description')}
"""

    # Determine the target environment
    target_env = None
    if environment_id:
        target_env = next((e for e in environments if e.get('id') == environment_id), None)

    # Seção de ambientes — highlight the target environment
    env_lines = []
    for env in environments:
        is_target = target_env and env.get('id') == environment_id
        prefix = '🎯 **[TARGET]** ' if is_target else ''
        env_lines.append(
            f"{prefix}- **{env.get('name')}** ({env.get('type')})\n"
            f"  project_path: `{env.get('project_path')}`"
        )

    env_section_header = "## Environments\n\n"
    if target_env:
        env_section_header += f"**Target environment**: {target_env.get('name')} ({target_env.get('type')}) — `{target_env.get('project_path')}`\n"
        env_section_header += "Use the target environment's project_path as the cwd for all tasks.\n\n"
    env_section = env_section_header + ("\n".join(env_lines) if env_lines else "No environments configured.")

    # Seção de equipes disponíveis (teams, não agents individuais)
    team_lines = []
    for team in teams:
        agents_info = ""
        if team.get('agents'):
            agents_info = f"\n  agents: {', '.join(team['agents'])}"
        team_lines.append(
            f"- **{team.get('name')}** (role: `{team.get('role')}`)\n"
            f"  workspace: `{team.get('workspace_path')}`{agents_info}"
        )
    agents_section = (
        "## Available Teams\n\n"
        + ("\n".join(team_lines) if team_lines else "No teams configured.")
        + "\n\nWhen creating tasks, use the exact `workspace` paths listed above."
        + "\nMatch task type to team role: planner for planning, coder for implementation, reviewer for validation."
        + "\n\nNOTE: Each team has its own agents defined in its .claude/agents/ directory."
        + " Do NOT confuse teams with agents."
    )

    # Tarefa do kanban
    task_section = f"""## Task to Plan

Title: {task.get('title', 'Untitled')}
Description:
{task.get('description', 'No description provided.')}
"""

    # Instrução de cwd
    cwd_instruction = """
## Important: cwd vs workspace

- `workspace`: path to the team's workspace folder (where .claude/settings.local.json lives)
- `cwd`: the project directory where the code lives (use environment project_path above)

For coder teams: set cwd = the target environment's project_path, workspace = team workspace_path
For reviewer/tester teams: same pattern

**⚠️ WARNING: NEVER use subdirectories of project_path as cwd.** Always use the exact
project_path provided above (e.g., `/root/projects/myapp/dev`, NOT `/root/projects/myapp/dev/backend`).
The workspace (team folder) is where API keys and configuration live; the CLI will fail with
authentication errors if cwd is a subdirectory. If a task needs to work in a specific subdirectory,
indicate that in the task's `prompt` text — do NOT change the `cwd`.
"""
    if target_env:
        cwd_instruction += f"""
**CRITICAL**: This task targets the environment "{target_env.get('name')}".
- Use EXACTLY `{target_env.get('project_path')}` as the `cwd` for ALL tasks — no subdirectories.
- Use the team's workspace_path as the `workspace` for each task.
"""

    # Inject workflow context if available
    context_section = ''
    if workflow_context:
        context_section = f'''## Project Context

{workflow_context}

'''

    return f'''{skill_content}

---

{context_section}
{project_section}
{env_section}
{agents_section}
{task_section}
{cwd_instruction}
Analyze the task, read the relevant codebase using the project_path above, and generate a precise execution plan.
Save the plan to `{workflow_dir}/plan.json` and validate it with `weave-validate plan {workflow_dir}/plan.json`.'''


async def find_planner_workspace(project_id: str, client, environment_id: str = None) -> str | None:
    """
    Encontra o workspace do agente planner do projeto com fallback.

    Ordem de prioridade para selecionar a equipe:
      1. planner com vínculo ao ambiente selecionado (environment_id)
      2. planner sem vínculo específico (qualquer planner do projeto)
      3. coder com vínculo ao ambiente selecionado
      4. coder sem vínculo específico
      5. Qualquer equipe disponível para o projeto

    Args:
        project_id: ID do projeto
        client: DaemonClient instance
        environment_id: ID do ambiente selecionado (opcional)

    Returns:
        Caminho do workspace do time selecionado ou None se não encontrado
    """
    try:
        url = f"/projects/{project_id}/agents-context"
        logger.info(f'[KanbanPipeline] Calling: {url}')
        response = await client._get(url)
        logger.info(f'[KanbanPipeline] Raw response type: {type(response).__name__}')
        logger.info(f'[KanbanPipeline] Raw response: {str(response)[:300] if response else "None"}')

        # A API pode retornar {"data": [...]} ou diretamente [...]
        if isinstance(response, dict):
            agents = response.get('data') or []
        elif isinstance(response, list):
            agents = response
        else:
            agents = []

        if not agents:
            logger.warning(f'[KanbanPipeline] No agents returned for project {project_id}')
            return None

        logger.info(f'[KanbanPipeline] Agents for project: {[(a.get("name"), a.get("role")) for a in agents]}')

        # Fetch environments to get team_workspace mapping for filtering by environment
        env_team_map: dict[str, str] = {}  # env_id -> team_workspace path
        if environment_id:
            try:
                planning_context = await client.get_project_planning_context(project_id)
                for env in planning_context.get('environments', []):
                    env_id = env.get('id', '')
                    team_ws = env.get('team_workspace', '')
                    if env_id and team_ws:
                        env_team_map[env_id] = team_ws
            except Exception as e:
                logger.warning(f'[KanbanPipeline] Failed to fetch environments for filtering: {e}')

        # Helper: check if a workspace belongs to the selected environment
        def _is_env_workspace(workspace_path: str) -> bool:
            if not environment_id or not env_team_map:
                return True  # No env filter, any workspace is fine
            return env_team_map.get(environment_id, '') == workspace_path

        # Priority 1: planner linked to the environment
        planners = [a for a in agents if a.get('role') == 'planner']
        env_planners = [p for p in planners if _is_env_workspace(p.get('workspace_path', ''))]
        if env_planners:
            workspace = env_planners[0].get('workspace_path')
            logger.info(f'[KanbanPipeline] Found environment-linked planner workspace: {workspace}')
            return workspace

        # Priority 2: any planner
        if planners:
            workspace = planners[0].get('workspace_path')
            logger.info(f'[KanbanPipeline] Found planner workspace (no env link): {workspace}')
            return workspace

        # Priority 3: coder linked to the environment
        coders = [a for a in agents if a.get('role') == 'coder']
        env_coders = [c for c in coders if _is_env_workspace(c.get('workspace_path', ''))]
        if env_coders:
            workspace = env_coders[0].get('workspace_path')
            logger.info(f'[KanbanPipeline] No planner found, using environment-linked coder workspace: {workspace}')
            return workspace

        # Priority 4: any coder
        if coders:
            workspace = coders[0].get('workspace_path')
            logger.info(f'[KanbanPipeline] No planner found, using coder workspace: {workspace}')
            return workspace

        # Priority 5: any available team
        if agents:
            workspace = agents[0].get('workspace_path')
            logger.info(f'[KanbanPipeline] No planner/coder found, using available team: {workspace}')
            return workspace

        logger.warning(f'[KanbanPipeline] No teams available for project {project_id}')
        return None
    except Exception as e:
        logger.warning(f'Could not find planner workspace: {type(e).__name__}: {e}')
        return None


async def process_kanban_task(task: dict, client) -> None:
    """
    Processa uma kanban task: roda planning agent e cria workflow.

    Uses the Blackboard pattern: the planning agent saves plan.json directly
    to a pre-created workflow directory and validates it with weave-validate.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    task_id = task["id"]
    project_id = task["project_id"]
    title = task.get("title", "Untitled")
    description = task.get("description", "")
    environment_id = task.get("environment_id")
    project_settings = task.get("project_settings", {})
    if isinstance(project_settings, str):
        try:
            project_settings = json.loads(project_settings)
        except Exception:
            project_settings = {}

    logger.info(f"[KanbanPipeline] Starting process for task {task_id}")

    # Marca como 'planning'
    await client.update_kanban_pipeline(project_id, task_id, pipeline_status="planning")

    try:
        # Log cada etapa para diagnóstico
        logger.info('[KanbanPipeline] Step 1: finding planner workspace...')
        logger.info(f'[KanbanPipeline] environment_id={environment_id or "not set"}')
        planner_workspace = await find_planner_workspace(project_id, client, environment_id=environment_id)
        logger.info(f'[KanbanPipeline] Planner workspace: {planner_workspace}')

        if not planner_workspace:
            raise ValueError(f'No planner agent with role=planner found for project {project_id}. Assign a planner agent to this project first.')

        logger.info('[KanbanPipeline] Step 2: fetching full project planning context...')
        planning_context = await client.get_project_planning_context(project_id)
        workflow_context = planning_context.get('workflow_context', '')
        project_name = planning_context.get('project', {}).get('name', 'unknown')
        logger.info(f'[KanbanPipeline] Context: {len(planning_context.get("agents", []))} agents, {len(planning_context.get("environments", []))} environments')

        # ── Blackboard: pre-create workflow directory ──
        logger.info('[KanbanPipeline] Step 2b: pre-creating workflow directory (Blackboard)...')
        workflow_prep = await client.prepare_workflow(project_id, project_name)
        workflow_id = workflow_prep.get('id')
        workflow_dir = workflow_prep.get('workflow_path', '')
        if not workflow_id or not workflow_dir:
            raise ValueError('Failed to pre-create workflow directory for Blackboard pattern')

        logger.info(f'[KanbanPipeline] Workflow directory ready: {workflow_dir} (id={workflow_id})')

        # Load planning instructions from native-skills (injected directly into prompt).
        # The planning skill is a centralized file, NOT a per-workspace skill.
        # We search multiple candidate paths to handle different installation layouts:
        #   1. <client/orchestrator>/../native-skills/planning/SKILL.md  (dev repo layout)
        #   2. <client>/native-skills/planning/SKILL.md               (installed layout)
        #   3. <WEAVE_ROOT>/native-skills/planning/SKILL.md           (monorepo root)
        skill_content = ''
        skill_path = None

        # Determine WEAVE_ROOT: the repository root that contains native-skills/
        # In the dev repo layout:  dev/client/orchestrator/kanban_pipeline.py
        #                         dev/native-skills/planning/SKILL.md
        # In installed layout:   <install>/client/orchestrator/kanban_pipeline.py
        #                         <install>/native-skills/planning/SKILL.md
        _orchestrator_dir = os.path.dirname(os.path.abspath(__file__))  # .../client/orchestrator
        _client_dir = os.path.dirname(_orchestrator_dir)                # .../client
        _repo_root = os.path.dirname(_client_dir)                       # .../dev or .../<install>

        candidate_paths = [
            # Dev repo layout: native-skills is at repo root (sibling of client/)
            os.path.join(_repo_root, 'native-skills', 'planning', 'SKILL.md'),
            # Installed layout: native-skills inside client/
            os.path.join(_client_dir, 'native-skills', 'planning', 'SKILL.md'),
            # Fallback: native-skills alongside orchestrator/
            os.path.join(_orchestrator_dir, '..', 'native-skills', 'planning', 'SKILL.md'),
        ]

        # Also try WEAVE_ROOT from environment variable
        _weave_root = os.environ.get('WEAVE_ROOT', '')
        if _weave_root:
            candidate_paths.insert(0, os.path.join(_weave_root, 'native-skills', 'planning', 'SKILL.md'))
            candidate_paths.insert(0, os.path.join(_weave_root, 'client', 'native-skills', 'planning', 'SKILL.md'))

        for candidate in candidate_paths:
            candidate = os.path.normpath(candidate)
            if os.path.isfile(candidate):
                skill_path = candidate
                break

        if skill_path:
            with open(skill_path) as f:
                skill_content = f.read()
            # Substitute the [WORKFLOW_DIR] placeholder with the actual workflow directory
            skill_content = skill_content.replace('[WORKFLOW_DIR]', workflow_dir)
            logger.info(f'[KanbanPipeline] Loaded planning instructions from {skill_path} ({len(skill_content)} chars)')
        else:
            raise FileNotFoundError(
                f'[KanbanPipeline] Native planning skill not found. '
                f'Searched: {candidate_paths}. '
                f'Ensure native-skills/planning/SKILL.md exists in the weave installation directory.'
            )

        logger.info('[KanbanPipeline] Step 4: building planning prompt...')
        prompt = await build_planning_prompt({
            'title': title,
            'description': description
        }, planning_context, skill_content, workflow_context, workflow_dir=workflow_dir, environment_id=environment_id)
        logger.info(f'[KanbanPipeline] Prompt length: {len(prompt)} chars')

        # Executa o planning agent via SDK
        logger.info('[KanbanPipeline] Step 5: importing SDK and preparing options...')
        from claude_agent_sdk import query, ClaudeAgentOptions, PermissionResultAllow, ToolPermissionContext

        # Get valid SDK fields
        valid_fields = set(inspect.signature(ClaudeAgentOptions.__init__).parameters.keys()) - {"self"}

        async def _kanban_can_use_tool(tool_name, tool_input, context):
            """Auto-approve all tools in kanban pipeline — no interactive user."""
            logger.info(f"[KanbanPipeline] Auto-approved tool '{tool_name}'")
            return PermissionResultAllow()

        opts_kwargs = {
            "cwd": planner_workspace,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project", "local"],
            "can_use_tool": _kanban_can_use_tool,
        }
        # Filtra apenas campos válidos
        opts_kwargs = {k: v for k, v in opts_kwargs.items() if k in valid_fields}

        opts = ClaudeAgentOptions(**opts_kwargs)

        full_response = ""
        logger.info('[KanbanPipeline] Step 6: running planning agent...')

        async def _string_to_async_iterable(text):
            yield {"type": "user", "session_id": "", "message": {"role": "user", "content": text}, "parent_tool_use_id": None}

        # Import subagent message types for lifecycle tracking
        from claude_agent_sdk import (
            AssistantMessage,
            ResultMessage,
            TaskStartedMessage,
            TaskProgressMessage,
            TaskNotificationMessage,
        )
        from claude_agent_sdk import ToolUseBlock

        subagent_names: dict[str, str] = {}  # tool_use_id / task_id -> short name

        async for event in query(prompt=_string_to_async_iterable(prompt), options=opts):
            event_type = type(event).__name__
            if event_type == "AssistantMessage":
                for block in getattr(event, "content", []):
                    if hasattr(block, "text"):
                        full_response += block.text
                    # Track Agent/Task tool calls for human-readable names
                    elif isinstance(block, ToolUseBlock) and block.name in ('Agent', 'Task') and block.id:
                        _input = block.input if isinstance(block.input, dict) else {}
                        short_name = _input.get('description') or _input.get('name') or _input.get('prompt', '')[:60]
                        if short_name:
                            subagent_names[block.id] = short_name
            elif event_type == "TaskStartedMessage":
                _tool_use_id = getattr(event, 'tool_use_id', None)
                _display_id = subagent_names.get(_tool_use_id, event.task_id) if _tool_use_id else event.task_id
                subagent_names[event.task_id] = _display_id
                type_label = f" ({event.task_type})" if getattr(event, 'task_type', None) else ""
                logger.subagent_start("planner", _display_id, event.description, task_type=getattr(event, 'task_type', None))
                logger.info(f'[KanbanPipeline] Subagent spawned: {_display_id}{type_label} — {event.description[:120]}')
            elif event_type == "TaskProgressMessage":
                _display_id = subagent_names.get(event.task_id, event.task_id)
                logger.subagent_progress("planner", _display_id, event.description, tokens=(getattr(event, 'usage', None) or {}).get('total_tokens', 0))
            elif event_type == "TaskNotificationMessage":
                status = getattr(event, 'status', 'unknown')
                summary = getattr(event, 'summary', '')
                _display_id = subagent_names.get(event.task_id, event.task_id)
                logger.subagent_done("planner", _display_id, status, summary)
                logger.info(f'[KanbanPipeline] Subagent {_display_id} {status} — {summary[:100] if summary else ""}')
            elif event_type == "ResultMessage":
                result_text = getattr(event, "result", "") or ""
                if result_text:
                    full_response += result_text

        logger.info(f'[KanbanPipeline] Step 7: planning agent finished, response length: {len(full_response)}')

        # Salva resposta para diagnóstico
        log_path = f'/tmp/kanban_agent_response_{task_id[:8]}.txt'
        with open(log_path, 'w') as f:
            f.write(full_response)
        logger.info(f'[KanbanPipeline] Response saved to {log_path}')

        # ── Blackboard: read plan from file instead of parsing stdout ──
        plan_file_path = os.path.join(workflow_dir, 'plan.json')
        logger.info(f'[KanbanPipeline] Step 8: reading plan from Blackboard: {plan_file_path}')
        plan_data = load_plan_from_file(plan_file_path, fallback_name=title)
        if not plan_data:
            raise ValueError(f"Planning agent did not save a valid plan.json to {plan_file_path}")

        # Normaliza schema das tasks
        plan_data = normalize_plan_tasks(plan_data, planning_context=planning_context)
        logger.info(f'[KanbanPipeline] Tasks after normalization: {[(t["id"], t["name"][:30]) for t in plan_data["tasks"]]}')

        logger.info(
            f"[KanbanPipeline] Step 9: plan loaded: {plan_data['name']} "
            f"({len(plan_data['tasks'])} tasks)"
        )

        # Garanta que tasks têm IDs
        for i, t in enumerate(plan_data["tasks"]):
            if not t.get("id"):
                t["id"] = f"task-{i+1}"

        # Adiciona project_id ao plano
        plan_data["project_id"] = project_id
        plan_data["kanban_task_id"] = task_id  # para rastreabilidade

        # Define status do plano baseado em auto_approve
        auto_approve = project_settings.get("auto_approve_workflows", False)
        plan_data["status"] = "pending" if auto_approve else "awaiting_approval"

        # Persist team_id (planner workspace) for plan-to-chat conversion
        if planner_workspace and not plan_data.get("team_id"):
            plan_data["team_id"] = planner_workspace

        # Cria o workflow — reusing the pre-created workflow_id
        logger.info(f'[KanbanPipeline] Step 10: creating workflow from plan (status={plan_data["status"]})...')
        plan_data["workflow_id"] = workflow_id
        created_plan = await client.create_plan_from_data(plan_data)
        plan_id = created_plan.get("id")
        if not plan_id:
            raise ValueError("Failed to create workflow from plan - API returned no plan ID")

        logger.info(f'[KanbanPipeline] Step 10b: verifying plan {plan_id} was persisted...')

        # Verify the plan was actually created by fetching it
        try:
            verify_response = await client._get(f"/plans/{plan_id}")
            if verify_response is None:
                logger.error(f'[KanbanPipeline] Plan {plan_id} verification failed: _get returned None')
                raise ValueError(f"Plan {plan_id} was not found after creation - may not have been persisted")
            logger.info(f'[KanbanPipeline] Plan {plan_id} verified successfully')
        except Exception as e:
            logger.error(f'[KanbanPipeline] Plan {plan_id} verification error: {e}')
            raise ValueError(f"Plan {plan_id} verification failed: {e}")

        logger.info(f'[KanbanPipeline] Step 11: workflow created: {plan_id}')

        # Vincula workflow à kanban task
        logger.info('[KanbanPipeline] Step 12: linking workflow to kanban task...')
        await client.update_kanban_pipeline(
            project_id, task_id, pipeline_status="awaiting_approval", workflow_id=plan_id
        )

        # Auto-aprova se configurado
        if auto_approve:
            logger.info(f'[KanbanPipeline] Step 13: moving task {task_id} to in_dev (workflow already pending)...')
            patch_result = await client._put(f'/kanban/{project_id}/{task_id}', {
                'column': 'in_dev',
                'pipeline_status': 'running',
            })
            if patch_result is None:
                logger.error(f'[KanbanPipeline] PUT returned None — check HTTP method and URL')
            else:
                logger.info(f'[KanbanPipeline] PUT result: {patch_result}')
            logger.success(
                f"[KanbanPipeline] Workflow pending, task moved to in_dev: {plan_id}"
            )
        else:
            logger.info(f'[KanbanPipeline] Step 13: workflow awaiting manual approval: {plan_id}')

    except Exception as e:
        logger.error(f'[KanbanPipeline] Unhandled error in task {task_id}: {type(e).__name__}: {e}')
        # Garante que a task não fica presa em 'planning' para sempre
        try:
            await client.update_kanban_pipeline(
                project_id, task_id,
                pipeline_status="failed",
                error_message=f'Unhandled error: {str(e)}'
            )
        except Exception:
            pass


async def sync_workflow_status(client) -> None:
    """
    Sincroniza status de workflows vinculados a kanban tasks.

    Verifica se workflows vinculados a kanban tasks concluíram e atualiza
    o status das tasks correspondentes, considerando result_status da review
    e as configurações de gates (auto-advance).

    Usa handle_team_completion() do team_trigger para decisão de transição.

    Args:
        client: DaemonClient instance
    """
    try:
        projects = await client.get_all_projects()
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue

            # Parse project settings
            project_settings = {}
            try:
                ps = project.get('settings', {})
                if isinstance(ps, str):
                    ps = json.loads(ps)
                project_settings = ps
            except Exception:
                pass

            # Busca tasks com pipeline 'running' ou 'awaiting_approval'
            try:
                tasks_resp = await client._get(f"/kanban/{project_id}")
                # Unwrap envelope {data: ...}
                if isinstance(tasks_resp, dict):
                    tasks = tasks_resp.get('data', [])
                elif isinstance(tasks_resp, list):
                    tasks = tasks_resp
                else:
                    tasks = []
            except Exception as e:
                logger.warning(f"Failed to fetch kanban tasks for project {project_id}: {e}")
                continue

            active_tasks = [
                t for t in tasks
                if t.get("pipeline_status") in ("running", "awaiting_approval")
                and t.get("workflow_id")
            ]

            for task in active_tasks:
                workflow_id = task["workflow_id"]
                try:
                    plan_resp = await client._get(f'/plans/{workflow_id}')
                    # Unwrap envelope {data: ...}
                    if isinstance(plan_resp, dict):
                        plan = plan_resp.get('data') if 'data' in plan_resp else plan_resp
                    else:
                        plan = None

                    if not plan or not isinstance(plan, dict):
                        logger.warning(f'[KanbanPipeline] Could not fetch plan {workflow_id}: {plan_resp}')
                        continue

                    plan_status = plan.get("status")
                    result_status = plan.get("result_status")  # success|partial|needs_rework|None
                    task_id = task["id"]
                    current_column = task.get('column', '')

                    logger.debug(f'[KanbanPipeline] Plan {workflow_id}: status={plan_status}, result_status={result_status}')

                    # ── Workflow completed successfully ──
                    if plan_status == "success":
                        # Usa handle_team_completion para decidir transição com base nos gates
                        await handle_team_completion(task, plan, project_settings, project_id, client)

                    # ── Workflow failed ──
                    elif plan_status == "failed" and task.get("pipeline_status") != "failed":
                        # Usa handle_team_completion que move para fase anterior
                        await handle_team_completion(task, plan, project_settings, project_id, client)

                    # ── Plan approved by user (status changed to pending/running) ──
                    elif plan_status in ("pending", "running") and task.get("pipeline_status") in ("awaiting_approval",):
                        # Usuário aprovou manualmente no dashboard — move coluna e atualiza status
                        # Bug 3 fix: Só move se ainda não estiver em in_dev para evitar loop
                        if task.get('column') != 'in_dev':
                            patch_resp = await client._put(f'/kanban/{project_id}/{task_id}', {
                                "column": "in_dev",
                                "pipeline_status": "running"
                            })
                            logger.info(f"[KanbanPipeline] Task approved and moved to in_dev: {task_id}, patch={patch_resp}")
                        else:
                            # Coluna já é in_dev mas pipeline_status ainda está errado — corrige só o status
                            patch_resp = await client._put(f'/kanban/{project_id}/{task_id}', {
                                "pipeline_status": "running"
                            })
                            logger.debug(f"[KanbanPipeline] Fixed stale pipeline_status for {task_id}, patch={patch_resp}")

                except Exception as e:
                    logger.warning(f"Failed to sync workflow {workflow_id}: {e}")
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Sync error: {e}")


# NOTE: _handle_needs_rework moved to team_trigger.py (shared module)
# Re-exported via import at the top of this file


async def auto_move_tasks(project_id: str, settings: dict, client) -> None:
    """
    Move tasks automaticamente entre colunas quando habilitado.

    Respeita os gates de auto-advance configurados no projeto:
    - auto_advance_plan_to_dev (default true)
    - auto_advance_dev_to_staging (default true)
    - auto_advance_staging_to_done (default false)

    Args:
        project_id: ID do projeto
        settings: Configurações do projeto (deve conter auto_move_enabled)
        client: DaemonClient instance
    """
    if not settings.get('auto_move_enabled', False):
        return

    # Read gate settings
    auto_advance_plan_to_dev = settings.get('auto_advance_plan_to_dev', True)
    auto_advance_dev_to_staging = settings.get('auto_advance_dev_to_staging', True)
    auto_advance_staging_to_done = settings.get('auto_advance_staging_to_done', False)

    try:
        tasks_resp = await client._get(f'/kanban/{project_id}')
        tasks = tasks_resp if isinstance(tasks_resp, list) else (
            tasks_resp.get('data', []) if isinstance(tasks_resp, dict) else []
        )

        # Condição de parada: há tasks needs_rework não resolvidas?
        needs_rework = [
            t for t in tasks
            if t.get('result_status') == 'needs_rework'
            and t.get('column') == 'backlog'
            and t.get('title', '').startswith('[Rework]')
        ]
        if needs_rework:
            logger.debug(f'[AutoMove] Paused: {len(needs_rework)} rework task(s) pending resolution')
            return

        # Read limit settings with correct names
        max_planning_tasks = settings.get('max_planning_tasks', 1)
        max_in_progress_tasks = settings.get('max_in_progress_tasks', 1)
        max_concurrent_workflows = settings.get('max_concurrent_workflows', 0)  # 0 = unlimited

        # Check global concurrent workflows limit
        if max_concurrent_workflows > 0:
            running_resp = await client._get('/plans?status=running')
            if isinstance(running_resp, dict):
                running_plans = running_resp.get('data', []) if isinstance(running_resp.get('data'), list) else []
            elif isinstance(running_resp, list):
                running_plans = running_resp
            else:
                running_plans = []

            if len(running_plans) >= max_concurrent_workflows:
                logger.debug(f'[AutoMove] Global workflow limit reached ({len(running_plans)}/{max_concurrent_workflows})')
                return

        # ── Transition 1: Backlog → Planning ──
        in_planning = [t for t in tasks if t.get('column') == 'planning']
        effective_planning_limit = max_planning_tasks if max_planning_tasks > 0 else float('inf')

        if len(in_planning) < effective_planning_limit:
            # Pega a task de maior prioridade no backlog (menor número = maior prioridade)
            backlog = sorted(
                [
                    t for t in tasks
                    if t.get('column') == 'backlog'
                    and t.get('pipeline_status', 'idle') == 'idle'
                ],
                key=lambda t: (t.get('priority', 99), t.get('created_at', ''))
            )
            if backlog:
                next_task = backlog[0]
                await client._put(f'/kanban/{project_id}/{next_task["id"]}', {
                    'column': 'planning',
                    'pipeline_status': 'idle',
                })
                logger.info(f'[AutoMove] Moved "{next_task["title"]}" backlog → planning')

        # ── Transition 2: Planning → In Dev (respects auto_advance_plan_to_dev gate) ──
        in_dev = [t for t in tasks if t.get('column') == 'in_dev']
        effective_in_dev_limit = max_in_progress_tasks if max_in_progress_tasks > 0 else float('inf')

        if auto_advance_plan_to_dev and len(in_dev) < effective_in_dev_limit:
            planning_with_workflow = sorted(
                [t for t in tasks if t.get('column') == 'planning' and t.get('workflow_id')],
                key=lambda t: (t.get('priority', 99), t.get('created_at', ''))
            )
            if planning_with_workflow:
                next_task = planning_with_workflow[0]
                await client._put(f'/kanban/{project_id}/{next_task["id"]}', {
                    'column': 'in_dev',
                })
                logger.info(f'[AutoMove] Moved "{next_task["title"]}" planning → in_dev')
        elif not auto_advance_plan_to_dev:
            logger.debug('[AutoMove] Gate blocked: planning → in_dev (auto_advance_plan_to_dev=false)')

        # ── Transition 3: In Dev → Validation (respects auto_advance_dev_to_staging gate) ──
        if auto_advance_dev_to_staging:
            in_dev_with_done_workflow = [
                t for t in tasks
                if t.get('column') == 'in_dev'
                and t.get('workflow_id')
            ]
            for t in in_dev_with_done_workflow:
                # Check if workflow completed
                plan_resp = await client._get(f'/plans/{t["workflow_id"]}')
                plan = None
                if isinstance(plan_resp, dict):
                    plan = plan_resp.get('data', plan_resp) if 'data' in plan_resp else plan_resp
                elif isinstance(plan_resp, list):
                    plan = plan_resp[0] if plan_resp else None

                if plan and plan.get('status') == 'success' and plan.get('result_status') != 'needs_rework':
                    await client._put(f'/kanban/{project_id}/{t["id"]}', {
                        'column': 'validation',
                    })
                    logger.info(f'[AutoMove] Moved "{t["title"]}" in_dev → validation (workflow completed)')
                    break  # Move one at a time
        else:
            logger.debug('[AutoMove] Gate blocked: in_dev → validation (auto_advance_dev_to_staging=false)')

        # ── Transition 4: Validation → Done (respects auto_advance_staging_to_done gate) ──
        if auto_advance_staging_to_done:
            in_validation = sorted(
                [t for t in tasks if t.get('column') == 'validation'],
                key=lambda t: (t.get('priority', 99), t.get('created_at', ''))
            )
            if in_validation:
                next_task = in_validation[0]
                await client._put(f'/kanban/{project_id}/{next_task["id"]}', {
                    'column': 'done',
                    'pipeline_status': 'done',
                })
                logger.info(f'[AutoMove] Moved "{next_task["title"]}" validation → done')
        else:
            logger.debug('[AutoMove] Gate blocked: validation → done (auto_advance_staging_to_done=false)')

    except Exception as e:
        logger.warning(f'[AutoMove] Error: {e}')


async def poll_kanban_tasks(client) -> None:
    """
    Verifica todos os projetos por kanban tasks ativas e aciona times conforme a fase.

    Pipeline:
      1. Processa tasks agendadas (recorrência)
      2. Auto-move tasks baseado em gates
      3. PLANNING: processa tasks sem workflow (trigger Plan Team via process_kanban_task)
      4. IN_DEV: detecta tasks com workflow aprovado e aciona Dev Team
      5. VALIDATION: detecta tasks com workflow dev concluído e aciona Staging Team
      6. Sincroniza status de workflows ativos (completion → gate transitions)

    Args:
        client: DaemonClient instance
    """
    try:
        # Processa tasks agendadas PRIMEIRO
        await process_scheduled_tasks(client)

        projects = await client.get_all_projects()
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue

            # Parse settings
            settings = project.get('settings', {})
            if isinstance(settings, str):
                try:
                    settings = json.loads(settings)
                except Exception:
                    settings = {}

            # Auto-move antes de processar
            await auto_move_tasks(project_id, settings, client)

            # ── Phase 1: PLANNING — Tasks sem workflow ──
            pending = await client.get_pending_kanban_tasks(project_id)
            for task in pending:
                # Processa em background sem bloquear o daemon loop
                asyncio.create_task(_run_kanban_task(task, client))

            # ── Phase 2: IN_DEV — Trigger Dev Team ──
            await _process_in_dev_tasks(project_id, settings, client)

            # ── Phase 3: VALIDATION — Trigger Staging Team ──
            await _process_validation_tasks(project_id, settings, client)

        # Sincroniza status de workflows ativos (completion → gate transitions)
        await sync_workflow_status(client)
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Poll error: {e}")


# Rastreia tasks em processamento para evitar duplicatas
_running_kanban_tasks: set = set()

# Rastreia tasks que já tiveram Dev Team acionado (evita re-trigger)
_running_dev_tasks: set = set()

# Rastreia tasks que já tiveram Staging Team acionado (evita re-trigger)
_running_staging_tasks: set = set()


async def _process_in_dev_tasks(project_id: str, settings: dict, client) -> None:
    """
    Detecta tasks em in_dev com workflow aprovado que ainda não foram executadas
    e aciona o Dev Team.

    Uma task em in_dev com workflow_id mas sem execução ativa significa que o plano
    foi gerado (pelo Plan Team) e aprovado (manualmente ou via auto-approve), mas o
    Dev Team ainda não foi acionado para executá-lo.

    O Dev Team é acionado criando um plano de execução com as tasks do workflow
    original. O daemon detecta este novo plano e o executa automaticamente.

    Args:
        project_id: ID do projeto
        settings: Configurações do projeto
        client: DaemonClient instance
    """
    global _running_dev_tasks

    try:
        tasks_resp = await client._get(f'/kanban/{project_id}')
        if isinstance(tasks_resp, dict):
            tasks = tasks_resp.get('data', [])
        elif isinstance(tasks_resp, list):
            tasks = tasks_resp
        else:
            return

        for task in tasks:
            task_id = task.get('id')
            column = task.get('column')
            pipeline_status = task.get('pipeline_status')
            workflow_id = task.get('workflow_id')

            # Condições para acionar Dev Team:
            # 1. Task está em in_dev
            # 2. Tem workflow_id (plano gerado pelo Plan Team)
            # 3. Pipeline não está running (não está em execução)
            # 4. Não está falha
            # 5. Não está já sendo processada
            if (
                column == 'in_dev'
                and workflow_id
                and pipeline_status not in ('running', 'failed')
                and task_id not in _running_dev_tasks
            ):
                # Verifica se o plano original (do Plan Team) foi aprovado
                plan_resp = await client._get(f'/plans/{workflow_id}')
                if isinstance(plan_resp, dict):
                    plan = plan_resp.get('data', plan_resp) if 'data' in plan_resp else plan_resp
                else:
                    plan = None

                if not plan or not isinstance(plan, dict):
                    continue

                plan_status = plan.get('status')

                # Se o plano ainda está awaiting_approval, não aciona o Dev Team
                if plan_status == 'awaiting_approval':
                    logger.debug(f'[KanbanPipeline] Task {task_id} plan still awaiting approval')
                    continue

                # Se o plano já está running/success, o Dev Team já foi ou está sendo executado
                if plan_status in ('running',):
                    logger.debug(f'[KanbanPipeline] Task {task_id} workflow already running')
                    continue

                # Se o plano já completou com sucesso, o sync_workflow_status vai cuidar
                if plan_status == 'success':
                    continue

                # Plano aprovado (pending) ou re-executável — aciona Dev Team
                _running_dev_tasks.add(task_id)
                logger.info(
                    f'[KanbanPipeline][Dev Team] Triggering execution for task {task_id} '
                    f'(workflow {workflow_id[:8]}, plan status: {plan_status})'
                )

                # Marca pipeline como running
                await client.update_kanban_pipeline(
                    project_id, task_id,
                    pipeline_status='running'
                )

                # Extrai tasks do plano original
                try:
                    plan_tasks_json = plan.get('tasks', '[]')
                    plan_tasks = json.loads(plan_tasks_json) if isinstance(plan_tasks_json, str) else plan_tasks_json
                except Exception:
                    plan_tasks = []

                # Aciona Dev Team
                dev_plan_id = await trigger_dev_team(
                    task={'id': task_id, 'project_id': project_id, 'title': task.get('title', ''), 'description': task.get('description', '')},
                    plan_data={'tasks': plan_tasks, 'name': plan.get('name', '')},
                    client=client,
                )

                if not dev_plan_id:
                    logger.error(f'[KanbanPipeline][Dev Team] Failed to create execution plan for task {task_id}')
                    await client.update_kanban_pipeline(
                        project_id, task_id,
                        pipeline_status='failed',
                        error_message='Failed to trigger Dev Team — no coder workspace found'
                    )

                # Remove do tracking (o sync_workflow_status vai cuidar do completion)
                _running_dev_tasks.discard(task_id)

    except Exception as e:
        logger.warning(f'[KanbanPipeline] Error processing in_dev tasks: {e}')


async def _process_validation_tasks(project_id: str, settings: dict, client) -> None:
    """
    Detecta tasks em validation sem pipeline ativo e aciona o Staging Team.

    Uma task em validation com pipeline_status='idle' significa que o Dev Team
    terminou (com sucesso) e a task foi movida para validation. Agora o
    Staging Team precisa executar build validation e QA.

    O Staging Team é acionado criando um plano de validação. O daemon detecta
    este plano e o executa automaticamente.

    Args:
        project_id: ID do projeto
        settings: Configurações do projeto
        client: DaemonClient instance
    """
    global _running_staging_tasks

    try:
        tasks_resp = await client._get(f'/kanban/{project_id}')
        if isinstance(tasks_resp, dict):
            tasks = tasks_resp.get('data', [])
        elif isinstance(tasks_resp, list):
            tasks = tasks_resp
        else:
            return

        for task in tasks:
            task_id = task.get('id')
            column = task.get('column')
            pipeline_status = task.get('pipeline_status')

            # Condições para acionar Staging Team:
            # 1. Task está em validation
            # 2. Pipeline está idle (aguardando validação)
            # 3. Não está falha
            # 4. Não está já sendo processada pelo Staging Team
            if (
                column == 'validation'
                and pipeline_status == 'idle'
                and task_id not in _running_staging_tasks
            ):
                _running_staging_tasks.add(task_id)

                logger.info(
                    f'[KanbanPipeline][Staging Team] Triggering validation for task {task_id}'
                )

                # Marca pipeline como running
                await client.update_kanban_pipeline(
                    project_id, task_id,
                    pipeline_status='running'
                )

                # Busca o plano do Dev Team para contexto
                dev_plan = {}
                dev_workflow_id = task.get('workflow_id')
                if dev_workflow_id:
                    try:
                        plan_resp = await client._get(f'/plans/{dev_workflow_id}')
                        if isinstance(plan_resp, dict):
                            dev_plan = plan_resp.get('data', plan_resp) if 'data' in plan_resp else plan_resp
                            if not isinstance(dev_plan, dict):
                                dev_plan = {}
                    except Exception:
                        pass

                # Aciona Staging Team
                staging_plan_id = await trigger_staging_team(
                    task=task,
                    dev_plan=dev_plan,
                    client=client,
                )

                if not staging_plan_id:
                    logger.error(f'[KanbanPipeline][Staging Team] Failed to create staging plan for task {task_id}')
                    await client.update_kanban_pipeline(
                        project_id, task_id,
                        pipeline_status='failed',
                        error_message='Failed to trigger Staging Team — no reviewer workspace found'
                    )
                else:
                    # Vincula o plano do Staging Team à task para rastreabilidade
                    # O sync_workflow_status vai usar este workflow_id para monitorar
                    # Nota: usamos o staging_plan_id como novo workflow_id
                    # pois o Dev Team workflow já completou
                    await client.update_kanban_pipeline(
                        project_id, task_id,
                        workflow_id=staging_plan_id,
                    )
                    logger.success(
                        f'[KanbanPipeline][Staging Team] Staging workflow {staging_plan_id[:8]} '
                        f'linked to task {task_id}'
                    )

                # Remove do tracking (o sync_workflow_status vai cuidar do completion)
                _running_staging_tasks.discard(task_id)

    except Exception as e:
        logger.warning(f'[KanbanPipeline] Error processing validation tasks: {e}')


async def _run_kanban_task(task: dict, client) -> None:
    """
    Wrapper para processar kanban task com tracking.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    task_id = task["id"]
    if task_id in _running_kanban_tasks:
        logger.debug(f'[KanbanPipeline] Task {task_id} already running, skipping')
        return
    _running_kanban_tasks.add(task_id)
    try:
        await process_kanban_task(task, client)
    except Exception as e:
        logger.error(f'[KanbanPipeline] Unhandled error in task {task_id}: {type(e).__name__}: {e}')
        # Garante que a task não fica presa em 'planning' para sempre
        try:
            await client.update_kanban_pipeline(
                task['project_id'], task_id,
                pipeline_status='failed',
                error_message=f'Unhandled error: {str(e)}'
            )
        except Exception:
            pass
    finally:
        _running_kanban_tasks.discard(task_id)
