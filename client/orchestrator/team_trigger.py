"""
Team Trigger — dispara times específicos conforme a fase do Kanban.

Este módulo implementa o motor de transição de fases:
  - Planning  → Plan Team (planner): analisa e gera plano
  - In Dev    → Dev Team (coder): executa o plano (Backend Dev → Frontend Dev → Tester)
  - Validation → Staging Team (reviewer): build, QA, PR review

Cada time é acionado criando um plano (Plan) no backend com tasks alinhadas ao role.
O daemon (main.py) detecta planos pendentes e os executa automaticamente.
"""

from __future__ import annotations

import json
from typing import Any

from orchestrator import logger


# ── Role → Phase mapping ────────────────────────────────────────────────

ROLE_PHASE_MAP: dict[str, str] = {
    'planner': 'planning',
    'coder': 'in_dev',
    'reviewer': 'validation',
}

PHASE_ROLE_MAP: dict[str, str] = {
    'planning': 'planner',
    'in_dev': 'coder',
    'validation': 'reviewer',
}

PHASE_LABEL_MAP: dict[str, str] = {
    'planning': 'Planejamento',
    'in_dev': 'Em Desenvolvimento',
    'validation': 'Em Validação',
}


async def find_team_workspace(
    project_id: str,
    role: str,
    client: Any,
) -> str | None:
    """
    Encontra o workspace do time com o role especificado para o projeto.

    Uses the agents-context endpoint to find workspace by role.

    Args:
        project_id: ID do projeto
        role: Role do time (planner, coder, reviewer, tester, devops, generic)
        client: DaemonClient instance

    Returns:
        Caminho do workspace do time ou None se não encontrado
    """
    try:
        response = await client._get(f"/projects/{project_id}/agents-context")

        # Unwrap envelope
        if isinstance(response, dict):
            agents = response.get('data') or []
        elif isinstance(response, list):
            agents = response
        else:
            agents = []

        if not agents:
            logger.warning(f'[TeamTrigger] No agents found for project {project_id}')
            return None

        # Find agent with matching role
        for agent in agents:
            if agent.get('role') == role:
                workspace = agent.get('workspace_path')
                logger.info(f'[TeamTrigger] Found {role} workspace: {workspace}')
                return workspace

        available_roles = [a.get('role') for a in agents]
        logger.warning(
            f'[TeamTrigger] No {role} agent found for project {project_id}. '
            f'Available roles: {available_roles}'
        )
        return None

    except Exception as e:
        logger.warning(f'[TeamTrigger] Error finding {role} workspace: {type(e).__name__}: {e}')
        return None


async def find_project_settings(
    project_id: str,
    client: Any,
) -> dict:
    """
    Busca as configurações do projeto (gates, limits, etc.).

    Args:
        project_id: ID do projeto
        client: DaemonClient instance

    Returns:
        Dict com as configurações do projeto
    """
    try:
        projects = await client.get_all_projects()
        for project in projects:
            if project.get('id') == project_id:
                settings = project.get('settings', {})
                if isinstance(settings, str):
                    try:
                        settings = json.loads(settings)
                    except Exception:
                        settings = {}
                return settings
        return {}
    except Exception as e:
        logger.warning(f'[TeamTrigger] Error fetching project settings: {e}')
        return {}


