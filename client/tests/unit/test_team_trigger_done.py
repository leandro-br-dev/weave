"""
Unit tests for terminal-column reconciliation in handle_team_completion.

Regression: a task moved to `done` manually (dashboard patches column without
pipeline_status) used to hit the "No gate defined for column done" fallback and
return without updating pipeline_status — the daemon then re-selected it every
5s forever. handle_team_completion must reconcile and stop.
"""

from unittest.mock import AsyncMock, patch

import pytest

from orchestrator import team_trigger


PROJECT_ID = 'proj-1'
TASK_ID = 'task-1'


def _make_client() -> AsyncMock:
    client = AsyncMock()
    client._put = AsyncMock(return_value={'data': {}, 'error': None})
    client._post = AsyncMock(return_value={'data': {'id': 'rework-1'}, 'error': None})
    return client


def _make_task(column: str, pipeline_status: str = 'running') -> dict:
    return {
        'id': TASK_ID,
        'title': 'Sample task',
        'description': 'Do the thing',
        'column': column,
        'pipeline_status': pipeline_status,
        'workflow_id': 'wf-1',
    }


async def _run(task: dict, plan: dict, client: AsyncMock, settings: dict | None = None):
    await team_trigger.handle_team_completion(
        task=task,
        plan=plan,
        project_settings=settings or {},
        project_id=PROJECT_ID,
        client=client,
    )


class TestTerminalColumnReconciliation:

    @pytest.mark.asyncio
    async def test_done_column_with_stale_running_reconciles(self):
        """done + running + success plan → single reconciliation PUT, idempotent."""
        client = _make_client()
        task = _make_task('done', pipeline_status='running')
        plan = {'status': 'success', 'result_status': None, 'result_notes': ''}

        await _run(task, plan, client)

        assert client._put.await_count == 1
        url, payload = client._put.await_args.args
        assert url == f'/kanban/{PROJECT_ID}/{TASK_ID}'
        assert payload['pipeline_status'] == 'done'
        assert payload['result_status'] == 'success'
        assert payload['error_message'] == ''

        # Second invocation with the same stale task still issues exactly one
        # PUT (reconciliation is bounded per poll — the real daemon stops
        # re-selecting once pipeline_status becomes 'done').
        client._put.reset_mock()
        await _run(task, plan, client)
        assert client._put.await_count == 1

    @pytest.mark.asyncio
    async def test_done_column_needs_rework_skips_reconciliation(self):
        """needs_rework wins before terminal reconciliation — rework path runs."""
        client = _make_client()
        task = _make_task('done', pipeline_status='running')
        plan = {
            'status': 'success',
            'result_status': 'needs_rework',
            'result_notes': 'not good enough',
            'name': 'Plan X',
        }

        with patch.object(
            team_trigger, '_handle_needs_rework', new=AsyncMock()
        ) as mock_rework:
            await _run(task, plan, client)

        mock_rework.assert_awaited_once_with(task, plan, PROJECT_ID, client)
        client._put.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_validation_column_still_uses_gate(self):
        """No regression: success at validation goes through gate lookup/advance."""
        client = _make_client()
        task = _make_task('validation', pipeline_status='running')
        plan = {'status': 'success', 'result_status': None, 'result_notes': ''}

        await _run(task, plan, client, settings={'auto_advance_staging_to_done': True})

        assert client._put.await_count == 1
        url, payload = client._put.await_args.args
        assert url == f'/kanban/{PROJECT_ID}/{TASK_ID}'
        assert payload['column'] == 'done'
        assert payload['pipeline_status'] == 'done'
