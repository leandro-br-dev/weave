#!/usr/bin/env python3
"""
agent-orchestrator — CLI entry point

Usage:
    python main.py plans/my-plan.json
    python main.py plans/my-plan.json --dry-run
    python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
"""

import argparse
import asyncio
import inspect
import json
import os
import signal
import socket
import sys
import time

import anyio

from orchestrator import logger
from orchestrator.plan import load_plan, Plan, Task
from orchestrator.runner import run_plan


# Persistência de planos em andamento para recuperação após restart
PENDING_PLANS_FILE = '/tmp/weave-pending-plans.json'

# Timeout para execução de planos (padrão: 2 horas)
PLAN_TIMEOUT_SECONDS = int(os.environ.get('PLAN_TIMEOUT_SECONDS', '7200'))  # 2 horas


def save_pending_plans(running_plans: set, running_plans_started: dict) -> None:
    """
    Persiste planos em andamento para recuperação após restart.

    Args:
        running_plans: Set of plan IDs currently running
        running_plans_started: Dict mapping plan IDs to start timestamps
    """
    try:
        data = {
            'plans': [
                {'id': pid, 'started_at': running_plans_started.get(pid, 0)}
                for pid in running_plans
            ],
            'saved_at': time.time()
        }
        with open(PENDING_PLANS_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        logger.warning(f'Failed to save pending plans: {e}')


def load_pending_plans() -> list:
    """
    Carrega planos que estavam em andamento antes do último restart.

    Returns:
        List of plan IDs that were running, or empty list if none/too old
    """
    try:
        if os.path.exists(PENDING_PLANS_FILE):
            with open(PENDING_PLANS_FILE) as f:
                data = json.load(f)
            # Ignora se o arquivo tem mais de 2 horas
            if time.time() - data.get('saved_at', 0) < 7200:
                return [p['id'] for p in data.get('plans', [])]
    except Exception:
        pass
    return []


def clear_pending_plans() -> None:
    """Remove o arquivo de persistência de planos pendentes."""
    try:
        if os.path.exists(PENDING_PLANS_FILE):
            os.remove(PENDING_PLANS_FILE)
    except Exception:
        pass


# Counter for periodic completion check (every 60 seconds)
class CompletionCheckCounter:
    value = 0

check_completion_counter = CompletionCheckCounter()


async def check_running_plans_completion(client) -> None:
    """
    Check for running plans that have completed but weren't marked properly.

    This handles recovery scenarios where the daemon crashed or lost communication
    after a plan finished, leaving it in 'running' state when all tasks are done.

    Args:
        client: DaemonClient instance
    """
    try:
        # Get all plans currently in 'running' status
        # _get() returns dict | list | None (not PlanResponse)
        response = await client._get('/plans?status=running')
        if response is None:
            logger.warning('Failed to fetch running plans for completion check: request returned None')
            return

        running_plans = response if isinstance(response, list) else []
        if not running_plans:
            return

        logger.debug(f'[CompletionCheck] Found {len(running_plans)} running plans to check')

        recovered_count = 0
        for plan in running_plans:
            plan_id = plan.get('id')
            if not plan_id:
                continue

            try:
                # Call the check-completion endpoint for this plan
                # _post() returns dict | list | None (not PlanResponse)
                check_response = await client._post(f'/plans/{plan_id}/check-completion', {})

                if check_response is None:
                    logger.debug(f'[CompletionCheck] Plan {plan_id[:8]}: check-completion request returned None')
                    continue

                # Parse response - _post() already extracts data from envelope
                result = check_response if isinstance(check_response, dict) else {}
                auto_completed = result.get('auto_completed', False)

                if auto_completed:
                    recovered_count += 1
                    plan_name = plan.get('name', 'unknown')
                    logger.success(
                        f'[CompletionCheck] Recovered completed plan: {plan_name} '
                        f'({plan_id[:8]}) - all tasks done, marked as success'
                    )
                else:
                    # Log details about why it wasn't auto-completed
                    total_tasks = result.get('total_tasks', 0)
                    completed_tasks = result.get('completed_tasks', 0)
                    logger.debug(
                        f'[CompletionCheck] Plan {plan_id[:8]}: '
                        f'{completed_tasks}/{total_tasks} tasks completed'
                    )

            except Exception as e:
                logger.debug(f'[CompletionCheck] Error checking plan {plan_id[:8]}: {e}')

        if recovered_count > 0:
            logger.info(f'[CompletionCheck] Recovered {recovered_count} completed plan(s)')

    except Exception as e:
        logger.error(f'[CompletionCheck] Unexpected error: {e}')


async def process_needs_recovery_list(client) -> None:
    """
    Process plans that failed to complete after retries and are in the recovery list.

    This function is called periodically by the daemon to retry completion for plans
    that were added to the needs_recovery list by complete_plan_with_retry.

    Args:
        client: DaemonClient instance
    """
    import json
    from pathlib import Path

    recovery_file = Path('/tmp/weave-needs-recovery.json')

    try:
        # Load recovery list
        if not recovery_file.exists():
            return

        with open(recovery_file, 'r') as f:
            recovery_list = json.load(f)

        if not recovery_list:
            return

        logger.info(f'[Recovery] Processing {len(recovery_list)} plans in recovery list')

        recovered_plans = []
        failed_plans = []

        for entry in recovery_list:
            plan_id = entry.get('plan_id')
            intended_status = entry.get('intended_status')
            result_message = entry.get('result_message')
            attempts = entry.get('attempts', 1)

            if not plan_id or not intended_status:
                continue

            try:
                # Verify current status first
                plan_response = await client._get(f'/plans/{plan_id}')

                if plan_response and isinstance(plan_response, dict):
                    current_status = plan_response.get('status')

                    # If already in the intended status, consider it recovered
                    if current_status == intended_status:
                        logger.success(
                            f'[Recovery] Plan {plan_id[:8]} already has intended status '
                            f'{intended_status} - removing from recovery list'
                        )
                        recovered_plans.append(plan_id)
                        continue

                    # If not in running status, can't recover
                    if current_status != 'running':
                        logger.warning(
                            f'[Recovery] Plan {plan_id[:8]} is {current_status}, '
                            f'cannot be recovered to {intended_status}'
                        )
                        failed_plans.append(plan_id)
                        continue

                # Try to complete again with fewer retries
                logger.info(
                    f'[Recovery] Retrying completion for plan {plan_id[:8]} '
                    f'(attempt #{attempts + 1}, target status: {intended_status})'
                )

                response = await client.complete_plan_with_retry(
                    plan_id,
                    intended_status,
                    result_message,
                    max_retries=3,  # Fewer retries for recovery
                    verify_completion=True
                )

                if response and not response.error:
                    logger.success(
                        f'[Recovery] Successfully recovered plan {plan_id[:8]} → {intended_status}'
                    )
                    recovered_plans.append(plan_id)
                else:
                    # Increment attempts
                    entry['attempts'] = attempts + 1
                    entry['last_attempt'] = time.time()

                    # Max 5 recovery attempts
                    if entry['attempts'] >= 5:
                        logger.error(
                            f'[Recovery] Plan {plan_id[:8]} failed after {entry["attempts"]} '
                            f'recovery attempts - giving up'
                        )
                        failed_plans.append(plan_id)
                    else:
                        logger.warning(
                            f'[Recovery] Plan {plan_id[:8]} recovery failed, '
                            f'will retry later (attempt {entry["attempts"]}/5)'
                        )

            except Exception as e:
                logger.error(f'[Recovery] Error processing plan {plan_id[:8]}: {e}')
                entry['attempts'] = attempts + 1
                entry['last_attempt'] = time.time()

        # Update recovery list - remove recovered and failed plans
        if recovered_plans or failed_plans:
            updated_list = [
                entry for entry in recovery_list
                if entry.get('plan_id') not in recovered_plans + failed_plans
            ]

            with open(recovery_file, 'w') as f:
                json.dump(updated_list, f, indent=2)

            logger.info(
                f'[Recovery] Removed {len(recovered_plans)} recovered, '
                f'{len(failed_plans)} failed plans from recovery list'
            )

    except Exception as e:
        logger.error(f'[Recovery] Failed to process recovery list: {e}')


# Log SDK fields on import for debugging
try:
    from claude_agent_sdk import ClaudeAgentOptions
    sdk_fields = list(inspect.signature(ClaudeAgentOptions.__init__).parameters.keys())
    logger.debug(f'SDK ClaudeAgentOptions fields: {sdk_fields}')
except Exception:
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Agent Orchestrator — run multi-agent plans via Claude Agent SDK"
    )
    parser.add_argument(
        "plan",
        nargs="?",
        help="Path to the plan JSON file (required unless --daemon is used)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and show the execution plan without running agents",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run in daemon mode: poll API for plans and execute them",
    )
    parser.add_argument(
        "--server",
        help="API server URL (default: from WEAVE_URL env var or http://localhost:3001)",
    )
    parser.add_argument(
        "--token",
        help="Bearer token for authentication (default: from WEAVE_TOKEN env var)",
    )
    return parser.parse_args()


