# Native Agents

This directory contains specialized sub-agents that can be used by any agent in the weave platform. Unlike skills which are task-specific tools, native agents are autonomous specialists that can handle complex workflows.

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

You are a specialized [role] agent for the weave platform.

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

```python
# Parent agent (Sonnet)
async def analyze_auth_system():
    # Delegate exploration to Haiku-optimized agent
    auth_endpoints = await call_agent('explorer', {
        'query': 'Find all authentication endpoints and middleware'
    })

    # Parent agent now does complex reasoning
    security_analysis = analyze_security_implications(auth_endpoints)
    recommendations = generate_improvements(security_analysis)

    return recommendations
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
- **Tester Agent**: Creates tests based on code analysis
- **Migrator Agent**: Handles version and framework migrations

## Contributing

When adding a new native agent:

1. Create a new file `agent-name.md` in the `native-agents/` directory
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
