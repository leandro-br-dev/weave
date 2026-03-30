# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the weave platform.

## Table of Contents

- [Plan Timeout Issues](#plan-timeout-issues)
- [Daemon Issues](#daemon-issues)
- [API Issues](#api-issues)
- [Dashboard Issues](#dashboard-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)

---

## Plan Timeout Issues

### Symptom: Plan shows as failed but actually succeeded

**Cause**: Race condition between API timeout recovery and daemon completion.

**Solution**:
1. Ensure `PLAN_TIMEOUT_MINUTES` (API) and `PLAN_TIMEOUT_SECONDS` (client) are synchronized
2. Check daemon logs for "Plan timed out" messages
3. Verify heartbeats are being sent every 30 seconds during execution
4. If the issue persists, increase the timeout values for long-running workflows

### Symptom: Plans timing out despite daemon running

**Cause**: Daemon heartbeat mechanism not working, or API is unreachable.

**Solution**:
1. Check daemon logs for "Failed to send heartbeat" errors
2. Verify API is reachable from daemon
3. Check network connectivity between daemon and API
4. Review API logs for heartbeat endpoint errors

### Symptom: Plans stuck in 'running' status

**Cause**: Daemon crashed without completing the plan.

**Solution**:
1. The API's `recoverStuckPlans()` will mark plans as failed after timeout
2. Manually stop the plan via `POST /api/plans/:id/force-stop`
3. Restart the daemon: it will reconcile and mark orphaned plans as failed
4. Re-run the plan from the dashboard

---

## Daemon Issues

### Symptom: Daemon fails to start

**Cause**: Python environment issues, missing dependencies, or incorrect configuration.

**Solution**:
1. Check Python version: `python --version` (must be 3.11+)
2. Verify dependencies: `pip install -r requirements.txt`
3. Check API token is set correctly
4. Review daemon logs for specific error messages

### Symptom: Daemon not picking up plans

**Cause**: API connection issues or authentication problems.

**Solution**:
1. Verify API is running: `curl http://localhost:3000/api/health`
2. Check authentication token matches `API_BEARER_TOKEN`
3. Check daemon logs for connection errors
4. Ensure daemon is configured to poll the correct API URL

### Symptom: Daemon crashes during execution

**Cause**: Unhandled exceptions, resource exhaustion, or Claude Code CLI issues.

**Solution**:
1. Check daemon logs for stack traces
2. Verify Claude Code CLI is installed and authenticated
3. Check system resources (memory, disk space)
4. Review task configuration for invalid parameters

---

## API Issues

### Symptom: API returns 401 Unauthorized

**Cause**: Invalid or missing authentication token.

**Solution**:
1. Verify `Authorization: Bearer <token>` header is set
2. Check token matches `API_BEARER_TOKEN` in API `.env`
3. Ensure token is not expired (if using temporary tokens)
4. Clear browser cache and cookies

### Symptom: API returns 403 Forbidden

**Cause**: Token is invalid or CORS configuration issue.

**Solution**:
1. Verify token matches exactly (no extra spaces)
2. Check `ALLOWED_ORIGINS` in API `.env`
3. Ensure origin is allowed in CORS configuration
4. Check browser console for CORS errors

### Symptom: API returns 500 Internal Server Error

**Cause**: Unhandled exception in API code.

**Solution**:
1. Check API logs for stack trace
2. Verify database is accessible
3. Check all environment variables are set
4. Review recent code changes for bugs

### Symptom: Database locked errors

**Cause**: SQLite database locked by another process.

**Solution**:
1. Stop all API instances
2. Check for stuck processes: `ps aux | grep node`
3. Remove write-ahead log: `rm api/data/database.db-wal`
4. Restart API

---

## Dashboard Issues

### Symptom: Dashboard fails to load

**Cause**: Frontend build issues or API connectivity problems.

**Solution**:
1. Check browser console for errors
2. Verify API is running and accessible
3. Clear browser cache and reload
4. Rebuild dashboard: `npm run build --workspace=dashboard`

### Symptom: Real-time updates not working

**Cause**: SSE (Server-Sent Events) connection issues.

**Solution**:
1. Check browser console for SSE errors
2. Verify firewall/proxy allows SSE connections
3. Check API logs for streaming errors
4. Ensure authentication token is passed in query string

### Symptom: Plans not appearing in dashboard

**Cause**: Filter settings or API pagination issues.

**Solution**:
1. Clear all filters
2. Refresh the page
3. Check browser network tab for API responses
4. Verify plans exist in database

---

## Database Issues

### Symptom: Database corruption

**Cause**: Improper shutdown or disk issues.

**Solution**:
1. Stop API and daemon
2. Backup database: `cp api/data/database.db api/data/database.db.backup`
3. Run integrity check: `sqlite3 api/data/database.db "PRAGMA integrity_check;"`
4. If corrupted, restore from backup or recreate schema

### Symptom: Missing tables or columns

**Cause**: Database schema out of sync with code.

**Solution**:
1. Check API logs for migration errors
2. Verify database initialization ran successfully
3. Manually run migrations if needed
4. As a last resort, drop and recreate database

---

## Authentication Issues

### Symptom: Token validation fails

**Cause**: Token mismatch or encoding issues.

**Solution**:
1. Verify token in `.env` file
2. Check for special characters that need escaping
3. Regenerate token if needed
4. Ensure no whitespace in token value

### Symptom: CORS errors in browser

**Cause**: Origin not allowed in CORS configuration.

**Solution**:
1. Check `ALLOWED_ORIGINS` in API `.env`
2. Add origin to allowed list
3. For local development, ensure localhost is allowed
4. Check proxy settings if using one

---

## Getting Help

If you're still experiencing issues after trying these solutions:

1. **Check Logs**: Review API, daemon, and dashboard logs
2. **Search Issues**: Check existing GitHub issues
3. **Create Issue**: Provide detailed error messages and logs
4. **Community**: Ask for help in discussions

### Useful Commands

```bash
# Check API health
curl http://localhost:3000/api/health

# View API logs
tail -f api/logs/app.log

# View daemon logs
tail -f client/logs/daemon.log

# Check database integrity
sqlite3 api/data/database.db "PRAGMA integrity_check;"

# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/plans
```

---

For more information, see:
- [Architecture Documentation](../architecture/ARCHITECTURE.md)
- [Testing Documentation](../testing/README.md)