async def reconcile_running_plans(client, running_plans: set) -> None:
    """
    No startup:
    1. Carrega planos que estavam rodando antes do restart
    2. Chama /api/plans/reconcile passando apenas os que confirmamos em andamento
    3. A API marca os órfãos como failed (com exceção de planos recém-criados)

    Args:
        client: DaemonClient instance
        running_plans: Set of currently running plan IDs (should be empty on startup)
    """
    # Planos do arquivo de persistência (podem estar em running no banco)
    previous_plans = load_pending_plans()

    if previous_plans:
        logger.warning(f'[Daemon] Found {len(previous_plans)} plans from previous run: {[p[:8] for p in previous_plans]}')
        logger.warning(f'[Daemon] These will be marked as failed (daemon restarted mid-execution)')

    # Envia reconcile: active_plan_ids = vazio (nenhum está realmente rodando no startup)
    # Include a grace_period_seconds parameter to avoid marking recently-started plans as orphaned
    try:
        result = await client._post('/plans/reconcile', {
            'active_plan_ids': list(running_plans),
            'grace_period_seconds': 120  # Don't mark plans started within last 2 minutes as orphaned
        })
        if result:
            orphaned = result.get('data', {}).get('orphaned_count', 0) if isinstance(result, dict) else 0
            skipped = result.get('data', {}).get('skipped_count', 0) if isinstance(result, dict) else 0
            if orphaned > 0:
                logger.warning(f'[Daemon] Reconciled {orphaned} orphaned running plans → failed')
            if skipped > 0:
                logger.info(f'[Daemon] Skipped {skipped} recently-started plans (within grace period)')
    except Exception as e:
        logger.warning(f'[Daemon] reconcile error: {e}')

    # Limpa arquivo de persistência
    clear_pending_plans()


