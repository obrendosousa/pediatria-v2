// SOURCE: https://github.com/Kuberwastaken/claurst/blob/main/src-rust/crates/core/src/system_prompt.rs
// COMPLETE SOURCE CODE - Reference implementation for Clara v2

//! Modular system prompt assembly with caching support.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;

pub const SYSTEM_PROMPT_DYNAMIC_BOUNDARY: &str = "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";

fn section_cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn clear_system_prompt_sections() {
    if let Ok(mut cache) = section_cache().lock() {
        cache.clear();
    }
}

#[derive(Debug, Clone)]
pub struct SystemPromptSection {
    pub tag: &'static str,
    pub content: Option<String>,
    pub cache_break: bool,
}

impl SystemPromptSection {
    pub fn cached(tag: &'static str, content: impl Into<String>) -> Self {
        Self { tag, content: Some(content.into()), cache_break: false }
    }
    pub fn uncached(tag: &'static str, content: Option<impl Into<String>>) -> Self {
        Self { tag, content: content.map(|c| c.into()), cache_break: true }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum OutputStyle {
    #[default] Default,
    Explanatory,
    Learning,
    Concise,
    Formal,
    Casual,
}

impl OutputStyle {
    pub fn prompt_suffix(self) -> Option<&'static str> {
        match self {
            OutputStyle::Explanatory => Some("When explaining, be thorough and educational. Include reasoning, alternatives, pitfalls."),
            OutputStyle::Learning => Some("This user is learning. Explain concepts as you implement them. Point out patterns and best practices."),
            OutputStyle::Concise => Some("Be maximally concise. Skip preamble, summaries, filler. One sentence is better than three."),
            OutputStyle::Formal => Some("Maintain a formal, professional tone. Use precise technical language."),
            OutputStyle::Casual => Some("Use a casual, conversational tone."),
            OutputStyle::Default => None,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "explanatory" => Self::Explanatory,
            "learning" => Self::Learning,
            "concise" => Self::Concise,
            "formal" => Self::Formal,
            "casual" => Self::Casual,
            _ => Self::Default,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SystemPromptPrefix {
    Cli,
    Sdk,
    SdkPreset,
    Vertex,
    Bedrock,
    Remote,
}

impl SystemPromptPrefix {
    pub fn detect(is_non_interactive: bool, has_append_system_prompt: bool) -> Self {
        if std::env::var("ANTHROPIC_VERTEX_PROJECT_ID").is_ok() { return Self::Vertex; }
        if std::env::var("AWS_BEDROCK_MODEL_ID").is_ok() { return Self::Bedrock; }
        if std::env::var("CLAUDE_CODE_REMOTE").is_ok() { return Self::Remote; }
        if is_non_interactive {
            if has_append_system_prompt { return Self::SdkPreset; }
            return Self::Sdk;
        }
        Self::Cli
    }

    pub fn attribution_text(self) -> &'static str {
        match self {
            Self::Cli | Self::Vertex | Self::Bedrock | Self::Remote =>
                "You are Claude Code, Anthropic's official CLI for Claude.",
            Self::SdkPreset =>
                "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
            Self::Sdk =>
                "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct SystemPromptOptions {
    pub prefix: Option<SystemPromptPrefix>,
    pub is_non_interactive: bool,
    pub has_append_system_prompt: bool,
    pub output_style: OutputStyle,
    pub custom_output_style_prompt: Option<String>,
    pub working_directory: Option<String>,
    pub memory_content: String,
    pub custom_system_prompt: Option<String>,
    pub append_system_prompt: Option<String>,
    pub replace_system_prompt: bool,
    pub coordinator_mode: bool,
    pub skip_env_info: bool,
}

/// Build the complete system prompt string.
/// Contains SYSTEM_PROMPT_DYNAMIC_BOUNDARY splitting cacheable vs dynamic parts.
pub fn build_system_prompt(opts: &SystemPromptOptions) -> String {
    // Replace mode: skip all default sections
    if opts.replace_system_prompt {
        if let Some(custom) = &opts.custom_system_prompt {
            return format!("{}\n\n{}", custom, SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
        }
    }

    let prefix = opts.prefix.unwrap_or_else(|| {
        SystemPromptPrefix::detect(opts.is_non_interactive, opts.has_append_system_prompt)
    });

    let mut parts: Vec<String> = Vec::new();

    // === CACHEABLE sections (before boundary) ===

    // 1. Attribution
    parts.push(prefix.attribution_text().to_string());
    // 2. Core capabilities
    parts.push(CORE_CAPABILITIES.to_string());
    // 3. Tool use guidelines
    parts.push(TOOL_USE_GUIDELINES.to_string());
    // 4. Actions section
    parts.push(ACTIONS_SECTION.to_string());
    // 5. Safety
    parts.push(SAFETY_GUIDELINES.to_string());
    // 6. Security
    parts.push(CYBER_RISK_INSTRUCTION.to_string());
    // 7. Output style
    if let Some(style_text) = opts.custom_output_style_prompt.as_deref()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| opts.output_style.prompt_suffix())
    {
        parts.push(format!("\n## Output Style\n{}", style_text));
    }
    // 8. Coordinator mode
    if opts.coordinator_mode {
        parts.push(COORDINATOR_SYSTEM_PROMPT.to_string());
    }
    // 9. Custom system prompt
    if let Some(custom) = &opts.custom_system_prompt {
        parts.push(format!("\n<custom_instructions>\n{}\n</custom_instructions>", custom));
    }

    // === DYNAMIC BOUNDARY ===
    parts.push(SYSTEM_PROMPT_DYNAMIC_BOUNDARY.to_string());

    // === DYNAMIC sections (after boundary) ===

    // 10. Environment info
    if !opts.skip_env_info {
        parts.push(build_env_info_section(opts.working_directory.as_deref()));
    }
    // 11. Working directory
    if let Some(cwd) = &opts.working_directory {
        parts.push(format!("\n<working_directory>{}</working_directory>", cwd));
    }
    // 12. Memory
    if !opts.memory_content.is_empty() {
        parts.push(format!("\n<memory>\n{}\n</memory>", opts.memory_content));
    }
    // 13. Append system prompt
    if let Some(append) = &opts.append_system_prompt {
        parts.push(format!("\n{}", append));
    }

    parts.join("\n")
}

fn build_env_info_section(working_dir: Option<&str>) -> String {
    let platform = if cfg!(target_os = "windows") { "win32" }
        else if cfg!(target_os = "macos") { "darwin" }
        else { "linux" };

    let shell_env = std::env::var("SHELL").unwrap_or_default();
    let shell_name = if shell_env.contains("zsh") { "zsh" }
        else if shell_env.contains("bash") { "bash" }
        else if cfg!(target_os = "windows") { "powershell" }
        else { "unknown" };

    let is_git = working_dir
        .map(|d| std::path::Path::new(d).join(".git").exists())
        .unwrap_or(false);

    let cwd_line = working_dir.map(|d| format!("\nWorking directory: {}", d)).unwrap_or_default();

    format!(
        "\n<env>{}\nIs directory a git repo: {}\nPlatform: {}\nShell: {}\n</env>",
        cwd_line,
        if is_git { "Yes" } else { "No" },
        platform,
        shell_name,
    )
}

const CORE_CAPABILITIES: &str = r#"
## Capabilities
- Read/Write files, Execute commands, Search (glob, grep, web)
- Spawn parallel sub-agents, Persistent memory, MCP servers
"#;

const TOOL_USE_GUIDELINES: &str = r#"
## Tool use guidelines
- Use dedicated tools (Read, Edit, Glob, Grep) instead of bash equivalents
- Parallelize independent tool calls in a single response
- For file edits: always read first, then make targeted edits
"#;

const ACTIONS_SECTION: &str = r#"
## Executing actions with care
Carefully consider reversibility and blast radius. For hard-to-reverse, shared-state,
or risky actions, check with the user before proceeding.
"#;

const SAFETY_GUIDELINES: &str = r#"
## Safety
- Never delete files without confirmation
- Don't modify protected files (.gitconfig, .bashrc, etc.)
- Don't commit secrets or credentials
"#;

const CYBER_RISK_INSTRUCTION: &str = r#"
## Security
Assist with authorized security testing and defensive security. Do not assist with
malware, unauthorized access, or destructive techniques.
"#;

const COORDINATOR_SYSTEM_PROMPT: &str = r#"
## Coordinator Mode
You are operating as an orchestrator. Spawn parallel worker agents using the Agent tool.
Each worker prompt must be fully self-contained. Synthesize findings before delegating.
"#;
