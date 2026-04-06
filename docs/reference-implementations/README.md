# Reference Implementations (Claude Code / claurst)

Source: https://github.com/Kuberwastaken/claurst

These are Rust source files from the Claude Code reverse-engineering project.
We use them as architectural reference for Clara v2 - NOT as direct ports.

## Files (Complete Source Code)

| File | What it does | Our adaptation |
|---|---|---|
| `coordinator.rs` | AgentMode enum, tool filtering, coordinator system prompt, scratchpad gate | `tool_registry.ts` + CEO Agent system prompt |
| `send_message.rs` | DashMap inbox, broadcast, directed messages | `clara_agent_messages` table (Supabase, not in-memory) |
| `system_prompt.rs` | 2-zone prompt (cacheable/dynamic), OutputStyle, env injection | `system_prompt.ts` with brain files + vault context |
| `effort.rs` | 4-tier effort levels with thinking budget + temperature | Model selection (Pro/Flash/Flash Lite) |

## Architecture Specs (from earlier research, not saved as files)

| Component | Key patterns we're adapting |
|---|---|
| `agent_tool.rs` | Sub-agent spawning: fresh message list, filtered tools, max_turns, cancellation |
| `tasks.rs` | TaskStore with CRUD, dependencies (blocks/blocked_by), status lifecycle |
| `auto_dream.rs` | 3-gate system (time/sessions/lock), 4-phase consolidation, file-based mutex |
| `session_memory.rs` | Memory extraction after 20+ msgs, MEMORY: category|confidence|fact format |
| `query loop (lib.rs)` | Stream -> tool_use -> execute -> loop, context compaction, hooks |
| `tools lib (lib.rs)` | Tool trait, PermissionLevel enum, ToolContext, all_tools() registry |
| `memdir.rs` | Memory directory with frontmatter, relevance selection, freshness warnings |

## How to use these references

1. Read the Rust code to understand the PATTERN
2. Implement in TypeScript/LangGraph for our stack
3. Replace in-memory stores (DashMap) with Supabase tables
4. Replace file-based locks with Supabase advisory locks
5. Replace Anthropic API calls with Google Gemini API calls