def dry_run(plan_path: str) -> None:
    plan = load_plan(plan_path)
    logger.header(f"Dry run: {plan.name}")
    waves = plan.execution_order()
    for i, wave in enumerate(waves):
        print(f"  Wave {i + 1}:")
        for task in wave:
            deps = f"  (depends on: {', '.join(task.depends_on)})" if task.depends_on else ""
            print(f"    [{task.id}] {task.name}{deps}")
            print(f"         cwd: {task.cwd}")
            print(f"         tools: {task.tools}")


async def on_plan_completed(plan: dict, client, success: bool) -> None:
    """
    Callback chamado quando um plano finaliza — atualiza kanban task vinculada.

    Args:
        plan: Plan data dict with id, project_id, etc.
        client: DaemonClient instance
        success: Whether the plan completed successfully
    """
    try:
        plan_id = plan.get('id')
        project_id = plan.get('project_id')
        if not project_id:
            return

        # Busca a kanban task com esse workflow_id
        raw_tasks = await client._get(f'/kanban/{project_id}')
        handled = client._handle_response(raw_tasks)
        tasks = handled.data if not handled.error else []

        linked = next((t for t in tasks if t.get('workflow_id') == plan_id), None)
        if not linked:
            return

        task_id = linked['id']

        if success:
            # Move para done e marca pipeline como done
            await client._patch(f'/kanban/{project_id}/{task_id}', {
                'column': 'done',
                'pipeline_status': 'done'
            })
            logger.success(f'[KanbanPipeline] Task {task_id} moved to done')
        else:
            # Marca pipeline como failed mas mantém na coluna
            await client.update_kanban_pipeline(
                project_id, task_id,
                pipeline_status='failed',
                error_message='Workflow completed with failures'
            )
    except Exception as e:
        logger.warning(f'Failed to update kanban after plan completion: {e}')


