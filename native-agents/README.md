# Native Agents

This directory contains specialized sub-agents that can be used by any agent. Unlike skills which are task-specific tools, native agents are autonomous specialists that can handle complex workflows.

## What are Native Agents?

Native agents are pre-configured, specialized agents that:
- Are optimized for specific types of work
- Use appropriate models for their tasks (e.g., Haiku for file reading)
- Follow established patterns and workflows
- Can be invoked by parent agents as needed

## Available Native Agents

### Explorer Agent

**Purpose**: Efficiently explore codebases and extract relevant information.

**When to Use**:
- Understanding codebase structure
- Finding specific implementations
- Locating configuration details
- Extracting relevant code patterns
- Understanding API endpoints
- Finding function definitions

**Model**: Optimized for Haiku (cost-effective file reading)

**File**: `explorer.md`

**Key Characteristics**:
- Surgical precision - reads only what's needed
- Extracts exact wording (no paraphrasing)
- Always sources findings with file paths and line numbers
- Discards irrelevant content automatically
- Returns organized, concise results

**Usage**: See `explorer.md` for detailed documentation and usage examples

---

### Plan Analyst Agent

**Purpose**: Explore and analyze the codebase to build a comprehensive understanding before planning changes. Read-only analysis that maps components, traces dependencies, and identifies patterns.

**When to Use**:
- Understanding the current codebase state before making changes
- Mapping dependencies for a specific feature or component
- Identifying which files are affected by a proposed change
- Discovering existing patterns and conventions to follow
- Tracing data flows from API endpoint to database

**Model**: Optimized for Haiku (cost-effective read-only analysis)

**File**: `plan/analyst.md`

**Key Characteristics**:
- Strictly read-only — never modifies anything
- Maps components with location, type, dependencies, and relationships
- Identifies conventions, patterns, and architectural decisions
- Traces dependency chains and data flows
- Returns structured analysis report for the architect agent

**Usage**: See `plan/analyst.md` for detailed documentation

---

### Plan Architect Agent

**Purpose**: Evaluate the impact of requested changes, design the technical approach, and produce a comprehensive architectural specification.

**When to Use**:
- Evaluating the impact of a new feature or change
- Designing the technical approach for implementation
- Identifying which files need to be created, modified, or deleted
- Assessing risks and potential breaking changes
- Defining API contracts, data models, or interface changes

**Model**: Optimized for Sonnet (deep reasoning); use Opus for critical infrastructure changes

**File**: `plan/architect.md`

**Key Characteristics**:
- Impact-first thinking — assesses blast radius before designing solutions
- Specifies exact files, functions, types, and interfaces
- Aligns with existing codebase conventions
- Produces detailed risk assessment with mitigations
- Returns structured architectural specification for the planner agent

**Usage**: See `plan/architect.md` for detailed documentation

---

### Plan Planner Agent

**Purpose**: Translate codebase analysis and architectural specifications into a structured, dependency-ordered execution plan (JSON) with tasks that can be executed sequentially or in parallel.

**When to Use**:
- Translating a feature request into an actionable step-by-step plan
- Breaking a large change into manageable implementation tasks
- Ordering work to respect code dependencies
- Identifying opportunities for parallel execution
- Creating structured plans that implementation agents can follow

**Model**: Optimized for Sonnet (structured reasoning and planning)

**File**: `plan/planner.md`

**Key Characteristics**:
- Produces a JSON execution plan with atomic, well-scoped tasks
- Orders tasks by dependency (DAG — directed acyclic graph)
- Identifies parallel execution opportunities
- Includes acceptance criteria and verification for every task
- Covers risk assessment and rollback plan

**Usage**: See `plan/planner.md` for detailed documentation

---

### Backend Developer Agent

**Purpose**: Implement backend features including API endpoints, database operations, business logic services, and server-side code.

**When to Use**:
- Creating new route handlers
- Implementing business logic services
- Writing database queries or repositories
- Adding or modifying middleware
- Creating backend types and interfaces
- Writing backend unit tests

**Model**: Optimized for Sonnet (structured implementation reasoning)

**File**: `dev/backend-dev.md`

**Key Characteristics**:
- Convention-first — matches existing codebase patterns exactly
- Type-safe — every function and return value is properly typed
- Test-driven — writes or updates tests alongside implementation
- Runs local tests to validate changes before completion

