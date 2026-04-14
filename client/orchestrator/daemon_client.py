"""
DaemonClient: HTTP client for communicating with the weave API.

Handles all HTTP communication for daemon mode:
- Polling for pending plans
- Starting plan execution
- Streaming log entries
- Completing plan execution
- Requesting and waiting for approvals
"""

from __future__ import annotations

import socket
import time
from dataclasses import dataclass
from typing import Any

import httpx

from orchestrator import logger


@dataclass
class Plan:
    """A plan from the API."""
    id: str
    name: str
    tasks: list[dict[str, Any]]
    status: str


@dataclass
class PlanResponse:
    """Response envelope from the API."""
    data: Any | None
    error: str | None = None


class DaemonClient:
    """
    HTTP client for the weave API.

    All methods return PlanResponse with {data, error} envelope.
    """

    def __init__(self, server_url: str, token: str):
        """
        Initialize the client.

        Args:
            server_url: Base URL of the API server (e.g., http://localhost:3001)
            token: Bearer token for authentication
        """
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.client_id = socket.gethostname()
        self._client = httpx.Client(
            base_url=f"{self.server_url}/api",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=30.0,
        )

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def _handle_response(self, response: httpx.Response) -> PlanResponse:
        """
        Handle API response, extracting data/error from envelope.

        Args:
            response: HTTP response from the API

        Returns:
            PlanResponse with data and error fields
        """
        try:
            envelope = response.json()
            if isinstance(envelope, dict):
                return PlanResponse(
                    data=envelope.get("data"),
                    error=envelope.get("error"),
                )
            # Fallback for non-envelope responses (shouldn't happen with proper API)
            return PlanResponse(data=envelope)
        except Exception as e:
            return PlanResponse(
                data=None,
                error=f"Failed to parse response: {e}",
            )

    def get_pending_plans(self) -> PlanResponse:
        """
        Poll for pending plans.

        GET /api/plans/pending

        Returns:
            PlanResponse with data=list[Plan] or error
        """
        try:
            response = self._client.get("/plans/pending")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def start_plan(self, plan_id: str) -> PlanResponse:
        """
        Start execution of a plan.

        POST /api/plans/:id/start
        Body: {client_id: hostname}

        Args:
            plan_id: ID of the plan to start

        Returns:
            PlanResponse with data=updated_plan or error
        """
        try:
            response = self._client.post(
                f"/plans/{plan_id}/start",
                json={"client_id": self.client_id},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def send_heartbeat(self, plan_id: str) -> PlanResponse:
        """
        Send heartbeat for a running plan.

        POST /api/plans/:id/heartbeat

        Args:
            plan_id: ID of the plan

        Returns:
            PlanResponse with data={heartbeat_at: timestamp} or error
        """
        try:
            response = self._client.post(f"/plans/{plan_id}/heartbeat")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def send_logs(self, plan_id: str, logs: list[dict[str, Any]]) -> PlanResponse:
        """
        Send log entries for a plan.

        POST /api/plans/:id/logs
        Body: [{task_id, level, message}, ...]

        Args:
            plan_id: ID of the plan
            logs: List of log entries with task_id, level, message

        Returns:
            PlanResponse with data=success or error
        """
        if not logs:
            return PlanResponse(data=True)

        try:
            response = self._client.post(
                f"/plans/{plan_id}/logs",
                json=logs,  # Send logs array directly, not wrapped in object
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def complete_plan(
        self,
        plan_id: str,
        status: str,
        result: str | None = None,
        result_status: str | None = None,
        result_notes: str | None = None,
        structured_output: dict[str, Any] | None = None,
    ) -> PlanResponse:
        """
        Mark a plan as completed.

        POST /api/plans/:id/complete
        Body: {status: "success" | "failed", result: string, result_status?, result_notes?, structured_output?, daemon_completed_at?}

        Args:
            plan_id: ID of the plan
            status: Final status ("success" or "failed")
            result: Optional result message
            result_status: Optional detailed status (success | partial | needs_rework)
            result_notes: Optional summary notes from review
            structured_output: Optional structured output (review JSON)

        Returns:
            PlanResponse with data=updated_plan or error
        """
        try:
            from datetime import datetime

            body = {"status": status}
            if result is not None:
                body["result"] = result
            if result_status is not None:
                body["result_status"] = result_status
            if result_notes is not None:
                body["result_notes"] = result_notes
            if structured_output is not None:
                body["structured_output"] = structured_output

            # Add daemon completion timestamp to help API distinguish legitimate completions
            # from stale requests in race condition scenarios
            body["daemon_completed_at"] = datetime.utcnow().isoformat() + "Z"

            response = self._client.post(
                f"/plans/{plan_id}/complete",
                json=body,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    async def verify_plan_exists(self, plan_id: str) -> bool:
        """
        Verify that a plan exists in the API.

        GET /api/plans/:id

        Args:
            plan_id: ID of the plan to verify

        Returns:
            True if plan exists, False otherwise
        """
        import asyncio

        try:
            data = await asyncio.to_thread(
                self._client.get,
                f"/plans/{plan_id}"
            )
            if data.status_code == 200:
                body = data.json()
                # Check for error in response envelope
                if isinstance(body, dict) and body.get('error'):
                    logger.warning(f'[DaemonClient] Plan {plan_id[:8]} verify error: {body.get("error")}')
                    return False
                return True
            elif data.status_code == 404:
                logger.warning(f'[DaemonClient] Plan {plan_id[:8]} not found (404)')
                return False
            else:
                logger.warning(f'[DaemonClient] Plan {plan_id[:8]} verify returned status {data.status_code}')
                return False
        except Exception as e:
            logger.warning(f'[DaemonClient] Failed to verify plan {plan_id[:8]}: {e}')
            return False

    async def complete_plan_with_retry(
        self,
        plan_id: str,
        status: str,
        result: str | None = None,
        result_status: str | None = None,
        result_notes: str | None = None,
        structured_output: dict[str, Any] | None = None,
        max_retries: int = 8,
        verify_completion: bool = True,
        **kwargs
    ) -> PlanResponse | None:
        """
        Tenta completar o plano com retry exponencial agressivo e verificação final.

        Melhorias:
        - Retry mais agressivo (até 8 tentativas com backoff exponencial)
        - Verificação final do status após sucesso
        - Classificação de erros (transientes vs permanentes)
        - Adiciona à lista de recuperação se verificação falhar

        Args:
            plan_id: ID of the plan
            status: Final status ("success" or "failed")
            result: Optional result message
            result_status: Optional detailed status
            result_notes: Optional summary notes from review
            structured_output: Optional structured output (review JSON)
            max_retries: Maximum number of retry attempts (default: 8, mais agressivo)
            verify_completion: Whether to verify status after successful completion (default: True)
            **kwargs: Additional parameters (for backwards compatibility)

        Returns:
            PlanResponse with data=updated_plan, or None if all retries fail
        """
        import asyncio
        import time

        # Log completion attempt with context
        logger.info(f'[DaemonClient] Attempting to complete plan {plan_id[:8]}: status={status}, retries={max_retries}')

        # First, verify the plan exists and get current status
        if not await self.verify_plan_exists(plan_id):
            logger.error(f'[DaemonClient] Plan {plan_id[:8]} does not exist in API — cannot complete')
            return PlanResponse(data=None, error='Plan not found in API')

        # Get current plan status for better error messages
        current_status = None
        try:
            plan_response = await asyncio.to_thread(
                self._client.get,
                f"/plans/{plan_id}"
            )
            if plan_response.status_code == 200:
                plan_data = plan_response.json()
                current_status = plan_data.get('data', {}).get('status') if isinstance(plan_data.get('data'), dict) else None
                if current_status:
                    logger.info(f'[DaemonClient] Plan {plan_id[:8]} current status: {current_status}')
        except Exception as e:
            logger.warning(f'[DaemonClient] Failed to fetch plan status: {e}')

        # Track error types for better logging
        transient_errors = []
        permanent_errors = []

        for attempt in range(max_retries):
            try:
                logger.debug(f'[DaemonClient] Complete attempt {attempt + 1}/{max_retries} for plan {plan_id[:8]}')

                response = self.complete_plan(
                    plan_id, status, result,
                    result_status=result_status,
                    result_notes=result_notes,
                    structured_output=structured_output,
                )

                if not response.error:
                    logger.success(f'[DaemonClient] Plan {plan_id[:8]} completion API call succeeded: {status}')

                    # Verification step after successful completion
                    if verify_completion:
                        verification_result = await self._verify_completion_status(
                            plan_id, status, attempt + 1
                        )

                        if verification_result == 'verified':
                            logger.success(f'[DaemonClient] Plan {plan_id[:8]} status verified: {status}')
                            return response
                        elif verification_result == 'mismatch':
                            # Status mismatch - add to recovery list
                            logger.error(
                                f'[DaemonClient] Plan {plan_id[:8]} VERIFICATION FAILED: '
                                f'expected {status} but got different status. Adding to recovery list.'
                            )
                            await self._add_to_needs_recovery(plan_id, status, result)
                            # Still return response since API call succeeded
                            return response
                        elif verification_result == 'error':
                            # Verification error - log but don't fail
                            logger.warning(
                                f'[DaemonClient] Plan {plan_id[:8]} verification check failed, '
                                f'but completion call succeeded. Proceeding with caution.'
                            )
                            return response
                    else:
                        # Skip verification, return success immediately
                        return response

                error_msg = str(response.error)

                # Classify errors as TRANSIENT or PERMANENT
                error_type, is_permanent = self._classify_error(error_msg)

                if is_permanent:
                    permanent_errors.append((attempt + 1, error_msg, error_type))

                    # Status mismatch errors - don't retry
                    if error_type == 'status_mismatch':
                        logger.warning(
                            f'[DaemonClient] Plan {plan_id[:8]} status mismatch [PERMANENT]: {error_msg}. '
                            f'This may indicate a race condition with timeout recovery.'
                        )
                        return response

                    # Other permanent errors - don't retry
                    logger.warning(
                        f'[DaemonClient] Plan {plan_id[:8]} error [PERMANENT - {error_type}]: {error_msg}. '
                        f'Skipping retries.'
                    )
                    return response
                else:
                    # Transient errors - log and retry
                    transient_errors.append((attempt + 1, error_msg, error_type))
                    logger.warning(
                        f'[DaemonClient] Plan {plan_id[:8]} error [TRANSIENT - {error_type}]: '
                        f'attempt {attempt+1}/{max_retries} failed: {error_msg}'
                    )

            except Exception as e:
                err_str = str(e)
                error_type, is_permanent = self._classify_exception(e)

                if is_permanent:
                    permanent_errors.append((attempt + 1, err_str, error_type))
                    logger.error(
                        f'[DaemonClient] Plan {plan_id[:8]} exception [PERMANENT - {error_type}]: {e}'
                    )
                    return PlanResponse(data=None, error=f'Permanent error: {e}')
                else:
                    transient_errors.append((attempt + 1, err_str, error_type))
                    logger.warning(
                        f'[DaemonClient] Plan {plan_id[:8]} exception [TRANSIENT - {error_type}]: '
                        f'attempt {attempt+1}/{max_retries}: {e}'
                    )

            # Aggressive exponential backoff with jitter: 0.5s, 1s, 2s, 4s, 8s, 16s, 32s, 64s
            if attempt < max_retries - 1:
                base_wait = 0.5 * (2 ** attempt)  # Start with 0.5s for faster retries
                jitter = 0.1 * base_wait  # Add 10% jitter
                wait = base_wait + (jitter * (2 * time.time() % 1 - 0.5))  # Random jitter
                wait = max(0.5, min(wait, 60))  # Clamp between 0.5s and 60s

                logger.info(f'[DaemonClient] Retrying complete_plan for {plan_id[:8]} in {wait:.1f}s...')
                await asyncio.sleep(wait)

        # All retries exhausted
        logger.error(
            f'[DaemonClient] Failed to complete plan {plan_id[:8]} after {max_retries} attempts. '
            f'Transient errors: {len(transient_errors)}, Permanent errors: {len(permanent_errors)}. '
            f'Final status may not reflect actual execution result.'
        )

        # Log summary of errors
        if transient_errors:
            logger.error(f'[DaemonClient] Transient errors summary:')
            for attempt_num, err, err_type in transient_errors[-3:]:  # Last 3
                logger.error(f'  - Attempt {attempt_num} [{err_type}]: {err[:100]}...')

        if permanent_errors:
            logger.error(f'[DaemonClient] Permanent errors summary:')
            for attempt_num, err, err_type in permanent_errors:
                logger.error(f'  - Attempt {attempt_num} [{err_type}]: {err[:100]}...')

        # Add to recovery list since we couldn't complete after all retries
        await self._add_to_needs_recovery(plan_id, status, result)

        return None

    def _classify_error(self, error_msg: str) -> tuple[str, bool]:
        """
        Classify API error as transient or permanent.

        Args:
            error_msg: Error message from API response

        Returns:
            Tuple of (error_type, is_permanent)
        """
        error_msg_lower = error_msg.lower()

        # Permanent errors - don't retry
        if 'not in running status' in error_msg_lower:
            return ('status_mismatch', True)
        if 'plan not found' in error_msg_lower or 'not found' in error_msg_lower:
            return ('not_found', True)
        if '400' in error_msg or 'bad request' in error_msg_lower:
            return ('bad_request', True)
        if '401' in error_msg or 'unauthorized' in error_msg_lower:
            return ('auth_error', True)
        if '403' in error_msg or 'forbidden' in error_msg_lower:
            return ('forbidden', True)
        if '409' in error_msg or 'conflict' in error_msg_lower:
            return ('conflict', True)
        if '422' in error_msg or 'validation' in error_msg_lower:
            return ('validation_error', True)

        # Transient errors - safe to retry
        if '500' in error_msg or 'internal server error' in error_msg_lower:
            return ('server_error', False)
        if '502' in error_msg or '503' in error_msg or '504' in error_msg:
            return ('gateway_error', False)
        if 'timeout' in error_msg_lower:
            return ('timeout', False)
        if 'connection' in error_msg_lower:
            return ('connection_error', False)
        if 'network' in error_msg_lower or 'temporarily' in error_msg_lower:
            return ('network_error', False)

        # Unknown error - assume transient to be safe
        return ('unknown', False)

    def _classify_exception(self, exception: Exception) -> tuple[str, bool]:
        """
        Classify exception as transient or permanent.

        Args:
            exception: Exception object

        Returns:
            Tuple of (error_type, is_permanent)
        """
        err_str = str(exception).lower()

        # Import httpx for exception type checking
        import httpx

        # HTTP status errors
        if isinstance(exception, httpx.HTTPStatusError):
            status_code = exception.response.status_code
            if status_code >= 500:
                return ('http_server_error', False)
            elif status_code >= 400:
                return ('http_client_error', True)

        # Timeout errors
        if isinstance(exception, (httpx.TimeoutException, httpx.ReadTimeout, httpx.WriteTimeout)):
            return ('timeout', False)

        # Connection errors
        if isinstance(exception, (httpx.ConnectError, httpx.ConnectTimeout)):
            return ('connection_error', False)

        # Network errors
        if 'connection refused' in err_str or 'cannot connect' in err_str:
            return ('connection_refused', False)
        if 'network' in err_str or 'socket' in err_str:
            return ('network_error', False)

        # Other exceptions - assume transient
        return ('exception', False)

    async def _verify_completion_status(
        self,
        plan_id: str,
        expected_status: str,
        attempt_num: int
    ) -> str:
        """
        Verify that the plan status was actually updated after completion.

        Args:
            plan_id: ID of the plan to verify
            expected_status: Status that should be set (e.g., 'success', 'failed')
            attempt_num: Current attempt number for logging

        Returns:
            'verified' if status matches, 'mismatch' if different, 'error' if verification failed
        """
        import asyncio

        try:
            # Wait a moment for the database to settle
            await asyncio.sleep(0.2)

            # Fetch current plan status
            plan_response = await asyncio.to_thread(
                self._client.get,
                f"/plans/{plan_id}"
            )

            if plan_response.status_code != 200:
                logger.warning(
                    f'[DaemonClient] Verification request failed for plan {plan_id[:8]}: '
                    f'HTTP {plan_response.status_code}'
                )
                return 'error'

            plan_data = plan_response.json()
            actual_status = plan_data.get('data', {}).get('status') if isinstance(plan_data.get('data'), dict) else None

            if not actual_status:
                logger.warning(f'[DaemonClient] Could not extract status from verification response')
                return 'error'

            if actual_status == expected_status:
                logger.debug(
                    f'[DaemonClient] Verification successful for plan {plan_id[:8]}: '
                    f'status={actual_status}'
                )
                return 'verified'
            else:
                logger.warning(
                    f'[DaemonClient] Verification MISMATCH for plan {plan_id[:8]}: '
                    f'expected={expected_status}, actual={actual_status}'
                )
                return 'mismatch'

        except Exception as e:
            logger.warning(
                f'[DaemonClient] Verification exception for plan {plan_id[:8]}: {e}'
            )
            return 'error'

    async def _add_to_needs_recovery(
        self,
        plan_id: str,
        intended_status: str,
        result_message: str | None = None
    ) -> None:
        """
        Add a plan to the recovery list for the periodic checker.

        This stores recovery information in a local file that the periodic
        completion checker can use to retry completion.

        Args:
            plan_id: ID of the plan that needs recovery
            intended_status: The status we tried to set
            result_message: Optional result message
        """
        import json
        import os
        from pathlib import Path

        recovery_file = Path('/tmp/weave-needs-recovery.json')

        try:
            # Load existing recovery list
            recovery_list = []
            if recovery_file.exists():
                try:
                    with open(recovery_file, 'r') as f:
                        recovery_list = json.load(f)
                except Exception:
                    recovery_list = []

            # Check if already in list
            if any(p.get('plan_id') == plan_id for p in recovery_list):
                logger.debug(f'[DaemonClient] Plan {plan_id[:8]} already in recovery list')
                return

            # Add to list
            recovery_entry = {
                'plan_id': plan_id,
                'intended_status': intended_status,
                'result_message': result_message,
                'added_at': time.time(),
                'attempts': 1
            }
            recovery_list.append(recovery_entry)

            # Save to file
            with open(recovery_file, 'w') as f:
                json.dump(recovery_list, f, indent=2)

            logger.warning(
                f'[DaemonClient] Added plan {plan_id[:8]} to recovery list '
                f'(intended_status={intended_status})'
            )

        except Exception as e:
            logger.error(f'[DaemonClient] Failed to add plan {plan_id[:8]} to recovery list: {e}')

    def get_plan(self, plan_id: str) -> PlanResponse:
        """
        Fetch details of a specific plan.

        GET /api/plans/:id

        Args:
            plan_id: ID of the plan to fetch

        Returns:
            PlanResponse with data=plan_details or error
        """
        try:
            response = self._client.get(f"/plans/{plan_id}")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def request_approval(
        self,
        plan_id: str,
        task_id: str,
        tool: str,
        input_data: dict[str, Any],
        reason: str = "",
    ) -> PlanResponse:
        """
        Request approval for a tool operation.

        POST /api/approvals
        Body: {plan_id, task_id, tool, input, reason}

        Args:
            plan_id: ID of the plan
            task_id: ID of the task
            tool: Tool name being requested
            input_data: Tool input parameters
            reason: Reason for approval request

        Returns:
            PlanResponse with data={id: approval_id} or error
        """
        try:
            payload = {
                "plan_id": plan_id,
                "task_id": task_id,
                "tool": tool,
                "input": input_data,
                "reason": reason,
            }
            response = self._client.post(
                "/approvals",
                json=payload,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def wait_for_approval(
        self,
        approval_id: str,
        timeout_seconds: int = 600,
        poll_interval: float = 2.0,
    ) -> PlanResponse:
        """
        Poll for approval decision.

        Continuously polls GET /api/approvals/:id until the approval
        is no longer pending (approved/denied/timeout).

        Args:
            approval_id: ID of the approval request
            timeout_seconds: Maximum time to wait (default: 600 = 10 minutes)
            poll_interval: Seconds between polls (default: 2.0)

        Returns:
            PlanResponse with data=status ("approved" | "denied" | "timeout") or error
        """
        deadline = time.time() + timeout_seconds

        while time.time() < deadline:
            try:
                response = self._client.get(f"/approvals/{approval_id}")
                handled = self._handle_response(response)

                if handled.error:
                    return PlanResponse(data=None, error=handled.error)

                if handled.data:
                    status = handled.data.get("status")
                    if status != "pending":
                        # Approval has been decided
                        return PlanResponse(data=status)

                # Still pending, wait before next poll
                time.sleep(poll_interval)

            except httpx.HTTPError as e:
                return PlanResponse(data=None, error=f"HTTP error: {e}")
            except Exception as e:
                return PlanResponse(data=None, error=f"Polling failed: {e}")

        # Timeout reached
        return PlanResponse(data="timeout")

    async def save_structured_output(self, plan_id: str, output: dict[str, Any]) -> PlanResponse:
        """
        Save structured output (plan/review/diagnosis) from a quick action.

        POST /api/plans/:id/structured-output
        Body: {output: {type: 'plan'|'review'|'diagnosis', content: {...}}}

        Args:
            plan_id: ID of the plan
            output: Structured output with type and content

        Returns:
            PlanResponse with data={saved: true} or error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.post,
                f"/plans/{plan_id}/structured-output",
                json={"output": output},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    async def get_project_agents_context(self, project_id: str) -> str:
        """
        Return a formatted string with available teams for a project.

        This context is injected into planner agents so they can reference
        the correct teams when creating task assignments.

        GET /api/projects/:id/agents-context

        Args:
            project_id: ID of the project

        Returns:
            Formatted string with team information, or empty string on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.get,
                f"/projects/{project_id}/agents-context",
            )
            handled = self._handle_response(response)

            if handled.error:
                logger.warning(f"Failed to fetch teams context: {handled.error}")
                return ""

            # A API pode retornar {"data": [...]} ou diretamente [...]
            data = handled.data
            if isinstance(data, dict):
                agents = data.get('data') or []
            elif isinstance(data, list):
                agents = data
            else:
                agents = []

            if not agents:
                return ""

            lines = ["## Available Teams for this Project\n"]
            for team in agents:
                role = team.get("role", "generic")
                name = team.get("name", "unknown")
                workspace = team.get("workspace_path", "")
                team_agents = team.get("agents", [])
                agents_info = f"\n  agents: {', '.join(team_agents)}" if team_agents else ""
                lines.append(f"- **{name}** (role: `{role}`)")
                lines.append(f"  workspace: `{workspace}`{agents_info}")

            lines.append("")
            lines.append(
                "When creating task assignments, use the workspace paths above. "
                "Match task type to team role: coders for implementation, "
                "reviewers for validation, testers for test suites, etc.\n"
                "NOTE: Each team has its own agents defined in its .claude/agents/ directory. "
                "Do NOT confuse teams with individual agents."
            )

            return "\n".join(lines)

        except Exception as e:
            logger.warning(f"Error fetching agents context: {e}")
            return ""

    async def get_project_planning_context(self, project_id: str) -> dict:
        """
        Retorna contexto completo do projeto para o planejador.

        Inclui informações do projeto, ambientes e agentes com roles,
        permitindo que o planejador gere planos mais precisos.

        GET /api/projects/:id/planning-context

        Args:
            project_id: ID of the project

        Returns:
            Dict with project, environments, and agents, or empty dict on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.get,
                f"/projects/{project_id}/planning-context",
            )
            handled = self._handle_response(response)

            if handled.error:
                logger.warning(f"Failed to fetch planning context: {handled.error}")
                return {}

            # Extract data from envelope if present
            data = handled.data
            if isinstance(data, dict):
                return data
            elif isinstance(data, dict) and 'data' in data:
                return data['data'] or {}
            else:
                return {}

        except Exception as e:
            logger.warning(f"Failed to get planning context: {e}")
            return {}

    # Chat session methods

    def get_pending_sessions(self) -> PlanResponse:
        """
        Poll for pending chat sessions.

        GET /api/sessions/pending

        Returns:
            PlanResponse with data=list[Session] or error
        """
        try:
            response = self._client.get("/sessions/pending")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def get_session_status(self, session_id: str) -> PlanResponse:
        """
        Check the current status of a chat session.

        GET /api/sessions/:id (returns just the status)

        Args:
            session_id: ID of the session

        Returns:
            PlanResponse with data=session or error
        """
        try:
            response = self._client.get(f"/sessions/{session_id}")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def save_sdk_session_id(self, session_id: str, sdk_session_id: str) -> PlanResponse:
        """
        Save SDK session ID for a chat session.

        POST /api/sessions/:id/sdk-session
        Body: {sdk_session_id: string}

        Args:
            session_id: ID of the session
            sdk_session_id: SDK session ID to persist

        Returns:
            PlanResponse with data=updated_session or error
        """
        try:
            response = self._client.post(
                f"/sessions/{session_id}/sdk-session",
                json={"sdk_session_id": sdk_session_id},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def save_plan_sdk_session_id(self, plan_id: str, sdk_session_id: str) -> PlanResponse:
        """
        Save SDK session ID for a plan (enables resume with Claude Code session context).

        POST /api/plans/:id/sdk-session
        Body: {sdk_session_id: string}

        Args:
            plan_id: ID of the plan
            sdk_session_id: SDK session ID to persist

        Returns:
            PlanResponse with data={saved: true} or error
        """
        try:
            response = self._client.post(
                f"/plans/{plan_id}/sdk-session",
                json={"sdk_session_id": sdk_session_id},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def save_assistant_message(
        self,
        session_id: str,
        content: str,
        structured_output: dict[str, Any] | None = None,
    ) -> PlanResponse:
        """
        Save an assistant message to a chat session.

        POST /api/sessions/:id/assistant-message
        Body: {content: string, structured_output?: dict}

        Args:
            session_id: ID of the session
            content: Message content
            structured_output: Optional structured output (plan/review/diagnosis)

        Returns:
            PlanResponse with data=updated_session or error
        """
        try:
            body = {"content": content}
            if structured_output is not None:
                body["structured_output"] = structured_output

            response = self._client.post(
                f"/sessions/{session_id}/assistant-message",
                json=body,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def send_chat_logs(self, session_id: str, logs: list[dict[str, Any]]) -> PlanResponse:
        """
        Send streaming log entries for a chat session.

        POST /api/sessions/:id/logs
        Body: [{level: string, message: string}, ...]

        Args:
            session_id: ID of the chat session
            logs: List of log entries with level and message

        Returns:
            PlanResponse with data={inserted: number} or error
        """
        try:
            response = self._client.post(
                f"/sessions/{session_id}/logs",
                json=logs,
                timeout=10.0,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    # ── Attachment methods ──────────────────────────────────────────────

    def get_message_attachments(self, session_id: str) -> list[dict[str, Any]]:
        """
        Fetch attachment IDs for the last user message in a chat session.

        GET /api/sessions/:id — retrieves session with its messages.

        The response includes chat_messages; each message may have an
        ``attachments`` JSON column containing a list of attachment UUIDs.

        Args:
            session_id: ID of the chat session.

        Returns:
            List of attachment ID strings, or empty list on error.
        """
        try:
            response = self._client.get(f"/sessions/{session_id}")
            handled = self._handle_response(response)

            if handled.error:
                logger.warning(f"Failed to fetch session for attachments: {handled.error}")
                return []

            data = handled.data
            if not isinstance(data, dict):
                return []

            messages = data.get("messages") or data.get("chat_messages") or []
            if isinstance(messages, str):
                import json
                try:
                    messages = json.loads(messages)
                except (json.JSONDecodeError, TypeError):
                    return []

            # Walk messages in reverse to find the last user message
            for msg in reversed(messages):
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role", "")
                if role == "user":
                    attachments_raw = msg.get("attachments", "[]")
                    if isinstance(attachments_raw, str):
                        try:
                            import json
                            attachment_ids = json.loads(attachments_raw)
                        except (json.JSONDecodeError, TypeError):
                            attachment_ids = []
                    elif isinstance(attachments_raw, list):
                        attachment_ids = attachments_raw
                    else:
                        attachment_ids = []

                    return [a for a in attachment_ids if isinstance(a, str)]

            return []

        except httpx.HTTPError as e:
            logger.warning(f"HTTP error fetching session attachments: {e}")
            return []
        except Exception as e:
            logger.warning(f"Error fetching session attachments: {e}")
            return []

    def get_plan_attachments(self, plan_id: str) -> list[str]:
        """
        Fetch attachment IDs associated with a plan.

        GET /api/plans/:id — retrieves plan details including the
        ``attachments`` JSON column.

        Args:
            plan_id: ID of the plan.

        Returns:
            List of attachment ID strings, or empty list on error.
        """
        try:
            response = self._client.get(f"/plans/{plan_id}")
            handled = self._handle_response(response)

            if handled.error:
                logger.warning(f"Failed to fetch plan for attachments: {handled.error}")
                return []

            data = handled.data
            if not isinstance(data, dict):
                return []

            attachments_raw = data.get("attachments", "[]")
            if isinstance(attachments_raw, str):
                import json
                try:
                    attachment_ids = json.loads(attachments_raw)
                except (json.JSONDecodeError, TypeError):
                    attachment_ids = []
            elif isinstance(attachments_raw, list):
                attachment_ids = attachments_raw
            else:
                attachment_ids = []

            return [a for a in attachment_ids if isinstance(a, str)]

        except httpx.HTTPError as e:
            logger.warning(f"HTTP error fetching plan attachments: {e}")
            return []
        except Exception as e:
            logger.warning(f"Error fetching plan attachments: {e}")
            return []

    # Kanban pipeline methods

    async def _patch(self, path: str, data: dict[str, Any]) -> dict | None:
        """
        Internal PATCH request method (async).

        Args:
            path: API path (e.g., /kanban/:projectId/:taskId/pipeline)
            data: Request body

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(self._client.patch, path, json=data)
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"PATCH {path} failed: {e}")
            return None

    async def _put(self, path: str, data: dict[str, Any]) -> dict | None:
        """
        Internal PUT request method (async).

        Args:
            path: API path (e.g., /kanban/:projectId/:taskId)
            data: Request body

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(self._client.put, path, json=data)
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"PUT {path} failed: {e}")
            return None

    async def _post(self, path: str, data: dict[str, Any] | None = None) -> dict | list | None:
        """
        Internal POST request method (async).

        Args:
            path: API path (e.g., /plans)
            data: Request body

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.post,
                path,
                json=data or {}
            )
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"POST {path} failed: {e}")
            return None

    async def _get(self, path: str) -> dict | list | None:
        """
        Internal GET request method (async).

        Args:
            path: API path (e.g., /projects)

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(self._client.get, path)
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"GET {path} failed: {e}")
            return None

    async def get_pending_kanban_tasks(self, project_id: str) -> list:
        """
        Busca kanban tasks ativas sem workflow vinculado.

        GET /api/kanban/:projectId/pending-pipeline

        Args:
            project_id: ID of the project

        Returns:
            List of kanban tasks or empty list on error
        """
        try:
            data = await self._get(f"/kanban/{project_id}/pending-pipeline")
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning(f"Failed to get pending kanban tasks: {e}")
            return []

    async def get_all_projects(self) -> list:
        """
        Retorna todos os projetos com settings.

        GET /api/projects

        Returns:
            List of projects or empty list on error
        """
        try:
            data = await self._get("/projects")
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning(f"Failed to get projects: {e}")
            return []

    async def update_kanban_pipeline(
        self,
        project_id: str,
        task_id: str,
        **kwargs
    ) -> dict:
        """
        Atualiza pipeline_status de uma kanban task.

        PATCH /api/kanban/:projectId/:taskId/pipeline

        Args:
            project_id: ID of the project
            task_id: ID of the kanban task
            **kwargs: Fields to update (pipeline_status, workflow_id, error_message)

        Returns:
            Updated task data or empty dict on error
        """
        try:
            data = await self._patch(f"/kanban/{project_id}/{task_id}/pipeline", kwargs)
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Failed to update kanban pipeline: {e}")
            return {}

    async def prepare_workflow(self, project_id: str, project_name: str = '') -> dict:
        """
        Pre-create a workflow directory and return its path.

        POST /api/plans/prepare-workflow

        The orchestrator calls this BEFORE the planning agent runs so that
        the agent can save plan.json directly to the blackboard directory.

        Args:
            project_id: Project UUID
            project_name: Project name for directory slugification

        Returns:
            dict with 'id' (workflow UUID) and 'workflow_path', or empty dict on error
        """
        try:
            data = await self._post("/plans/prepare-workflow", {
                "project_id": project_id,
                "project_name": project_name,
            })
            if not isinstance(data, dict):
                logger.error(f'[DaemonClient] prepare_workflow: unexpected response type {type(data).__name__}')
                return {}
            logger.info(f'[DaemonClient] Workflow prepared: id={data.get("id")}, path={data.get("workflow_path")}')
            return data
        except Exception as e:
            logger.error(f'[DaemonClient] Failed to prepare workflow: {type(e).__name__}: {e}')
            return {}

    async def create_plan_from_data(self, plan_data: dict) -> dict:
        """
        Cria um workflow a partir de um dict de plano.

        POST /api/plans

        Args:
            plan_data: Plan data with name, tasks, project_id, etc.

        Returns:
            Created plan data or empty dict on error
        """
        try:
            logger.info(f'[DaemonClient] Creating plan: name="{plan_data.get("name", "?")}", '
                       f'project_id={plan_data.get("project_id", "?")}, '
                       f'tasks={len(plan_data.get("tasks", []))}')
            data = await self._post("/plans", plan_data)

            if data is None:
                logger.error('[DaemonClient] Plan creation failed: _post returned None')
                return {}

            if not isinstance(data, dict):
                logger.error(f'[DaemonClient] Plan creation failed: unexpected response type {type(data).__name__}')
                return {}

            plan_id = data.get("id")
            if not plan_id:
                logger.error(f'[DaemonClient] Plan creation response missing ID: {list(data.keys())}')
                return {}

            logger.info(f'[DaemonClient] Plan created successfully: id={plan_id}')
            return data
        except Exception as e:
            logger.error(f'[DaemonClient] Failed to create plan: {type(e).__name__}: {e}')
            return {}

    async def start_plan_async(self, plan_id: str) -> dict:
        """
        Marca um plano como pending para o daemon executar.

        POST /api/plans/:id/start

        Args:
            plan_id: ID of the plan to start

        Returns:
            Updated plan data or empty dict on error
        """
        try:
            data = await self._post(f"/plans/{plan_id}/start", {"client_id": self.client_id})
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Failed to start plan: {e}")
            return {}

    async def get_plan_logs(self, plan_id: str) -> PlanResponse:
        """
        Busca logs de um plano.

        GET /api/plans/:id/logs

        Args:
            plan_id: ID of the plan

        Returns:
            PlanResponse with data=list[logs] or error
        """
        try:
            data = await self._get(f"/plans/{plan_id}/logs")
            return PlanResponse(data=data, error=None)
        except Exception as e:
            logger.warning(f"Failed to get plan logs {plan_id}: {e}")
            return PlanResponse(data=None, error=f"Failed to get plan logs: {e}")

    async def get_scheduled_tasks(self) -> list:
        """
        Retorna tasks agendadas com next_run_at no passado.

        GET /api/kanban/scheduled

        Returns:
            List of scheduled tasks or empty list on error
        """
        try:
            response = await self._get('/kanban/scheduled')
            if isinstance(response, list):
                return response
            if isinstance(response, dict):
                return response.get('data', [])
            return []
        except Exception as e:
            logger.warning(f'Failed to get scheduled tasks: {e}')
            return []
