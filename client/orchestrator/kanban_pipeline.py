"""Processa kanban tasks ativas, gera planos via planning agent e cria workflows."""

from __future__ import annotations

import asyncio
import inspect
import json
import os
import re
from datetime import datetime, timezone

from orchestrator import logger
from orchestrator.cron_utils import next_run_from_cron


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


def extract_plan_from_text(text: str, fallback_name: str = '') -> dict | None:
    """
    Extrai JSON de plano entre tags <plan>...</plan>.

    Args:
        text: Texto que pode conter um plano em formato JSON
        fallback_name: Nome a usar se o plano não tiver campo 'name'

    Returns:
        Dicionário do plano se encontrado e válido, None caso contrário
    """
    # Normaliza: remove code fences que possam envolver <plan>
    # Ex: ```\n<plan>...\n</plan>\n``` → <plan>...\n</plan>
    normalized = re.sub(r'```[\w]*\s*(<plan>[\s\S]*?</plan>)\s*```', r'\1', text)

    # Encontra todos os blocos <plan>...</plan>
    plan_pattern = r'<plan>\s*(\{[\s\S]*?\})\s*</plan>'
    matches = re.finditer(plan_pattern, normalized)

    for match in matches:
        raw = match.group(1).strip()

        # Tenta extrair apenas o JSON (pode ter texto antes/depios)
        # Procura pelo primeiro { e último }
        first_brace = raw.find('{')
        if first_brace == -1:
            continue

        last_brace = raw.rfind('}')
        if last_brace == -1:
            continue

        json_str = raw[first_brace:last_brace + 1]

        try:
            parsed = json.loads(json_str)
            name = parsed.get('name', '')
            tasks = parsed.get('tasks', [])

            if name == 'Descriptive plan name':
                logger.info('[KanbanPipeline] Skipping template placeholder plan')
                continue

            if not isinstance(tasks, list) or len(tasks) == 0:
                logger.info(f'[KanbanPipeline] Plan has no tasks, skipping')
                continue

            # Aceita plano sem nome — usa fallback
            if not name and fallback_name:
                parsed['name'] = fallback_name
                logger.info(f'[KanbanPipeline] Plan has no name, using fallback: {fallback_name}')

            logger.info(f'[KanbanPipeline] Valid plan found: "{parsed.get("name")}" ({len(tasks)} tasks)')
            return parsed
        except (json.JSONDecodeError, KeyError) as e:
            logger.info(f'[KanbanPipeline] JSON parse failed: {type(e).__name__}: {e}')
            logger.debug(f'[KanbanPipeline] Failed JSON string (first 200 chars): {json_str[:200]}')
            continue

    logger.warning(f'[KanbanPipeline] No valid <plan> found. <plan> count: {text.count("<plan>")}')
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

    normalized_tasks = []
    for i, task in enumerate(plan_data.get('tasks', [])):
        # Normaliza cwd com fallback do environment
        cwd = (
            task.get('cwd') or
            task.get('workingDirectory') or
            task.get('working_directory') or
            fallback_cwd or
            ''
        )

        # workspace pode vir em task.workspace ou task.agent.workspace
        workspace = task.get('workspace') or ''
        if not workspace and isinstance(task.get('agent'), dict):
            workspace = task['agent'].get('workspace', '')

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
) -> str:
    """Monta o prompt completo para o agente planejador."""
    project = planning_context.get('project', {})
    environments = planning_context.get('environments', [])
    agents = planning_context.get('agents', [])

    # Seção de contexto do projeto
    project_section = f"""## Project Context

Name: {project.get('name', 'Unknown')}
Description: {project.get('description', 'No description')}
"""

    # Seção de ambientes
    env_lines = []
    for env in environments:
        env_lines.append(
            f"- **{env.get('name')}** ({env.get('type')})\n"
            f"  project_path: `{env.get('project_path')}`"
        )
    env_section = "## Environments\n\n" + ("\n".join(env_lines) if env_lines else "No environments configured.")

    # Seção de agentes disponíveis
    agent_lines = []
    for agent in agents:
        agent_lines.append(
            f"- **{agent.get('name')}** (role: `{agent.get('role')}`)\n"
            f"  workspace: `{agent.get('workspace_path')}`"
        )
    agents_section = (
        "## Available Agents\n\n"
        + ("\n".join(agent_lines) if agent_lines else "No agents configured.")
        + "\n\nWhen creating tasks, use the exact `workspace` paths listed above."
        + "\nMatch task type to agent role: planner for planning, coder for implementation, reviewer for validation."
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

- `workspace`: path to the agent's workspace folder (where .claude/settings.local.json lives)
- `cwd`: the project directory where the code lives (use environment project_path above)

For coder agents: set cwd = the environment project_path, workspace = agent workspace_path
For reviewer/tester agents: same pattern
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
Output the plan using the <plan>...</plan> format as defined in the skill above.'''


async def find_planner_workspace(project_id: str, client) -> str | None:
    """
    Encontra o workspace do agente planner do projeto.

    Args:
        project_id: ID do projeto
        client: DaemonClient instance

    Returns:
        Caminho do workspace do planner ou None se não encontrado
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

        planners = [a for a in agents if a.get('role') == 'planner']
        if not planners:
            logger.warning(f'[KanbanPipeline] No planner among agents: {[a.get("name") for a in agents]}')
            return None

        workspace = planners[0].get('workspace_path')
        logger.info(f'[KanbanPipeline] Found planner workspace: {workspace}')
        return workspace
    except Exception as e:
        logger.warning(f'Could not find planner workspace: {type(e).__name__}: {e}')
        return None


async def process_kanban_task(task: dict, client) -> None:
    """
    Processa uma kanban task: roda planning agent e cria workflow.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    task_id = task["id"]
    project_id = task["project_id"]
    title = task.get("title", "Untitled")
    description = task.get("description", "")
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
        planner_workspace = await find_planner_workspace(project_id, client)
        logger.info(f'[KanbanPipeline] Planner workspace: {planner_workspace}')

        if not planner_workspace:
            raise ValueError(f'No planner agent with role=planner found for project {project_id}. Assign a planner agent to this project first.')

        logger.info('[KanbanPipeline] Step 2: fetching full project planning context...')
        planning_context = await client.get_project_planning_context(project_id)
        workflow_context = planning_context.get('workflow_context', '')
        logger.info(f'[KanbanPipeline] Context: {len(planning_context.get("agents", []))} agents, {len(planning_context.get("environments", []))} environments')

        # Lê SKILL.md (sempre, independente de setting_sources)
        logger.info('[KanbanPipeline] Step 3: loading planning skill...')
        skill_path = os.path.join(planner_workspace, '.claude', 'skills', 'planning', 'SKILL.md')
        skill_content = ''
        if os.path.exists(skill_path):
            with open(skill_path) as f:
                skill_content = f.read()
            logger.info(f'[KanbanPipeline] Loaded planning skill ({len(skill_content)} chars)')
        else:
            logger.warning(f'[KanbanPipeline] Planning skill not found at {skill_path}')
            skill_content = 'Generate a precise execution plan in <plan>...</plan> format.'

        logger.info('[KanbanPipeline] Step 4: building planning prompt...')
        prompt = await build_planning_prompt({
            'title': title,
            'description': description
        }, planning_context, skill_content, workflow_context)
        logger.info(f'[KanbanPipeline] Prompt length: {len(prompt)} chars')

        # Executa o planning agent via SDK
        logger.info('[KanbanPipeline] Step 5: importing SDK and preparing options...')
        from claude_agent_sdk import query, ClaudeAgentOptions

        # Get valid SDK fields
        valid_fields = set(inspect.signature(ClaudeAgentOptions.__init__).parameters.keys()) - {"self"}

        opts_kwargs = {
            "cwd": planner_workspace,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project", "local"],
        }
        # Filtra apenas campos válidos
        opts_kwargs = {k: v for k, v in opts_kwargs.items() if k in valid_fields}

        opts = ClaudeAgentOptions(**opts_kwargs)

        full_response = ""
        logger.info('[KanbanPipeline] Step 6: running planning agent...')
        async for event in query(prompt=prompt, options=opts):
            event_type = type(event).__name__
            if event_type == "AssistantMessage":
                for block in getattr(event, "content", []):
                    if hasattr(block, "text"):
                        full_response += block.text
            elif event_type == "ResultMessage":
                result_text = getattr(event, "result", "") or ""
                if result_text:
                    full_response += result_text

        logger.info(f'[KanbanPipeline] Step 7: planning agent response length: {len(full_response)}')

        # Salva resposta para diagnóstico
        log_path = f'/tmp/kanban_agent_response_{task_id[:8]}.txt'
        with open(log_path, 'w') as f:
            f.write(full_response)
        logger.info(f'[KanbanPipeline] Response saved to {log_path}')

        # Log dos primeiros 500 chars e dos últimos 500 chars
        logger.info(f'[KanbanPipeline] Response start: {repr(full_response[:500])}')
        logger.info(f'[KanbanPipeline] Response end: {repr(full_response[-500:])}')
        logger.info(f'[KanbanPipeline] Has <plan>: {"<plan>" in full_response}')
        logger.info(f'[KanbanPipeline] Has </plan>: {"</plan>" in full_response}')

        # Extrai o plano da resposta
        logger.info('[KanbanPipeline] Step 8: extracting plan from response...')
        plan_data = extract_plan_from_text(full_response, fallback_name=title)
        if not plan_data:
            raise ValueError("Planning agent did not produce a valid <plan> block")

        # Normaliza schema das tasks
        plan_data = normalize_plan_tasks(plan_data, planning_context=planning_context)
        logger.info(f'[KanbanPipeline] Tasks after normalization: {[(t["id"], t["name"][:30]) for t in plan_data["tasks"]]}')

        logger.info(
            f"[KanbanPipeline] Step 9: plan extracted: {plan_data['name']} "
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

        # Cria o workflow
        logger.info(f'[KanbanPipeline] Step 10: creating workflow from plan (status={plan_data["status"]})...')
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
            logger.info(f'[KanbanPipeline] Step 13: moving task {task_id} to in_progress (workflow already pending)...')
            patch_result = await client._put(f'/kanban/{project_id}/{task_id}', {
                'column': 'in_progress',
                'pipeline_status': 'running',
            })
            if patch_result is None:
                logger.error(f'[KanbanPipeline] PUT returned None — check HTTP method and URL')
            else:
                logger.info(f'[KanbanPipeline] PUT result: {patch_result}')
            logger.success(
                f"[KanbanPipeline] Workflow pending, task moved to in_progress: {plan_id}"
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
    o status das tasks correspondentes, considerando result_status da review.

    Args:
        client: DaemonClient instance
    """
    try:
        projects = await client.get_all_projects()
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue

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

                    logger.debug(f'[KanbanPipeline] Plan {workflow_id}: status={plan_status}, result_status={result_status}')

                    if plan_status == "success":
                        if result_status == "needs_rework":
                            # Volta para backlog e cria nova task de rework
                            await _handle_needs_rework(task, plan, project_id, client)
                        else:
                            # success ou partial → move para done
                            result_label = ' (partial)' if result_status == 'partial' else ''
                            notes = plan.get('result_notes', '')
                            patch_resp = await client._put(f'/kanban/{project_id}/{task_id}', {
                                'column': 'done',
                                'pipeline_status': 'done',
                                'result_status': result_status or 'success',
                                'result_notes': notes,
                            })
                            logger.info(f'[KanbanPipeline] Moved to done: {task_id}, patch={patch_resp}')

                    elif plan_status == "failed" and task.get("pipeline_status") != "failed":
                        await client.update_kanban_pipeline(
                            project_id, task_id,
                            pipeline_status="failed",
                            error_message="Workflow failed"
                        )

                    elif plan_status in ("pending", "running") and task.get("pipeline_status") in ("awaiting_approval",):
                        # Usuário aprovou manualmente no dashboard — move coluna e atualiza status
                        # Bug 3 fix: Só move se ainda não estiver em in_progress para evitar loop
                        if task.get('column') != 'in_progress':
                            patch_resp = await client._put(f'/kanban/{project_id}/{task_id}', {
                                "column": "in_progress",
                                "pipeline_status": "running"
                            })
                            logger.info(f"[KanbanPipeline] Task approved and moved to in_progress: {task_id}, patch={patch_resp}")
                        else:
                            # Coluna já é in_progress mas pipeline_status ainda está errado — corrige só o status
                            patch_resp = await client._put(f'/kanban/{project_id}/{task_id}', {
                                "pipeline_status": "running"
                            })
                            logger.debug(f"[KanbanPipeline] Fixed stale pipeline_status for {task_id}, patch={patch_resp}")

                except Exception as e:
                    logger.warning(f"Failed to sync workflow {workflow_id}: {e}")
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Sync error: {e}")


async def _handle_needs_rework(task: dict, plan: dict, project_id: str, client) -> None:
    """Retorna task para backlog e cria nova task de rework com contexto."""
    task_id = task['id']
    result_notes = plan.get('result_notes', '')
    plan_name = plan.get('name', 'Unknown')

    # Volta a task atual para backlog com anotação
    response = await client._put(f'/kanban/{project_id}/{task_id}', {
        'column': 'backlog',
        'pipeline_status': 'idle',
        'workflow_id': None,
        'result_status': 'needs_rework',
        'result_notes': result_notes,
        'error_message': '',
    })

    if response:
        logger.info(f'[KanbanPipeline] Task returned to backlog for rework: {task_id} (column={response.get("column")}, pipeline_status={response.get("pipeline_status")})')
    else:
        logger.error(f'[KanbanPipeline] Failed to return task to backlog: {task_id}')

    # Cria nova task de rework no backlog
    rework_title = f'[Rework] {task.get("title", "Task")}'
    rework_description = (
        f'The previous workflow "{plan_name}" completed with needs_rework status.\n\n'
        f'**Reviewer notes:**\n{result_notes}\n\n'
        f'**Original task description:**\n{task.get("description", "")}'
    )

    try:
        await client._post(f'/kanban/{project_id}', {
            'title': rework_title,
            'description': rework_description,
            'column': 'backlog',
            'priority': max(1, task.get('priority', 3) - 1),  # aumenta prioridade
        })
        logger.info(f'[KanbanPipeline] Rework task created for {task_id}')
    except Exception as e:
        logger.warning(f'Failed to create rework task: {e}')

    logger.warning(f'[KanbanPipeline] Task needs rework, moved to backlog: {task_id}')


async def auto_move_tasks(project_id: str, settings: dict, client) -> None:
    """
    Move tasks automaticamente entre colunas quando habilitado.

    Args:
        project_id: ID do projeto
        settings: Configurações do projeto (deve conter auto_move_enabled)
        client: DaemonClient instance
    """
    if not settings.get('auto_move_enabled', False):
        return

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

        # Verifica se há tasks em planning
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

        # Check in_progress limit
        in_progress = [t for t in tasks if t.get('column') == 'in_progress']
        effective_in_progress_limit = max_in_progress_tasks if max_in_progress_tasks > 0 else float('inf')

        if len(in_progress) < effective_in_progress_limit:
            # Move planning task with workflow_id to in_progress
            planning_with_workflow = sorted(
                [t for t in tasks if t.get('column') == 'planning' and t.get('workflow_id')],
                key=lambda t: (t.get('priority', 99), t.get('created_at', ''))
            )
            if planning_with_workflow:
                next_task = planning_with_workflow[0]
                await client._put(f'/kanban/{project_id}/{next_task["id"]}', {
                    'column': 'in_progress',
                })
                logger.info(f'[AutoMove] Moved "{next_task["title"]}" planning → in_progress')
    except Exception as e:
        logger.warning(f'[AutoMove] Error: {e}')


async def poll_kanban_tasks(client) -> None:
    """
    Verifica todos os projetos por kanban tasks ativas sem workflow.

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

            pending = await client.get_pending_kanban_tasks(project_id)
            for task in pending:
                # Processa em background sem bloquear o daemon loop
                asyncio.create_task(_run_kanban_task(task, client))

        # Sincroniza status de workflows ativos
        await sync_workflow_status(client)
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Poll error: {e}")


# Rastreia tasks em processamento para evitar duplicatas
_running_kanban_tasks: set = set()


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