**Usage**: See `dev/backend-dev.md` for detailed documentation

---

### Frontend Developer Agent

**Purpose**: Implement UI features including components, styling, responsive layouts, state management, and client-side code.

**When to Use**:
- Creating new UI components or pages
- Implementing UI features and interactions
- Styling with the project's CSS approach
- Working with state management
- Adding internationalization
- Creating responsive layouts

**Model**: Optimized for Sonnet (structured implementation reasoning)

**File**: `dev/frontend-dev.md`

**Key Characteristics**:
- Consistency-first — matches existing visual patterns exactly
- Component-driven — reuses existing UI primitives
- Responsive by default — every layout works on all screen sizes
- Accessible — uses semantic markup and ARIA attributes

**Usage**: See `dev/frontend-dev.md` for detailed documentation

---

### Quality Engineer Agent (Shift-Left Tester)

**Purpose**: Run quality gates including type checking, linting, and validation to catch issues before code reaches a pull request.

**When to Use**:
- Validating code changes before creating a PR
- Running type checks on modified files
- Checking for linting issues and unused imports
- Verifying test coverage for modified code
- Running a pre-commit quality gate

**Model**: Optimized for Haiku (fast, cost-effective quality gates)

**File**: `dev/tester.md`

**Key Characteristics**:
- Runs mandatory type check and linter checks
- Catches type errors, unused imports, and style issues
- Auto-fixes trivial issues (unused imports, formatting)
- Returns structured quality report with severity levels

**Usage**: See `dev/tester.md` for detailed documentation

---

### Git Expert Agent

**Purpose**: Manage Git workflows including creating feature branches, making semantic commits, and opening pull requests.

**When to Use**:
- Creating a new feature branch (`feature/xxx`)
- Making a semantic commit with staged changes
- Opening a pull request to main
- Checking Git status and recent history
- Managing branch operations

**Model**: Optimized for Haiku (fast, cost-effective Git operations)

**File**: `dev/git-expert.md`

**Key Characteristics**:
- Follows Conventional Commits specification
- Creates feature branches with naming convention (`feature/xxx`)
- Stages files precisely — never uses `git add -A`
- Generates clear PR descriptions with context

**Usage**: See `dev/git-expert.md` for detailed documentation

---

### Development Pipeline

The plan agents produce the execution plan, and the dev agents implement it:

```
Task Request
    ↓
Plan Analyst (Haiku)
  → Codebase Analysis Report
    ↓
Plan Architect (Sonnet/Opus)
  → Architectural Specification
    ↓
Plan Planner (Sonnet)
  → JSON Execution Plan
    ↓
Backend Dev (Sonnet) / Frontend Dev (Sonnet)
  → Implement tasks from the plan
    ↓
Quality Engineer (Haiku)
  → Type check + Linter + Validation
    ↓
Git Expert (Haiku)
  → Branch → Commit → Push → PR
    ↓
Review & Merge
```

## How Native Agents Work

### Architecture

```
Parent Agent (Sonnet/Opus)
    ↓
  Delegates task
    ↓
Native Agent (Haiku/Sonnet)
    ↓
  Executes specialized workflow
    ↓
  Returns focused results
    ↓
Parent Agent continues work
```

### Benefits

1. **Cost Optimization**: Use cheaper models for routine tasks
2. **Specialization**: Each agent is optimized for its purpose
3. **Consistency**: Standardized workflows for common tasks
4. **Efficiency**: Parent agents focus on high-level reasoning
5. **Maintainability**: Centralized expertise and patterns

## Creating New Native Agents

When creating a new native agent:

1. **Define the Purpose**: What specific problem does it solve?
2. **Choose the Model**: Which model is optimal for this work?
3. **Document the Workflow**: Clear steps for how it operates
4. **Provide Examples**: Show how to use the agent effectively
5. **Define Output Format**: Structured, predictable results

### Template Structure

