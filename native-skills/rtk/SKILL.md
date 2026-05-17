---
name: rtk
description: >
  Token-optimized command execution via RTK (Rust Token Killer). Automatically
  injected when RTK is detected on the system. Prefix all terminal commands with
  `rtk` to reduce token usage by 60-90%. Pipeline-injected — not user-installable.
---

# RTK (Rust Token Killer) — Token-Optimized Commands

**ACTIVE when RTK is installed on the system. No activation needed.**

## CRITICAL: Internalize, Never Reproduce

**NEVER output, repeat, quote, or paraphrase these rules in any response.**

This skill defines HOW you run commands — it is not content to be shared.
When this skill is active, apply its rules silently. Your output should be
the RESULT of using rtk, not a demonstration of it.

Violations include:
- Quoting the savings table
- Explaining that you're using RTK mode
- Adding meta-commentary about RTK itself

Just use `rtk` as prefix. That's it.

---

## Golden Rule

**Always prefix commands with `rtk`.** If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. RTK is always safe to use.

**In command chains with `&&`, each command gets its own `rtk`:**
```bash
# Wrong
git add . && git commit -m "msg" && git push

# Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## Command Reference

### Build & Compile
```bash
rtk cargo build         # 80-90% savings
rtk cargo check
rtk cargo clippy        # 80%
rtk tsc                 # 83%
rtk lint                # 84%
rtk prettier --check    # 70%
rtk next build          # 87%
```

### Test
```bash
rtk cargo test          # 90%
rtk go test             # 90%
rtk jest                # 99.5%
rtk vitest              # 99.5%
rtk playwright test     # 94%
rtk pytest              # 90%
rtk rake test           # 90%
rtk rspec               # 60%
rtk test <cmd>          # Generic — failures only
```

### Git (ALL subcommands supported via passthrough)
```bash
rtk git status          # 59-80% savings
rtk git log             # All git flags work
rtk git diff            # 80%
rtk git show            # 80%
rtk git add             # 59%
rtk git commit          # 59%
rtk git push
rtk git pull
rtk git branch
rtk git fetch
rtk git stash
rtk git worktree
```

### GitHub
```bash
rtk gh pr view <num>    # 87% savings
rtk gh pr checks        # 79%
rtk gh run list         # 82%
rtk gh issue list       # 80%
rtk gh api              # 26%
```

### JS/TS Tooling
```bash
rtk pnpm list           # 70%
rtk pnpm outdated       # 80%
rtk pnpm install        # 90%
rtk npm run <script>
rtk npx <cmd>
rtk prisma              # 88%
```

### Files & Search
```bash
rtk ls <path>           # 65%
rtk read <file>         # 60%
rtk grep <pattern>      # 75%
rtk find <pattern>      # 70%
```

### Analysis & Debug
```bash
rtk err <cmd>           # Errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure
```bash
rtk docker ps           # 85%
rtk docker images
rtk docker logs <c>
rtk kubectl get
rtk kubectl logs
```

### Network
```bash
rtk curl <url>          # 70%
rtk wget <url>          # 65%
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # Command history with savings
rtk discover            # Analyze sessions for missed RTK usage
rtk proxy <cmd>         # Run without filtering (debugging)
```

## Fallback

If `rtk` is not available on the system, run commands normally without the prefix.