async def _run_plan(plan_data: dict, client: object, running_plans: set[str], running_plans_started: dict[str, float]) -> None:
    """
    Execute a single plan asynchronously and handle completion.

    Args:
        plan_data: Plan data from API with id, name, tasks, project_id
        client: DaemonClient instance
        running_plans: Set to track running plans (for cleanup)
        running_plans_started: Dict tracking when each plan was started
    """
    plan_id = plan_data.get("id")
    plan_name = plan_data.get("name")
    tasks_json = plan_data.get("tasks", "[]")

    # Log do plan_id para debug
    logger.info(f"Received plan: {plan_name} (ID: {plan_id})")

    try:
        # Parse tasks from JSON string
        import json
        try:
            tasks_data = json.loads(tasks_json) if isinstance(tasks_json, str) else tasks_json
        except json.JSONDecodeError:
            logger.error(f"Failed to parse tasks JSON for plan {plan_id}: {tasks_json}")
            return

        logger.info(f"Processing plan: {plan_name} (ID: {plan_id})")

        # Notify API that we're starting the plan
        logger.info(f"Starting plan: {plan_id}")
        start_response = client.start_plan(plan_id)
        if start_response.error:
            logger.error(f"Failed to start plan {plan_id}: {start_response.error}")
            return

        # Convert API plan format to internal Plan format
        from orchestrator.plan import Task, Plan
        tasks = [
            Task(
                id=t["id"],
                name=t["name"],
                prompt=t["prompt"],
                cwd=t.get("cwd", "."),
                tools=t.get("tools", ["Read", "Write", "Edit", "Bash", "Glob"]),
                permission_mode=t.get("permission_mode", "acceptEdits"),
                depends_on=t.get("depends_on", []),
                max_turns=t.get("max_turns"),
                system_prompt=t.get("system_prompt"),
                env=t.get("env", {}),
                agent_file=t.get("agent_file"),
                workspace=t.get("workspace") or t.get("workspace_path"),
            )
            for t in tasks_data
        ]
        plan = Plan(id=plan_id, name=plan_name, tasks=tasks)

        # Execute the plan with log collection
        try:
            success, error_msg, review = await asyncio.wait_for(
                run_plan_with_logging(client, plan_id, plan),
                timeout=PLAN_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            success = False
            error_msg = f'Plan timed out after {PLAN_TIMEOUT_SECONDS}s'
            logger.error(f'Plan {plan_id} timed out')
            review = None

        # Notify API of completion
        status = "success" if success else "failed"
        result = f"Plan {plan_name} completed successfully" if success else f"Plan {plan_name} failed: {error_msg or 'Unknown error'}"

        # Extract review data if available
        result_status = None
        result_notes = None
        structured_output = None

        if review:
            result_status = review.get('result_status')
            result_notes = review.get('result_notes')
            structured_output = review
            logger.info(f"Plan {plan_id} completed with review: result_status={result_status}")

        # Log antes de completar para debug
        logger.info(f"Completing plan: {plan_id} with status: {status}")
        logger.info(f"Plan execution duration: {time.time() - running_plans_started.get(plan_id, 0):.1f}s")

        complete_response = await client.complete_plan_with_retry(
            plan_id,
            status,
            result,
            result_status=result_status,
            result_notes=result_notes,
            structured_output=structured_output,
        )

        if complete_response and complete_response.error:
            logger.error(f"Failed to complete plan {plan_id}: {complete_response.error}")
            logger.error(f"Plan {plan_id} may be marked as 'failed' in database despite successful execution")
        elif complete_response:
            logger.success(f"Plan {plan_name} marked as {status} in database")
        else:
            logger.error(f"Failed to complete plan {plan_id} after retries")

        # Update kanban task if linked
        plan_info = {"id": plan_id, "project_id": plan_data.get("project_id")}
        await on_plan_completed(plan_info, client, success)

    except Exception as e:
        logger.error(f"Error processing plan {plan_id}: {e}")
        # Try to mark as failed with retry
        try:
            await client.complete_plan_with_retry(plan_id, 'failed', f'Exception: {str(e)}')
        except Exception:
            pass
    finally:
        # Always remove from running set and started dict when done
        running_plans.discard(plan_id)
        running_plans_started.pop(plan_id, None)
        save_pending_plans(running_plans, running_plans_started)


async def run_daemon(server_url: str, token: str) -> None:
    """
    Run in daemon mode: poll API for plans and chat sessions to execute.

    Args:
        server_url: Base URL of the API server
        token: Bearer token for authentication
    """
    # Clear CLAUDECODE to prevent nested session errors when launching subprocesses
    if 'CLAUDECODE' in os.environ:
        logger.info("Unsetting CLAUDECODE to avoid nested session detection")
        del os.environ['CLAUDECODE']

    # Write PID file    
    pid_file = os.environ.get('WEAVE_DAEMON_PID_FILE', '/tmp/weave-daemon.pid')
    try:
        with open(pid_file, 'w') as f:
            f.write(str(os.getpid()))
        logger.info(f"PID file written: {pid_file}")
    except Exception as e:
        logger.error(f"Failed to write PID file: {e}")

    # Log timeout configuration
    timeout_minutes = PLAN_TIMEOUT_SECONDS / 60
    logger.info(f"[Timeout] Plan execution timeout: {PLAN_TIMEOUT_SECONDS}s ({timeout_minutes:.0f} minutes)")

    # Validate timeout configuration
    expected_timeout_seconds = 7200  # 2 hours in seconds
    if PLAN_TIMEOUT_SECONDS != expected_timeout_seconds:
        logger.warning(
            f"[Timeout] Non-standard timeout configured: {PLAN_TIMEOUT_SECONDS}s "
            f"(expected {expected_timeout_seconds}s = 120 minutes). "
            f"Ensure API's PLAN_TIMEOUT_MINUTES is set to {timeout_minutes:.0f} to avoid mismatch."
        )
    else:
        logger.info(f"[Timeout] Timeout configuration matches expected default ({expected_timeout_seconds}s)")

    from orchestrator.daemon_client import DaemonClient

    client = DaemonClient(server_url, token)
    shutdown_requested = False

    # Get the event loop for signal handling
    loop = asyncio.get_event_loop()

    def on_shutdown():
        nonlocal shutdown_requested
        if shutdown_requested:
            # Second time: force exit without I/O
            os._exit(1)
        shutdown_requested = True
        # Log via call_soon — safe within event loop
        loop.call_soon(lambda: logger.info('Shutdown requested, finishing current tasks...'))
        save_pending_plans(running_plans, running_plans_started)

    # Use loop.add_signal_handler which is integrated with the event loop and signal-safe
    loop.add_signal_handler(signal.SIGINT, on_shutdown)
    loop.add_signal_handler(signal.SIGTERM, on_shutdown)

    logger.info(f"Daemon started - polling {server_url} for plans, chat sessions and kanban tasks")
    logger.info(f"Client ID: {socket.gethostname()}")

    # Track running sessions to avoid processing the same session multiple times
    running_sessions: set[str] = set()

    # Track running plans to avoid processing the same plan multiple times
    running_plans: set[str] = set()

    # Track when plans were added to running set (for timeout cleanup)
    running_plans_started: dict[str, float] = {}

    # Track background tasks for proper cleanup
    background_tasks: set[asyncio.Task] = set()

    # Reconcile stuck plans on startup
    await reconcile_running_plans(client, running_plans)

    try:
        while not shutdown_requested:
            # Clean up stale entries from running_plans set (plans older than 30 min)
            now = time.time()
            stale = [pid for pid, started in running_plans_started.items() if now - started > 1800]  # 30 min
            for pid in stale:
                logger.warning(f'[Daemon] Removing stale plan from running set: {pid[:8]}')
                running_plans.discard(pid)
                running_plans_started.pop(pid, None)
            # Save after cleanup
            if stale:
                save_pending_plans(running_plans, running_plans_started)

            # Poll for pending plans
            response = client.get_pending_plans()

            if response.error:
                logger.warn(f"Failed to fetch pending plans: {response.error}")
            elif response.data and len(response.data) > 0:
                # Process each pending plan
                for plan_data in response.data:
                    if shutdown_requested:
                        break

                    plan_id = plan_data.get("id")
                    if not plan_id:
                        continue

                    # Skip if already processing this plan
                    if plan_id in running_plans:
                        logger.debug(f"Plan {plan_id} already running, skipping")
                        continue

                    # Mark as running and track start time
                    running_plans.add(plan_id)
                    running_plans_started[plan_id] = time.time()
                    save_pending_plans(running_plans, running_plans_started)

                    # Create task to process plan asynchronously
                    # Use default argument to capture current plan_data value (closure bug fix)
                    async def _run_plan_wrapper(p=plan_data):
                        try:
                            await _run_plan(p, client, running_plans, running_plans_started)
                        except Exception as e:
                            logger.error(f"Plan execution task error: {e}")
                            running_plans.discard(p.get('id'))
                            running_plans_started.pop(p.get('id'), None)

                    task = asyncio.create_task(_run_plan_wrapper())
                    background_tasks.add(task)
                    task.add_done_callback(background_tasks.discard)

            # Poll for pending chat sessions
            sessions_response = client.get_pending_sessions()

            if sessions_response.error:
                logger.warn(f"Failed to fetch pending sessions: {sessions_response.error}")
            elif sessions_response.data and len(sessions_response.data) > 0:
                # Process each pending session
                for session_data in sessions_response.data:
                    if shutdown_requested:
                        break

                    session_id = session_data.get('id')
                    if not session_id:
                        continue

                    # Skip if already processing this session
                    if session_id in running_sessions:
                        continue

                    # Mark as running
                    running_sessions.add(session_id)

                    # Create task to process session asynchronously
                    # Use default argument to capture current session_data value (closure bug fix)
                    async def _run_session(s=session_data):
                        try:
                            await process_chat_session(s, client)
                        finally:
                            running_sessions.discard(s.get('id'))

                    task = asyncio.create_task(_run_session())
                    background_tasks.add(task)
                    task.add_done_callback(background_tasks.discard)

            # Poll for pending kanban tasks
            from orchestrator.kanban_pipeline import poll_kanban_tasks

            try:
                logger.debug('[Daemon] Polling kanban tasks...')
                await poll_kanban_tasks(client)
            except Exception as e:
                logger.error(f"Kanban pipeline poll error: {e}")

            # Check for completion of running plans (every 60 seconds)
            # Use a counter to run this check every 12 iterations (12 * 5s = 60s)
            if not hasattr(check_completion_counter, 'value'):
                check_completion_counter.value = 0
            check_completion_counter.value += 1

            if check_completion_counter.value >= 12:  # Every 60 seconds
                check_completion_counter.value = 0
                try:
                    logger.debug('[Daemon] Checking for completed running plans...')
                    await check_running_plans_completion(client)
                except Exception as e:
                    logger.error(f"Check completion error: {e}")

                # Process recovery list for plans that failed to complete
                try:
                    logger.debug('[Daemon] Processing recovery list...')
                    await process_needs_recovery_list(client)
                except Exception as e:
                    logger.error(f"Recovery list processing error: {e}")

            # Wait before next poll (unless shutting down)
            if not shutdown_requested:
                await asyncio.sleep(5)

    except Exception as e:
        logger.error(f"Daemon error: {e}")
    finally:
        if background_tasks:
            pending_count = len(background_tasks)
            logger.info(f'Waiting for {pending_count} background tasks to finish (max 60s)...')
            try:
                await asyncio.wait_for(
                    asyncio.gather(*background_tasks, return_exceptions=True),
                    timeout=60.0
                )
                logger.info('All background tasks finished')
            except asyncio.TimeoutError:
                logger.warning(f'Timeout waiting for background tasks — {len(background_tasks)} still running')
                # Cancela as tasks que não terminaram
                for t in background_tasks:
                    if not t.done():
                        t.cancel()

        client.close()

        # Remove PID file
        try:
            if os.path.exists(pid_file):
                os.remove(pid_file)
                logger.info(f"PID file removed: {pid_file}")
        except Exception as e:
            logger.error(f"Failed to remove PID file: {e}")

        clear_pending_plans()
        logger.info("Daemon stopped")


async def run_plan_with_logging(
    client: object,  # DaemonClient - avoid circular import
    plan_id: str,
    plan: Plan,
) -> tuple[bool, str | None, dict | None]:
    """
    Execute a plan and stream logs to the API.

    This wraps run_plan() but captures log output and sends it to the API.

    Args:
        client: Daemon API client
        plan_id: Plan ID for log submission
        plan: Plan to execute

    Returns:
        Tuple of (success: bool, error_message: str | None, review: dict | None)
    """
    from orchestrator.runner import run_plan
    import time

    logger.plan_start(plan.name)

    # Buffer logs in memory for batch sending
    logs_buffer: list[dict] = []

    # Send heartbeat every 30 seconds during execution
    heartbeat_interval = 30
    last_heartbeat = time.time()

    def log_callback(task_id: str, level: str, message: str) -> None:
        """Callback to collect logs from runner."""
        nonlocal last_heartbeat
        logs_buffer.append({
            "task_id": task_id,
            "level": level,
            "message": message,
        })

        # Send heartbeat periodically
        if time.time() - last_heartbeat >= heartbeat_interval:
            try:
                client.send_heartbeat(plan_id)
                last_heartbeat = time.time()
            except Exception as e:
                logger.warning(f'Failed to send heartbeat: {e}')

        # Send in batch: every 5 logs or on significant events
        if len(logs_buffer) >= 5 or level in ("error", "info"):
            logs_to_send = logs_buffer.copy()
            logs_buffer.clear()
            log_response = client.send_logs(plan_id, logs_to_send)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

    try:
        # Execute plan with log callback
        success, review = await run_plan(plan, log_callback, client)

        # Flush any remaining logs
        if logs_buffer:
            log_response = client.send_logs(plan_id, logs_buffer)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

        logger.plan_done(plan.name, success=success)
        return success, None, review

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Plan execution error: {error_msg}")

        # Flush logs on error
        if logs_buffer:
            log_response = client.send_logs(plan_id, logs_buffer)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

        # Notify API of failure with retry
        try:
            await client.complete_plan_with_retry(plan_id, 'failed', error_msg)
        except Exception:
            pass
        return False, error_msg


async def process_chat_session(session: dict, client: object) -> None:
    """
    Process a chat session from the daemon.

    Executes a single turn of the conversation and saves the assistant's response.

    Args:
        session: Session data from the API
        client: Daemon API client
    """
    from orchestrator.chat_runner import run_chat_turn

    session_id = session['id']
    workspace_path = session['workspace_path']

    # Use env_project_path if available (from environment), otherwise fall back to workspace_path
    cwd = session.get('env_project_path') or session.get('cwd') or workspace_path

    sdk_session_id = session.get('sdk_session_id')
    user_message = session.get('last_user_message', '')

    logger.info(f'Processing chat session {session_id[:8]}...')

    async def on_sdk_session(new_id: str):
        """Callback when SDK session ID changes."""
        response = client.save_sdk_session_id(session_id, new_id)
        if response.error:
            logger.error(f'Failed to save SDK session ID: {response.error}')
        else:
            logger.debug(f'Session {session_id[:8]} sdk_id: {new_id[:8]}...')

    async def on_response(text: str, structured):
        """Callback when assistant response is complete."""
        response = client.save_assistant_message(session_id, text, structured)
        if response.error:
            logger.error(f'Failed to save assistant message: {response.error}')

    async def log_callback(logs: list):
        """Callback for streaming logs."""
        # We don't need to stream logs separately for chat
        # The full response is saved via on_response
        pass

    # Check if user message exists
    if not user_message:
        logger.warning(f'Session {session_id[:8]} has no user message, skipping')
        # Reset to idle to avoid getting stuck
        await on_response('No message received.', None)
        return

    # Detailed logging for session processing
    logger.info(f"[Session] Processing session id={session.get('id')} name={session.get('name')}")
    logger.info(f"[Session] project_id={session.get('project_id')} workspace_path={session.get('workspace_path')}")
    logger.info(f"[Session] environment_id={session.get('environment_id')} env_project_path={session.get('env_project_path')}")
    logger.info(f"[Session] cwd resolved={cwd}")

    try:
        new_sdk_session_id = await run_chat_turn(
            session_id=session_id,
            message=user_message,
            workspace_path=workspace_path,
            cwd=cwd,
            sdk_session_id=sdk_session_id,
            on_sdk_session=on_sdk_session,
            on_response=on_response,
            log_callback=log_callback,
            client=client,  # Pass DaemonClient for fetching agents context
            project_id=session.get('project_id'),  # Pass project_id for fetching agents context
        )

        logger.info(f'Session {session_id[:8]} completed')
    except Exception as e:
        logger.error(f'Chat session {session_id[:8]} error: {e}')
        # Save error as assistant message
        await on_response(f'Error: {str(e)}', None)


async def main() -> None:
    args = parse_args()

    # Daemon mode
    if args.daemon:
        # Get server URL from CLI flag, env var, or default
        server_url = args.server or os.environ.get(
            "WEAVE_URL", "http://localhost:3001"
        )

        # Get token from CLI flag or env var
        token = args.token or os.environ.get("WEAVE_TOKEN")

        if not token:
            logger.error(
                "Token is required for daemon mode. "
                "Use --token or set WEAVE_TOKEN environment variable."
            )
            sys.exit(1)

        await run_daemon(server_url, token)
        return

    # Standard mode: require plan file
    if not args.plan:
        logger.error("Plan file is required unless using --daemon mode")
        sys.exit(1)

    try:
        plan = load_plan(args.plan)
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to load plan: {e}")
        sys.exit(1)

    if args.dry_run:
        dry_run(args.plan)
        return

    success, review = await run_plan(plan)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())