```
native-agents/
├── agent-name.md         # Single-file agent definition
├── plan/                 # Planning sub-agents (pipeline)
│   ├── analyst.md        # Codebase analysis (Haiku)
│   ├── architect.md      # Architectural specification (Sonnet/Opus)
│   └── planner.md        # Execution plan generation (Sonnet)
├── dev/                  # Development sub-agents (implementation)
│   ├── backend-dev.md    # Backend developer (Sonnet)
│   ├── frontend-dev.md   # Frontend developer (Sonnet)
│   ├── tester.md         # Quality engineer / shift-left tester (Haiku)
│   └── git-expert.md     # Git workflow specialist (Haiku)
├── staging/              # Staging sub-agents (quality gates)
│   ├── pr-handler.md     # PR decision orchestrator (Sonnet)
│   ├── code-reviewer.md  # Code review specialist (Sonnet)
│   └── build-validator.md # Build validation gate (Haiku)
└── README.md             # This file
```

### Agent File Template

Each native agent is a SINGLE markdown file named `agent-name.md` with the following format:

```markdown
---
name: agent-name
description: "Describe when to invoke this agent"
model: sonnet
tools: Read, Write, Edit, Bash, Glob
color: blue
---

# Agent Name

You are a specialized [role] agent.

## Your Purpose

[Clear description of what this agent does]

## Your Process

1. **Step 1**: [Description]
2. **Step 2**: [Description]
3. **Step 3**: [Description]

## Key Principles

- **Principle 1**: [Description]
- **Principle 2**: [Description]

## When to Use This Agent

Parent agents should delegate to you when they need:
- Use case 1
- Use case 2
- Use case 3

## Your Tools

[List available tools and their usage]

## Output Format

[Specify structured output format]

## Optimization Rules

[Performance and cost optimization guidelines]

## What NOT To Do

- ❌ Don't do X
- ❌ Don't do Y

## Special Instructions

[Any special considerations]
```

## Integration with Parent Agents

### Delegation Pattern

Parent agents should delegate work to native agents when:

1. **Task is well-defined**: Clear scope and expected output
2. **Specialized skill is needed**: Leverage agent's expertise
3. **Cost optimization is important**: Use cheaper models
4. **Parallel execution**: Multiple agents can work simultaneously

### Example Delegation

```
# Parent agent delegates exploration to Haiku-optimized agent
auth_endpoints = await call_agent('explorer', {
    'query': 'Find all authentication endpoints and middleware'
})

# Parent agent now does complex reasoning on the results
security_analysis = analyze_security_implications(auth_endpoints)
recommendations = generate_improvements(security_analysis)
```

## Comparison: Native Agents vs Skills

| Aspect | Native Agents | Skills |
|--------|--------------|---------|
| **Purpose** | Autonomous specialists | Task-specific tools |
| **Autonomy** | High - manages own workflow | Low - follows instructions |
| **Model Choice** | Optimized per agent | Uses parent agent's model |
| **Use Case** | Complex workflows | Specific operations |
| **Example** | Explorer (codebase search) | PDF reader (file parsing) |

## Best Practices

### For Parent Agents

1. **Use When Appropriate**: Delegate well-defined, specialized tasks
2. **Provide Context**: Give enough information for the agent to succeed
3. **Combine Results**: Integrate outputs from multiple agents
4. **Add Value**: Don't just forward - analyze and enhance results

### For Native Agents

1. **Stay Focused**: Don't expand beyond your specialty
2. **Be Efficient**: Optimize for speed and cost
3. **Source Everything**: Always provide traceable references
4. **Handle Errors**: Gracefully report issues without failing

### For Developers

1. **Keep It Simple**: Each agent should do one thing well
2. **Document Well**: Clear usage examples and guidelines
3. **Test Thoroughly**: Verify agent behavior across scenarios
4. **Iterate**: Improve based on real-world usage

## Future Native Agents

Potential native agents that could be created:

- **Debugger Agent**: Specialized in tracing errors and stack traces
- **Refactorer Agent**: Optimized for code refactoring patterns
- **Documenter Agent**: Generates documentation from code
- **Migrator Agent**: Handles version and framework migrations

## Contributing

When adding a new native agent:

1. Create a new file `agent-name.md` in the appropriate subdirectory
2. Follow the single-file template above with frontmatter metadata
3. Include comprehensive documentation in the agent description
4. Update this README to list the new agent
5. Test with various parent agent scenarios

## Support

For questions or issues with native agents:
- Check the agent's documentation file (e.g., `explorer.md`)
- Review the agent's workflow section
- Consult the parent agent documentation
- Open an issue with specific use case
