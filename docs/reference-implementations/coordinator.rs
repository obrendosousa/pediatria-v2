// SOURCE: https://github.com/Kuberwastaken/claurst/blob/main/src-rust/crates/query/src/coordinator.rs
// COMPLETE SOURCE CODE - Reference implementation for Clara v2

//! Coordinator mode: multi-worker agent orchestration

pub const COORDINATOR_ENV_VAR: &str = "CLAUDE_CODE_COORDINATOR_MODE";

/// Tools that belong exclusively to the coordinator — not exposed to workers.
pub const COORDINATOR_ONLY_TOOLS: &[&str] = &[
    "Agent",
    "SendMessage",
    "TaskStop",
    "TeamCreate",
    "TeamDelete",
    "SyntheticOutput",
];

/// Tools that workers are allowed to use in simple mode (CLAUDE_CODE_SIMPLE=1).
pub const WORKER_SIMPLE_TOOLS: &[&str] = &["Bash", "Read", "Edit"];

/// Tools explicitly banned in coordinator mode (coordinator delegates these to workers).
pub const COORDINATOR_BANNED_TOOLS: &[&str] = &[
    "Bash",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentMode {
    Coordinator,
    Worker,
    Normal,
}

pub fn is_coordinator_mode() -> bool {
    std::env::var(COORDINATOR_ENV_VAR)
        .map(|v| !v.is_empty() && v != "0" && v != "false")
        .unwrap_or(false)
}

pub fn coordinator_system_prompt() -> &'static str {
    r#"
## Coordinator Mode

You are operating as an orchestrator for parallel worker agents.

### Your Role
- Orchestrate workers using the Agent tool to spawn parallel subagents
- Use SendMessage to continue communication with running workers
- Use TaskStop to cancel workers that are no longer needed
- Synthesize findings across workers before presenting to the user
- Answer directly when the question doesn't need delegation

### Task Workflow
1. **Research Phase**: Spawn workers to gather information in parallel
2. **Synthesis Phase**: Collect and merge worker findings
3. **Implementation Phase**: Delegate implementation tasks to specialized workers
4. **Verification Phase**: Spawn verification workers to validate results

### Worker Guidelines
- Worker prompts must be fully self-contained (workers cannot see your conversation)
- Always synthesize findings before spawning follow-up workers
- Workers have access to all standard tools + MCP + skills
- Use TaskCreate/TaskUpdate to track parallel work

### Internal Tools (do not delegate to workers)
- Agent, SendMessage, TaskStop (coordination only)
"#
}

pub const INTERNAL_COORDINATOR_TOOLS: &[&str] = COORDINATOR_ONLY_TOOLS;

// Scratchpad gate

pub struct ScratchpadGate {
    unlocked: bool,
    unlock_signal: Option<String>,
}

impl ScratchpadGate {
    pub fn new() -> Self {
        Self { unlocked: false, unlock_signal: None }
    }

    pub fn with_signal(signal: impl Into<String>) -> Self {
        Self { unlocked: false, unlock_signal: Some(signal.into()) }
    }

    pub fn check(&self, tool_name: &str) -> bool {
        const GATED: &[&str] = &["Write", "FileWrite", "Edit", "FileEdit"];
        if GATED.contains(&tool_name) { return self.unlocked; }
        true
    }

    pub fn try_unlock(&mut self, content: &str) -> bool {
        if self.unlocked { return true; }
        if let Some(ref signal) = self.unlock_signal {
            if content.contains(signal.as_str()) {
                self.unlocked = true;
                return true;
            }
        }
        false
    }

    pub fn is_unlocked(&self) -> bool { self.unlocked }
}

impl Default for ScratchpadGate {
    fn default() -> Self { Self::new() }
}

// Tool filtering

pub fn filter_tools_for_mode<'a>(
    tools: &'a [Box<dyn cc_tools::Tool>],
    mode: AgentMode,
) -> Vec<&'a Box<dyn cc_tools::Tool>> {
    match mode {
        AgentMode::Coordinator | AgentMode::Normal => tools.iter().collect(),
        AgentMode::Worker => tools
            .iter()
            .filter(|t| !COORDINATOR_ONLY_TOOLS.contains(&t.name()))
            .collect(),
    }
}

pub fn coordinator_user_context(available_tools: &[String], mcp_servers: &[String]) -> String {
    let tool_list = available_tools
        .iter()
        .filter(|t| !INTERNAL_COORDINATOR_TOOLS.contains(&t.as_str()))
        .cloned()
        .collect::<Vec<_>>()
        .join(", ");

    let mcp_section = if mcp_servers.is_empty() {
        String::new()
    } else {
        format!("\nConnected MCP servers: {}", mcp_servers.join(", "))
    };

    format!("Available worker tools: {}{}\n", tool_list, mcp_section)
}

pub fn match_session_mode(stored_coordinator: bool) -> Option<String> {
    let current = is_coordinator_mode();
    if stored_coordinator == current { return None; }
    if stored_coordinator {
        std::env::set_var(COORDINATOR_ENV_VAR, "1");
        Some("Entered coordinator mode to match resumed session.".to_string())
    } else {
        std::env::remove_var(COORDINATOR_ENV_VAR);
        Some("Exited coordinator mode to match resumed session.".to_string())
    }
}