async def trigger_plan_team(
    task: dict,
    client: Any,
) -> None:
    """
    Phase: PLANNING — Aciona o Plan Team.

    O Plan Team (role=planner) já é acionado pelo process_kanban_task()
    em kanban_pipeline.py. Esta função serve como ponto de extensão caso
    seja necessário adicionar lógica extra antes da execução do planner.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    logger.info(f'[TeamTrigger][Plan Team] Task {task["id"]} already in planning pipeline')
    # The actual planning is handled by process_kanban_task() in kanban_pipeline.py
    # This function exists as a named hook for the team-triggering architecture


async def trigger_dev_team(
    task: dict,
    plan_data: dict,
    client: Any,
) -> str | None:
    """
    Phase: IN_DEV — Aciona o Dev Team para executar o plano.

    Verifica se a tarefa tem um plano gerado. Se tiver, cria um plano de execução
    com tasks do Dev Team (Backend Dev → Frontend Dev → Tester).

    O plano é criado com status='pending' para que o daemon o execute.
    Cada task recebe o workspace do Dev Team.

    Args:
        task: Kanban task data (deve ter project_id, id, title, description)
        plan_data: Plano gerado pelo Plan Team (com tasks normalizadas)
        client: DaemonClient instance

    Returns:
        ID do plano criado, ou None se falhou
    """
    task_id = task['id']
    project_id = task['project_id']
    title = task.get('title', 'Untitled')

    logger.info(f'[TeamTrigger][Dev Team] Starting for task {task_id}: "{title}"')

    # 1. Encontra o workspace do Dev Team
    dev_workspace = await find_team_workspace(project_id, 'coder', client)
    if not dev_workspace:
        logger.error(f'[TeamTrigger][Dev Team] No coder workspace found for project {project_id}')
        return None

    # 2. Verifica se o plano tem tasks
    plan_tasks = plan_data.get('tasks', [])
    if not plan_tasks:
        logger.warning(f'[TeamTrigger][Dev Team] Plan has no tasks for task {task_id}')
        return None

    # 3. Garante que cada task tem o workspace do dev team
    for t in plan_tasks:
        if not t.get('workspace'):
            t['workspace'] = dev_workspace
        # Garante permissões de escrita
        if not t.get('tools'):
            t['tools'] = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
        if not t.get('permission_mode'):
            t['permission_mode'] = 'acceptEdits'

    # 4. Cria o plano de execução no backend
    execution_plan = {
        'name': f'[Dev] {title}',
        'tasks': plan_tasks,
        'project_id': project_id,
        'status': 'pending',  # Daemon vai executar automaticamente
        'type': 'workflow',
        'team_id': dev_workspace,  # Persist team workspace for plan-to-chat conversion
    }

    created = await client.create_plan_from_data(execution_plan)
    plan_id = created.get('id') if created else None

    if plan_id:
        logger.success(
            f'[TeamTrigger][Dev Team] Execution plan created: {plan_id} '
            f'({len(plan_tasks)} tasks, workspace: {dev_workspace})'
        )
    else:
        logger.error(f'[TeamTrigger][Dev Team] Failed to create execution plan for task {task_id}')

    return plan_id


async def trigger_staging_team(
    task: dict,
    dev_plan: dict,
    client: Any,
) -> str | None:
    """
    Phase: VALIDATION — Aciona o Staging Team.

    O Staging Team executa:
    1. Build Validator — roda o build e verifica erros
    2. Code Reviewer / QA — revisa o diff e qualidade do código

    Cria um plano com tasks do Staging Team (reviewer role).

    Args:
        task: Kanban task data
        dev_plan: Plano executado pelo Dev Team (para obter contexto)
        client: DaemonClient instance

    Returns:
        ID do plano criado, ou None se falhou
    """
    task_id = task['id']
    project_id = task['project_id']
    title = task.get('title', 'Untitled')
    dev_plan_id = task.get('workflow_id', '')

    logger.info(f'[TeamTrigger][Staging Team] Starting for task {task_id}: "{title}"')

    # 1. Encontra o workspace do Staging Team
    staging_workspace = await find_team_workspace(project_id, 'reviewer', client)
    if not staging_workspace:
        logger.error(f'[TeamTrigger][Staging Team] No reviewer workspace found for project {project_id}')
        return None

    # 2. Encontra o environment staging para obter o project_path
    planning_context = await client.get_project_planning_context(project_id)
    staging_cwd = ''
    envs = planning_context.get('environments', [])
    for env in envs:
        if env.get('name') == 'staging':
            staging_cwd = env.get('project_path', '')
            break

    # Fallback para o primeiro env se não encontrar staging
    if not staging_cwd and envs:
        staging_cwd = envs[0].get('project_path', '')

    if not staging_cwd:
        logger.warning(f'[TeamTrigger][Staging Team] No staging environment found, using dev workspace as cwd')
        staging_cwd = staging_workspace

    # 3. Monta as tasks do Staging Team
    task_description = task.get('description', '')

    staging_tasks = [
        {
            'id': 'build-validator',
            'name': 'Build Validator',
            'prompt': (
                f'## Tarefa: Validar Build\n\n'
                f'**Tarefa original:** {title}\n'
                f'**Descrição:** {task_description}\n\n'
                f'Execute a validação completa do build do projeto:\n'
                f'1. Rode o build de produção (npm run build, npx vite build, ou equivalente)\n'
                f'2. Rode o linter configurado (npm run lint, eslint, etc.)\n'
                f'3. Rode os testes se existirem (npm test, pytest, etc.)\n'
                f'4. Registre os resultados\n\n'
                f'Se QUALQUER verificação falhar, documente detalhadamente:\n'
                f'- Arquivo e linha do erro\n'
                f'- Causa raiz\n'
                f'- Sugestão de correção\n\n'
                f'Emita o resultado no formato <review> com o verdict.'
            ),
            'cwd': staging_cwd,
            'workspace': staging_workspace,
            'tools': ['Read', 'Glob', 'Grep', 'Bash'],
            'permission_mode': 'acceptEdits',
            'depends_on': [],
        },
        {
            'id': 'code-reviewer',
            'name': 'Code Reviewer / QA',
            'prompt': (
                f'## Tarefa: Revisão de Código e QA\n\n'
                f'**Tarefa original:** {title}\n'
                f'**Descrição:** {task_description}\n\n'
                f'Realize a revisão completa do código modificado:\n'
                f'1. Execute `git diff` para ver todas as mudanças\n'
                f'2. Verifique consistência com os padrões do projeto\n'
                f'3. Confirme que testes passam\n'
                f'4. Valide mensagens de commit\n'
                f'5. Emita veredito final\n\n'
                f'Emita o resultado no formato <review> com:\n'
                f'- result_status: "success" | "partial" | "needs_rework"\n'
                f'- result_notes: Resumo da avaliação\n'
                f'- issues: Lista de problemas encontrados\n'
            ),
            'cwd': staging_cwd,
            'workspace': staging_workspace,
            'tools': ['Read', 'Glob', 'Grep', 'Bash'],
            'permission_mode': 'acceptEdits',
            'depends_on': ['build-validator'],
        },
    ]

    # 4. Cria o plano de staging
    staging_plan = {
        'name': f'[Staging] {title}',
        'tasks': staging_tasks,
        'project_id': project_id,
        'status': 'pending',
        'type': 'workflow',
        'team_id': staging_workspace,  # Persist team workspace for plan-to-chat conversion
    }

    created = await client.create_plan_from_data(staging_plan)
    plan_id = created.get('id') if created else None

    if plan_id:
        logger.success(
            f'[TeamTrigger][Staging Team] Staging plan created: {plan_id} '
            f'(workspace: {staging_workspace})'
        )
    else:
        logger.error(f'[TeamTrigger][Staging Team] Failed to create staging plan for task {task_id}')

    return plan_id


async def handle_team_completion(
    task: dict,
    plan: dict,
    project_settings: dict,
    project_id: str,
    client: Any,
) -> None:
    """
    Processa a conclusão de um time e decide a transição.

    Regras:
    - Sucesso + Gate ativo → avança para próxima fase
    - Sucesso + Gate desativado → permanece na fase atual (aguarda ação manual)
    - Falha → move para a fase anterior e injeta o erro

    Args:
        task: Kanban task data
        plan: Plano concluído (com status e result_status)
        project_settings: Configurações do projeto (gates, limits)
        project_id: ID do projeto
        client: DaemonClient instance
    """
    task_id = task['id']
    current_column = task.get('column', '')
    plan_status = plan.get('status', '')
    result_status = plan.get('result_status')
    result_notes = plan.get('result_notes', '')

    logger.info(
        f'[TeamTrigger] Handling completion for task {task_id}: '
        f'column={current_column}, plan_status={plan_status}, result_status={result_status}'
    )

    # Mapa de colunas e transições
    COLUMN_FLOW = ['backlog', 'planning', 'in_dev', 'validation', 'done']

    if current_column not in COLUMN_FLOW:
        logger.warning(f'[TeamTrigger] Unknown column {current_column} for task {task_id}')
        return

    current_index = COLUMN_FLOW.index(current_column)

    # Se o plano falhou, move para a fase anterior
    if plan_status == 'failed':
        if result_status == 'needs_rework':
            # Volta para backlog e cria task de rework
            await _handle_needs_rework(task, plan, project_id, client)
            return

        # Falha genérica — move para fase anterior
        if current_index > 0:
            prev_column = COLUMN_FLOW[current_index - 1]
            error_msg = result_notes or f'Workflow failed at {current_column} phase'

            await client._put(f'/kanban/{project_id}/{task_id}', {
                'column': prev_column,
                'pipeline_status': 'failed',
                'error_message': error_msg[:500],
                'result_notes': error_msg,
            })
            logger.warning(
                f'[TeamTrigger] Task {task_id} moved back: {current_column} → {prev_column} '
                f'(workflow failed: {error_msg[:100]})'
            )
        else:
            # Já está no backlog — apenas marca como falha
            await client.update_kanban_pipeline(
                project_id, task_id,
                pipeline_status='failed',
                error_message=result_notes or 'Workflow failed',
            )
        return

    # Plano concluído com sucesso
    if plan_status == 'success':
        if result_status == 'needs_rework':
            await _handle_needs_rework(task, plan, project_id, client)
            return

        # Determina qual gate verificar baseado na coluna atual
        gate_map = {
            'planning': 'auto_advance_plan_to_dev',
            'in_dev': 'auto_advance_dev_to_staging',
            'validation': 'auto_advance_staging_to_done',
        }

        gate_key = gate_map.get(current_column)
        if not gate_key:
            logger.warning(f'[TeamTrigger] No gate defined for column {current_column}')
            return

        gate_enabled = project_settings.get(gate_key, True)

        if gate_enabled:
            # Avança para a próxima fase
            if current_index + 1 < len(COLUMN_FLOW):
                next_column = COLUMN_FLOW[current_index + 1]

                # Determina pipeline_status baseado na fase destino
                if next_column == 'done':
                    new_pipeline = 'done'
                elif next_column == 'validation':
                    new_pipeline = 'idle'
                elif next_column == 'in_dev':
                    new_pipeline = 'running'
                else:
                    new_pipeline = 'idle'

                await client._put(f'/kanban/{project_id}/{task_id}', {
                    'column': next_column,
                    'pipeline_status': new_pipeline,
                    'result_status': result_status or 'success',
                    'result_notes': result_notes,
                    'error_message': '',
                })
                logger.success(
                    f'[TeamTrigger] Gate OPEN: task {task_id} advanced '
                    f'{current_column} → {next_column} (gate: {gate_key})'
                )
            else:
                logger.info(f'[TeamTrigger] Task {task_id} is already at the last column')
        else:
            # Gate desativado — permanece na fase atual
            phase_label = PHASE_LABEL_MAP.get(current_column, current_column)
            logger.info(
                f'[TeamTrigger] Gate CLOSED ({gate_key}): task {task_id} stays at '
                f'{phase_label} — awaiting manual action'
            )
            # Atualiza apenas o result_status e limpa error
            await client._put(f'/kanban/{project_id}/{task_id}', {
                'pipeline_status': 'idle',
                'result_status': result_status or 'success',
                'result_notes': result_notes,
                'error_message': '',
            })


async def _handle_needs_rework(task: dict, plan: dict, project_id: str, client: Any) -> None:
    """
    Retorna task para backlog e cria nova task de rework com contexto.

    Args:
        task: Kanban task data
        plan: Plan data with result_notes
        project_id: ID do projeto
        client: DaemonClient instance
    """
    task_id = task['id']
    result_notes = plan.get('result_notes', '')
    plan_name = plan.get('name', 'Unknown')

    # Volta a task atual para backlog com anotação
    await client._put(f'/kanban/{project_id}/{task_id}', {
        'column': 'backlog',
        'pipeline_status': 'idle',
        'workflow_id': None,
        'result_status': 'needs_rework',
        'result_notes': result_notes,
        'error_message': '',
    })

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
            'priority': max(1, task.get('priority', 3) - 1),
        })
        logger.info(f'[TeamTrigger] Rework task created for {task_id}')
    except Exception as e:
        logger.warning(f'[TeamTrigger] Failed to create rework task: {e}')

    logger.warning(f'[TeamTrigger] Task needs rework, moved to backlog: {task_id}')
