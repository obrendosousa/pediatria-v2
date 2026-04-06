// app.rs — App state struct and main event loop.

use crate::bridge_state::BridgeConnectionState;
use crate::dialogs::PermissionRequest;
use crate::diff_viewer::{DiffViewerState, build_turn_diff};
use crate::model_picker::ModelPickerState;
use crate::session_browser::SessionBrowserState;
use crate::dialogs::McpApprovalDialogState;
use crate::mcp_view::{McpServerView, McpToolView, McpViewState, McpViewStatus};
use crate::notifications::{NotificationKind, NotificationQueue};
use crate::overlays::{
    GlobalSearchState, HelpOverlay, HistorySearchOverlay, MessageSelectorOverlay,
    RewindFlowOverlay, SelectorMessage,
};
use crate::plugin_views::PluginHintBanner;
use crate::privacy_screen::PrivacyScreen;
use crate::prompt_input::{InputMode, PromptInputState, VimMode};
use crate::render;
use crate::settings_screen::SettingsScreen;
use crate::stats_dialog::StatsDialogState;
use crate::theme_screen::ThemeScreen;
use crate::{agents_view::{AgentInfo, AgentStatus, AgentsMenuState, AgentsRoute}, diff_viewer::DiffPane};
use cc_core::config::{Config, Settings, Theme};
use cc_core::cost::CostTracker;
use cc_core::file_history::FileHistory;
use cc_core::keybindings::{
    KeyContext, KeybindingResolver, KeybindingResult, ParsedKeystroke, UserKeybindings,
};
use cc_core::types::{Message, Role};
use cc_query::QueryEvent;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;
use std::cell::Cell;
use std::io::Stdout;
use std::sync::{Arc, Mutex};
use tracing::debug;

const PROMPT_SLASH_COMMANDS: &[(&str, &str)] = &[
    ("agents", "Browse agent definitions and active agents"),
    ("changes", "Inspect changes from the current session"),
    ("clear", "Clear the conversation transcript"),
    ("compact", "Compact the conversation context"),
    ("config", "Open settings"),
    ("copy", "Copy the last assistant response to clipboard"),
    ("cost", "Show cost breakdown"),
    ("diff", "Inspect the current git diff"),
    ("doctor", "Run diagnostics"),
    ("effort", "Set effort level (low/medium/high/max)"),
    ("exit", "Quit Claude Code"),
    ("export", "Export conversation"),
    ("fast", "Toggle fast mode"),
    ("feedback", "Open session feedback survey"),
    ("help", "Show help"),
    ("hooks", "Browse configured hooks (read-only)"),
    ("init", "Initialize CLAUDE.md for this project"),
    ("keybindings", "Show keybinding configuration"),
    ("login", "Log in to Claude"),
    ("logout", "Log out of Claude"),
    ("mcp", "Browse configured MCP servers"),
    ("memory", "Browse and open CLAUDE.md memory files"),
    ("model", "Change the AI model"),
    ("output-style", "Toggle output style (auto/stream/verbose)"),
    ("privacy", "Open privacy settings"),
    ("quit", "Quit Claude Code"),
    ("rename", "Rename this session"),
    ("resume", "Resume a previous session"),
    ("review", "Review changes (git diff)"),
    ("rewind", "Rewind to an earlier turn"),
    ("session", "Browse and manage sessions"),
    ("settings", "Open settings"),
    ("stats", "Open token and cost stats"),
    ("survey", "Open session feedback survey"),
    ("theme", "Open the theme picker"),
    ("vim", "Toggle vim keybindings"),
    ("voice", "Toggle voice input mode"),
];

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/// Effort level indicator shown in the status bar.
#[derive(Debug, Clone, PartialEq)]
pub enum EffortLevel {
    Low,    // ○
    Medium, // ◐
    High,   // ●
    Max,    // ◉  (Opus 4.6 only)
}

impl Default for EffortLevel {
    fn default() -> Self {
        Self::High
    }
}

/// Visual style for inline system messages in the conversation pane.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SystemMessageStyle {
    Info,
    Warning,
    /// Compact / auto-compact boundary marker.
    Compact,
}

/// A synthetic system annotation inserted between conversation messages.
/// `after_index` is the index in `App::messages` after which this annotation
/// should appear (0 = before all messages, 1 = after message 0, etc.).
#[derive(Debug, Clone)]
pub struct SystemAnnotation {
    pub after_index: usize,
    pub text: String,
    pub style: SystemMessageStyle,
}

/// A displayable item in the conversation pane — either a real message or
/// a synthetic system annotation (e.g. compact boundary).
/// Used only by `render.rs`; constructed on the fly from `messages` +
/// `system_annotations`.
#[derive(Debug, Clone)]
pub enum DisplayMessage {
    /// A real conversation turn.
    Conversation(Message),
    /// An injected system notice (e.g. compact boundary).
    System { text: String, style: SystemMessageStyle },
}

/// Status of an active or completed tool call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ToolStatus {
    Running,
    Done,
    Error,
}

/// Represents an active or completed tool invocation visible in the UI.
#[derive(Debug, Clone)]
pub struct ToolUseBlock {
    pub id: String,
    pub name: String,
    pub status: ToolStatus,
    pub output_preview: Option<String>,
    /// JSON-serialised input for the tool call (populated from the API stream).
    pub input_json: String,
}

/// State for Ctrl+R history search mode (legacy inline struct, kept for test
/// compatibility — the overlay version lives in `overlays::HistorySearchOverlay`).
#[derive(Debug, Clone)]
pub struct HistorySearch {
    pub query: String,
    /// Indices into `input_history` that match the current query.
    pub matches: Vec<usize>,
    /// Which match is currently highlighted.
    pub selected: usize,
}

impl HistorySearch {
    pub fn new() -> Self {
        Self {
            query: String::new(),
            matches: Vec::new(),
            selected: 0,
        }
    }

    /// Re-compute matches against the given history slice.
    pub fn update_matches(&mut self, history: &[String]) {
        let q = self.query.to_lowercase();
        self.matches = history
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                if s.to_lowercase().contains(&q) {
                    Some(i)
                } else {
                    None
                }
            })
            .collect();
        // Clamp selected to valid range
        if !self.matches.is_empty() && self.selected >= self.matches.len() {
            self.selected = self.matches.len() - 1;
        }
    }

    /// Return the currently selected history entry, if any.
    pub fn current_entry<'a>(&self, history: &'a [String]) -> Option<&'a str> {
        self.matches
            .get(self.selected)
            .and_then(|&i| history.get(i))
            .map(String::as_str)
    }
}

/// Attempt to copy text to the system clipboard using platform CLI tools.
/// Returns true if successful.
fn try_copy_to_clipboard(text: &str) -> bool {
    // Windows
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        if let Ok(mut child) = std::process::Command::new("clip")
            .stdin(std::process::Stdio::piped())
            .spawn()
        {
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(text.as_bytes());
            }
            return child.wait().map(|s| s.success()).unwrap_or(false);
        }
    }
    // macOS
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        if let Ok(mut child) = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
        {
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(text.as_bytes());
            }
            return child.wait().map(|s| s.success()).unwrap_or(false);
        }
    }
    // Linux / X11
    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        for cmd in &["xclip -selection clipboard", "xsel --clipboard --input"] {
            let parts: Vec<&str> = cmd.split_whitespace().collect();
            if let Some((prog, args)) = parts.split_first() {
                if let Ok(mut child) = std::process::Command::new(prog)
                    .args(args)
                    .stdin(std::process::Stdio::piped())
                    .spawn()
                {
                    if let Some(stdin) = child.stdin.as_mut() {
                        let _ = stdin.write_all(text.as_bytes());
                    }
                    if child.wait().map(|s| s.success()).unwrap_or(false) {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn key_event_to_keystroke(key: &KeyEvent) -> Option<ParsedKeystroke> {
    let normalized_key = match key.code {
        KeyCode::Backspace => "backspace".to_string(),
        KeyCode::Delete => "delete".to_string(),
        KeyCode::Down => "down".to_string(),
        KeyCode::End => "end".to_string(),
        KeyCode::Enter => "enter".to_string(),
        KeyCode::Esc => "escape".to_string(),
        KeyCode::Home => "home".to_string(),
        KeyCode::Left => "left".to_string(),
        KeyCode::PageDown => "pagedown".to_string(),
        KeyCode::PageUp => "pageup".to_string(),
        KeyCode::Right => "right".to_string(),
        KeyCode::Tab => "tab".to_string(),
        KeyCode::Up => "up".to_string(),
        KeyCode::BackTab => "tab".to_string(),
        KeyCode::Char(' ') => "space".to_string(),
        KeyCode::Char(c) => c.to_lowercase().to_string(),
        _ => return None,
    };

    Some(ParsedKeystroke {
        key: normalized_key,
        ctrl: key.modifiers.contains(KeyModifiers::CONTROL),
        alt: key.modifiers.contains(KeyModifiers::ALT),
        shift: key.modifiers.contains(KeyModifiers::SHIFT),
        meta: key.modifiers.contains(KeyModifiers::SUPER),
    })
}

// ---------------------------------------------------------------------------
// App struct
// ---------------------------------------------------------------------------

/// The top-level TUI application.
pub struct App {
    // Core state
    pub config: Config,
    pub cost_tracker: Arc<CostTracker>,
    pub messages: Vec<Message>,
    /// Combined display list kept in sync with `messages`: real conversation turns
    /// plus injected system annotations. Used by the renderer so it can iterate
    /// a single sequence instead of merging two lists on every frame.
    pub display_messages: Vec<DisplayMessage>,
    /// Synthetic system annotations interleaved between real messages at render time.
    pub system_annotations: Vec<SystemAnnotation>,
    pub input: String,
    pub prompt_input: PromptInputState,
    pub input_history: Vec<String>,
    pub history_index: Option<usize>,
    pub scroll_offset: usize,
    pub is_streaming: bool,
    pub streaming_text: String,
    pub status_message: Option<String>,
    /// Randomly chosen thinking verb shown next to the spinner while streaming.
    pub spinner_verb: Option<String>,
    pub should_quit: bool,
    pub show_help: bool,

    // Extended state
    pub tool_use_blocks: Vec<ToolUseBlock>,
    pub permission_request: Option<PermissionRequest>,
    pub frame_count: u64,
    pub token_count: u32,
    pub cost_usd: f64,
    pub model_name: String,
    pub agent_status: Vec<(String, String)>,
    pub history_search: Option<HistorySearch>,
    pub keybindings: KeybindingResolver,

    // Cursor position within input (byte offset)
    pub cursor_pos: usize,

    // ---- Scrollback / auto-scroll -----------------------------------------

    /// When `true`, the message pane follows the latest messages automatically.
    pub auto_scroll: bool,
    /// Count of messages that arrived while the user was scrolled up.
    pub new_messages_while_scrolled: usize,

    // ---- Token warning tracking -------------------------------------------

    /// Which threshold (0 = none, 80, 95, 100) was last notified so we only
    /// show each banner once.
    pub token_warning_threshold_shown: u8,

    // ---- Session timing ---------------------------------------------------

    /// Instant the session started (used for elapsed-time in the status bar).
    pub session_start: std::time::Instant,
    /// Instant the current turn's streaming began (reset each time streaming starts).
    pub turn_start: Option<std::time::Instant>,
    /// Elapsed time string for the last completed turn, e.g. "2m 5s".
    pub last_turn_elapsed: Option<String>,
    /// Past-tense verb shown after turn completes, e.g. "Worked" / "Baked".
    pub last_turn_verb: Option<&'static str>,
    /// Incremented whenever transcript-visible state changes so rendering can
    /// reuse cached layout between keystrokes.
    pub transcript_version: Cell<u64>,

    // ---- New overlay / notification fields --------------------------------

    /// Full-screen help overlay (? / F1).
    pub help_overlay: HelpOverlay,
    /// Ctrl+R history search overlay.
    pub history_search_overlay: HistorySearchOverlay,
    /// Global ripgrep search / quick-open overlay.
    pub global_search: GlobalSearchState,
    /// Message selector used by /rewind.
    pub message_selector: MessageSelectorOverlay,
    /// Multi-step rewind flow overlay.
    pub rewind_flow: RewindFlowOverlay,
    /// Bridge connection state.
    pub bridge_state: BridgeConnectionState,
    /// Active notification queue.
    pub notifications: NotificationQueue,
    /// Plugin hint banners.
    pub plugin_hints: Vec<PluginHintBanner>,
    /// Optional session title shown in the status bar.
    pub session_title: Option<String>,
    /// Remote session URL (set when bridge connects; readable by commands).
    pub remote_session_url: Option<String>,
    /// Live MCP manager snapshot source when available.
    pub mcp_manager: Option<Arc<cc_mcp::McpManager>>,
    /// Queued request for a real MCP reconnect from the interactive loop.
    pub pending_mcp_reconnect: bool,
    /// Shared file-history service used for turn diff reconstruction.
    pub file_history: Option<Arc<parking_lot::Mutex<FileHistory>>>,
    /// Shared query-loop turn counter for turn-local diff reconstruction.
    pub current_turn: Option<Arc<std::sync::atomic::AtomicUsize>>,

    // ---- Visual mode indicators -------------------------------------------

    /// Plan mode — input border turns blue, [PLAN] shown in status bar.
    pub plan_mode: bool,
    /// Fast mode — lightning bolt shown before model name, border turns yellow.
    pub fast_mode: bool,
    /// Effort level shown as ○/◐/●/◉ in the status bar next to the model name.
    pub effort_level: EffortLevel,
    /// "While you were away" summary text shown on the welcome screen.
    pub away_summary: Option<String>,
    /// When streaming stalled (used to turn the spinner red after 3 s).
    pub stall_start: Option<std::time::Instant>,

    // ---- Settings / theme / privacy screens --------------------------------

    /// Full-screen tabbed settings screen (/config, /settings).
    pub settings_screen: SettingsScreen,
    /// Theme picker overlay (/theme).
    pub theme_screen: ThemeScreen,
    /// Privacy settings dialog (/privacy-settings).
    pub privacy_screen: PrivacyScreen,
    /// Token/cost analytics dialog.
    pub stats_dialog: StatsDialogState,
    /// MCP server browser and tool detail view.
    pub mcp_view: McpViewState,
    /// Agent definitions and active agent status overlay.
    pub agents_menu: AgentsMenuState,
    /// Diff viewer overlay.
    pub diff_viewer: DiffViewerState,
    /// Session-quality feedback survey overlay.
    pub feedback_survey: crate::feedback_survey::FeedbackSurveyState,
    /// Memory file selector overlay (CLAUDE.md browser).
    pub memory_file_selector: crate::memory_file_selector::MemoryFileSelectorState,
    /// Read-only hooks configuration browser.
    pub hooks_config_menu: crate::hooks_config_menu::HooksConfigMenuState,
    /// Overage credit upsell banner.
    pub overage_upsell: crate::overage_upsell::OverageCreditUpsellState,
    /// Voice mode availability notice.
    pub voice_mode_notice: crate::voice_mode_notice::VoiceModeNoticeState,
    /// Desktop app upsell startup dialog.
    pub desktop_upsell: crate::desktop_upsell_startup::DesktopUpsellStartupState,
    /// Memory update notification banner.
    pub memory_update_notification: crate::memory_update_notification::MemoryUpdateNotificationState,
    /// MCP elicitation dialog (form requested by an MCP server).
    pub elicitation: crate::elicitation_dialog::ElicitationDialogState,
    /// Model picker overlay (/model command).
    pub model_picker: ModelPickerState,
    /// Session browser overlay (/session, /resume, /rename, /export).
    pub session_browser: SessionBrowserState,
    /// MCP server approval dialog.
    pub mcp_approval: McpApprovalDialogState,
    /// Output style: "auto" | "stream" | "verbose".
    pub output_style: String,
    /// PR number for the current branch (None if not in a PR context).
    pub pr_number: Option<u32>,
    /// PR URL for the current branch.
    pub pr_url: Option<String>,
    /// Background task status text shown in footer pill.
    pub background_task_status: Option<String>,
    /// External status line command output (from CLAUDE_STATUS_COMMAND).
    pub status_line_override: Option<String>,
    /// Whether auto-compact is enabled (from settings).
    pub auto_compact_enabled: bool,
    /// Context threshold (0-100) at which to auto-compact.
    pub auto_compact_threshold: u8,

    // ---- Voice hold-to-talk ------------------------------------------------

    /// The global voice recorder, Some when voice is enabled in config.
    pub voice_recorder: Option<Arc<Mutex<cc_core::voice::VoiceRecorder>>>,
    /// True while recording is active (Alt+V toggled on).
    pub voice_recording: bool,
    /// Receiver for VoiceEvent messages produced by the recorder task.
    pub voice_event_rx: Option<tokio::sync::mpsc::Receiver<cc_core::voice::VoiceEvent>>,

    // ---- Context window & rate limit info ----------------------------------

    /// Total context window size for the current model (tokens).
    pub context_window_size: u64,
    /// How many tokens are currently used in the context window.
    pub context_used_tokens: u64,
    /// Rate limit info — 5-hour window usage percentage (0–100).
    pub rate_limit_5h_pct: Option<f32>,
    /// Rate limit info — 7-day window usage percentage (0–100).
    pub rate_limit_7day_pct: Option<f32>,
    /// Active worktree name (if in a worktree).
    pub worktree_name: Option<String>,
    /// Active worktree branch (if in a worktree).
    pub worktree_branch: Option<String>,
    /// Agent type badge: "agent" | "coordinator" | "subagent".
    pub agent_type_badge: Option<String>,
}

const SPINNER_VERBS: &[&str] = &[
    "Accomplishing", "Actioning", "Actualizing", "Architecting", "Baking", "Beaming",
    "Beboppin'", "Befuddling", "Billowing", "Blanching", "Bloviating", "Boogieing",
    "Boondoggling", "Booping", "Bootstrapping", "Brewing", "Bunning", "Burrowing",
    "Calculating", "Canoodling", "Caramelizing", "Cascading", "Catapulting", "Cerebrating",
    "Channeling", "Choreographing", "Churning", "Clauding", "Coalescing", "Cogitating",
    "Combobulating", "Composing", "Computing", "Concocting", "Considering", "Contemplating",
    "Cooking", "Crafting", "Creating", "Crunching", "Crystallizing", "Cultivating",
    "Deciphering", "Deliberating", "Determining", "Dilly-dallying", "Discombobulating",
    "Doing", "Doodling", "Drizzling", "Ebbing", "Effecting", "Elucidating", "Embellishing",
    "Enchanting", "Envisioning", "Evaporating", "Fermenting", "Fiddle-faddling", "Finagling",
    "Flambéing", "Flibbertigibbeting", "Flowing", "Flummoxing", "Fluttering", "Forging",
    "Forming", "Frolicking", "Frosting", "Gallivanting", "Galloping", "Garnishing",
    "Generating", "Gesticulating", "Germinating", "Gitifying", "Grooving", "Gusting",
    "Harmonizing", "Hashing", "Hatching", "Herding", "Honking", "Hullaballooing",
    "Hyperspacing", "Ideating", "Imagining", "Improvising", "Incubating", "Inferring",
    "Infusing", "Ionizing", "Jitterbugging", "Julienning", "Kneading", "Leavening",
    "Levitating", "Lollygagging", "Manifesting", "Marinating", "Meandering", "Metamorphosing",
    "Misting", "Moonwalking", "Moseying", "Mulling", "Mustering", "Musing", "Nebulizing",
    "Nesting", "Newspapering", "Noodling", "Nucleating", "Orbiting", "Orchestrating",
    "Osmosing", "Perambulating", "Percolating", "Perusing", "Philosophising",
    "Photosynthesizing", "Pollinating", "Pondering", "Pontificating", "Pouncing",
    "Precipitating", "Prestidigitating", "Processing", "Proofing", "Propagating", "Puttering",
    "Puzzling", "Quantumizing", "Razzle-dazzling", "Razzmatazzing", "Recombobulating",
    "Reticulating", "Roosting", "Ruminating", "Sautéing", "Scampering", "Schlepping",
    "Scurrying", "Seasoning", "Shenaniganing", "Shimmying", "Simmering", "Skedaddling",
    "Sketching", "Slithering", "Smooshing", "Sock-hopping", "Spelunking", "Spinning",
    "Sprouting", "Stewing", "Sublimating", "Swirling", "Swooping", "Symbioting",
    "Synthesizing", "Tempering", "Thinking", "Thundering", "Tinkering", "Tomfoolering",
    "Topsy-turvying", "Transfiguring", "Transmuting", "Twisting", "Undulating", "Unfurling",
    "Unravelling", "Vibing", "Waddling", "Wandering", "Warping", "Whatchamacalliting",
    "Whirlpooling", "Whirring", "Whisking", "Wibbling", "Working", "Wrangling", "Zesting",
    "Zigzagging",
];

fn sample_spinner_verb(seed: usize) -> &'static str {
    SPINNER_VERBS[seed % SPINNER_VERBS.len()]
}

/// Past-tense verbs shown in the status row after a turn completes.
/// Mirrors `TURN_COMPLETION_VERBS` from `src/constants/turnCompletionVerbs.ts`.
const TURN_COMPLETION_VERBS: &[&str] = &[
    "Baked", "Brewed", "Churned", "Cogitated", "Cooked", "Crunched",
    "Pondered", "Processed", "Worked",
];

fn sample_completion_verb(seed: usize) -> &'static str {
    TURN_COMPLETION_VERBS[seed % TURN_COMPLETION_VERBS.len()]
}

/// Format a duration in seconds to a human-readable string, e.g. "2m 5s".
fn format_elapsed(secs: u64) -> String {
    if secs < 60 {
        format!("{}s", secs)
    } else {
        format!("{}m {}s", secs / 60, secs % 60)
    }
}

impl App {
    pub fn new(config: Config, cost_tracker: Arc<CostTracker>) -> Self {
        let model_name = config.effective_model().to_string();
        let user_keybindings = UserKeybindings::load(&Settings::config_dir());
        Self {
            config,
            cost_tracker,
            messages: Vec::new(),
            display_messages: Vec::new(),
            system_annotations: Vec::new(),
            input: String::new(),
            prompt_input: PromptInputState::new(),
            input_history: Vec::new(),
            history_index: None,
            scroll_offset: 0,
            is_streaming: false,
            streaming_text: String::new(),
            status_message: None,
            spinner_verb: None,
            should_quit: false,
            show_help: false,
            tool_use_blocks: Vec::new(),
            permission_request: None,
            frame_count: 0,
            token_count: 0,
            cost_usd: 0.0,
            model_name,
            agent_status: Vec::new(),
            history_search: None,
            keybindings: KeybindingResolver::new(&user_keybindings),
            cursor_pos: 0,
            auto_scroll: true,
            new_messages_while_scrolled: 0,
            token_warning_threshold_shown: 0,
            session_start: std::time::Instant::now(),
            turn_start: None,
            last_turn_elapsed: None,
            last_turn_verb: None,
            transcript_version: Cell::new(0),
            help_overlay: HelpOverlay::new(),
            history_search_overlay: HistorySearchOverlay::new(),
            global_search: GlobalSearchState::default(),
            message_selector: MessageSelectorOverlay::new(),
            rewind_flow: RewindFlowOverlay::new(),
            bridge_state: BridgeConnectionState::Disconnected,
            notifications: NotificationQueue::new(),
            plugin_hints: Vec::new(),
            session_title: None,
            remote_session_url: None,
            mcp_manager: None,
            pending_mcp_reconnect: false,
            file_history: None,
            current_turn: None,
            plan_mode: false,
            fast_mode: false,
            effort_level: EffortLevel::default(),
            away_summary: None,
            stall_start: None,
            settings_screen: SettingsScreen::new(),
            theme_screen: ThemeScreen::new(),
            privacy_screen: PrivacyScreen::new(),
            stats_dialog: StatsDialogState::new(),
            mcp_view: McpViewState::new(),
            agents_menu: AgentsMenuState::new(),
            diff_viewer: DiffViewerState::new(),
            feedback_survey: crate::feedback_survey::FeedbackSurveyState::new(),
            memory_file_selector: crate::memory_file_selector::MemoryFileSelectorState::new(),
            hooks_config_menu: crate::hooks_config_menu::HooksConfigMenuState::new(),
            overage_upsell: crate::overage_upsell::OverageCreditUpsellState::new(),
            voice_mode_notice: crate::voice_mode_notice::VoiceModeNoticeState::new(),
            desktop_upsell: crate::desktop_upsell_startup::DesktopUpsellStartupState::new(),
            memory_update_notification: crate::memory_update_notification::MemoryUpdateNotificationState::new(),
            elicitation: crate::elicitation_dialog::ElicitationDialogState::new(),
            model_picker: ModelPickerState::new(),
            session_browser: SessionBrowserState::new(),
            mcp_approval: McpApprovalDialogState::new(),
            output_style: "auto".to_string(),
            pr_number: None,
            pr_url: None,
            background_task_status: None,
            status_line_override: None,
            auto_compact_enabled: false,
            auto_compact_threshold: 95,
            voice_recorder: {
                // Check whether voice input has been enabled via the /voice command
                // (stored in ~/.claude/ui-settings.json).  We also accept
                // CLAUDE_CODE_VOICE_ENABLED=1 as an override for easier testing.
                let voice_on = std::env::var("CLAUDE_CODE_VOICE_ENABLED")
                    .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                    .unwrap_or(false)
                    || {
                        let path = cc_core::config::Settings::config_dir()
                            .join("ui-settings.json");
                        std::fs::read_to_string(&path)
                            .ok()
                            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                            .and_then(|v| v["voice_enabled"].as_bool())
                            .unwrap_or(false)
                    };
                if voice_on {
                    let recorder = cc_core::voice::global_voice_recorder();
                    if let Ok(mut r) = recorder.lock() {
                        r.set_enabled(true);
                    }
                    Some(recorder)
                } else {
                    None
                }
            },
            voice_recording: false,
            voice_event_rx: None,
            context_window_size: 0,
            context_used_tokens: 0,
            rate_limit_5h_pct: None,
            rate_limit_7day_pct: None,
            worktree_name: None,
            worktree_branch: None,
            agent_type_badge: None,
        }
    }

    /// Update the active model name (also updates cost tracker).
    pub fn set_model(&mut self, model: String) {
        self.cost_tracker.set_model(&model);
        self.model_name = model;
    }

    /// Apply a theme by name, persisting it to config.
    pub fn apply_theme(&mut self, theme_name: &str) {
        let theme = match theme_name {
            "dark" => Theme::Dark,
            "light" => Theme::Light,
            "default" => Theme::Default,
            other => Theme::Custom(other.to_string()),
        };
        self.config.theme = theme;
        // Persist to settings file
        let mut settings = Settings::load_sync().unwrap_or_default();
        settings.config.theme = self.config.theme.clone();
        let _ = settings.save_sync();
        self.status_message = Some(format!("Theme set to: {}", theme_name));
    }

    /// Handle slash commands that should open UI screens rather than execute
    /// as normal commands. Returns `true` if the command was intercepted.
    pub fn intercept_slash_command(&mut self, cmd: &str) -> bool {
        self.close_secondary_views();
        match cmd {
            "config" | "settings" => {
                self.settings_screen.open();
                true
            }
            "theme" => {
                let current = match &self.config.theme {
                    Theme::Dark => "dark",
                    Theme::Light => "light",
                    Theme::Default => "default",
                    Theme::Custom(s) => s.as_str(),
                };
                self.theme_screen.open(current);
                true
            }
            "privacy-settings" | "privacy" => {
                self.privacy_screen.open();
                true
            }
            "stats" => {
                self.stats_dialog.open();
                true
            }
            "mcp" => {
                let servers = self.load_mcp_servers();
                self.mcp_view.open(servers);
                true
            }
            "agents" => {
                self.open_agents_menu();
                true
            }
            "diff" | "review" => {
                let root = self.project_root();
                self.diff_viewer.open(&root);
                true
            }
            "changes" => {
                let root = self.project_root();
                self.refresh_turn_diff_from_history();
                self.diff_viewer.open_turn(&root);
                true
            }
            "search" | "find" => {
                self.global_search.open();
                true
            }
            "survey" | "feedback" => {
                self.feedback_survey.open();
                true
            }
            "memory" => {
                let root = self.project_root();
                self.memory_file_selector.open(&root);
                true
            }
            "hooks" => {
                self.hooks_config_menu.open();
                true
            }
            "model" => {
                let current = &self.model_name.clone();
                self.model_picker.open(current);
                true
            }
            "session" | "resume" => {
                self.session_browser.open(vec![]);
                true
            }
            "clear" => {
                self.messages.clear();
                self.system_annotations.clear();
                self.display_messages.clear();
                self.streaming_text.clear();
                self.tool_use_blocks.clear();
                self.invalidate_transcript();
                self.status_message = Some("Conversation cleared.".to_string());
                true
            }
            "exit" | "quit" => {
                self.should_quit = true;
                true
            }
            "vim" => {
                self.prompt_input.vim_enabled = !self.prompt_input.vim_enabled;
                let status = if self.prompt_input.vim_enabled { "enabled" } else { "disabled" };
                self.status_message = Some(format!("Vim mode {}.", status));
                self.refresh_prompt_input();
                true
            }
            "fast" => {
                self.fast_mode = !self.fast_mode;
                let status = if self.fast_mode { "enabled" } else { "disabled" };
                self.status_message = Some(format!("Fast mode {}.", status));
                true
            }
            "compact" => {
                // Emit compact request via status message; CLI loop checks this.
                self.status_message = Some("Compacting\u{2026}".to_string());
                self.push_system_message("Compact requested.".to_string(), SystemMessageStyle::Compact);
                true
            }
            "copy" => {
                // Copy last assistant message to clipboard. Attempt arboard; fall back to notification.
                let last = self.messages.iter().rev()
                    .find(|m| m.role == Role::Assistant)
                    .map(|m| m.get_all_text());
                if let Some(text) = last {
                    // Try xclip/xsel/pbcopy/clip.exe for clipboard; fall back to notification.
                    let copied = try_copy_to_clipboard(&text);
                    if copied {
                        self.notifications.push(
                            NotificationKind::Info,
                            "Copied to clipboard.".to_string(),
                            Some(3),
                        );
                    } else {
                        self.notifications.push(
                            NotificationKind::Info,
                            format!("Last response: {} chars (clipboard unavailable)", text.len()),
                            Some(5),
                        );
                    }
                } else {
                    self.notifications.push(
                        NotificationKind::Warning,
                        "No assistant message to copy.".to_string(),
                        Some(3),
                    );
                }
                true
            }
            "output-style" => {
                self.output_style = match self.output_style.as_str() {
                    "auto" => "stream".to_string(),
                    "stream" => "verbose".to_string(),
                    _ => "auto".to_string(),
                };
                self.status_message = Some(format!("Output style: {}.", self.output_style));
                true
            }
            "effort" => {
                self.effort_level = match self.effort_level {
                    EffortLevel::Low => EffortLevel::Medium,
                    EffortLevel::Medium => EffortLevel::High,
                    EffortLevel::High => EffortLevel::Max,
                    EffortLevel::Max => EffortLevel::Low,
                };
                self.status_message = Some(format!("Effort: {:?}.", self.effort_level));
                true
            }
            "voice" => {
                let was_on = self.voice_recorder.is_some();
                if was_on {
                    self.voice_recorder = None;
                    self.voice_mode_notice.dismiss();
                    self.status_message = Some("Voice mode disabled.".to_string());
                } else {
                    let recorder = cc_core::voice::global_voice_recorder();
                    if let Ok(mut r) = recorder.lock() {
                        r.set_enabled(true);
                    }
                    self.voice_recorder = Some(recorder);
                    self.voice_mode_notice = crate::voice_mode_notice::VoiceModeNoticeState::new();
                    self.status_message = Some("Voice mode enabled. Press Alt+V to record.".to_string());
                }
                true
            }
            "doctor" => {
                self.notifications.push(
                    NotificationKind::Info,
                    "Diagnostics: Rust TUI v{} — all systems nominal.".to_string(),
                    Some(5),
                );
                true
            }
            "cost" => {
                self.stats_dialog.open();
                true
            }
            "rewind" => {
                self.open_rewind_flow();
                true
            }
            "export" => {
                let count = self.messages.len();
                self.notifications.push(
                    NotificationKind::Info,
                    format!("Export: {} messages (session browser → export coming soon).", count),
                    Some(4),
                );
                true
            }
            "rename" => {
                self.session_browser.open(vec![]);
                self.session_browser.start_rename();
                true
            }
            "init" => {
                self.notifications.push(
                    NotificationKind::Info,
                    "Init: creating CLAUDE.md via /init (routing to CLI loop)\u{2026}".to_string(),
                    Some(5),
                );
                true
            }
            "login" => {
                self.notifications.push(
                    NotificationKind::Info,
                    "Login: routing to CLI loop\u{2026}".to_string(),
                    Some(3),
                );
                true
            }
            "logout" => {
                self.notifications.push(
                    NotificationKind::Info,
                    "Logout: routing to CLI loop\u{2026}".to_string(),
                    Some(3),
                );
                true
            }
            "keybindings" => {
                // Open settings on KeyBindings tab
                self.settings_screen.open();
                self.settings_screen.active_tab = crate::settings_screen::SettingsTab::KeyBindings;
                true
            }
            _ => false,
        }
    }

    fn close_secondary_views(&mut self) {
        self.stats_dialog.close();
        self.mcp_view.close();
        self.agents_menu.close();
        self.diff_viewer.close();
        self.feedback_survey.close();
        self.memory_file_selector.close();
        self.hooks_config_menu.close();
        self.model_picker.close();
        self.session_browser.close();
    }

    fn project_root(&self) -> std::path::PathBuf {
        self.config
            .project_dir
            .clone()
            .or_else(|| std::env::current_dir().ok())
            .unwrap_or_else(|| std::path::PathBuf::from("."))
    }

    fn refresh_global_search(&mut self) {
        let root = self.project_root();
        self.global_search.run_search(&root);
    }

    fn load_mcp_servers(&self) -> Vec<McpServerView> {
        if let Some(manager) = self.mcp_manager.as_ref() {
            let tool_defs = manager.all_tool_definitions();
            return self
                .config
                .mcp_servers
                .iter()
                .map(|server| {
                    let transport = server
                        .url
                        .as_ref()
                        .map(|_| server.server_type.clone())
                        .or_else(|| server.command.as_ref().map(|_| "stdio".to_string()))
                        .unwrap_or_else(|| server.server_type.clone());

                    let tools: Vec<McpToolView> = tool_defs
                        .iter()
                        .filter(|(server_name, _)| server_name == &server.name)
                        .map(|(_, tool_def)| McpToolView {
                            name: tool_def
                                .name
                                .strip_prefix(&format!("{}_", server.name))
                                .unwrap_or(&tool_def.name)
                                .to_string(),
                            server: server.name.clone(),
                            description: tool_def.description.clone(),
                            input_schema: Some(tool_def.input_schema.to_string()),
                        })
                        .collect();

                    let (status, error_message) = match manager.server_status(&server.name) {
                        cc_mcp::McpServerStatus::Connected { .. } => {
                            (McpViewStatus::Connected, None)
                        }
                        cc_mcp::McpServerStatus::Connecting => {
                            (McpViewStatus::Connecting, None)
                        }
                        cc_mcp::McpServerStatus::Disconnected { last_error } => {
                            if last_error.is_some() {
                                (McpViewStatus::Error, last_error)
                            } else {
                                (McpViewStatus::Disconnected, None)
                            }
                        }
                        cc_mcp::McpServerStatus::Failed { error, .. } => {
                            (McpViewStatus::Error, Some(error))
                        }
                    };

                    let catalog = manager.server_catalog(&server.name);
                    McpServerView {
                        name: server.name.clone(),
                        transport,
                        status,
                        tool_count: catalog
                            .as_ref()
                            .map(|entry| entry.tool_count)
                            .unwrap_or_else(|| tools.len()),
                        resource_count: catalog
                            .as_ref()
                            .map(|entry| entry.resource_count)
                            .unwrap_or(0),
                        prompt_count: catalog
                            .as_ref()
                            .map(|entry| entry.prompt_count)
                            .unwrap_or(0),
                        resources: catalog
                            .as_ref()
                            .map(|entry| entry.resources.clone())
                            .unwrap_or_default(),
                        prompts: catalog
                            .as_ref()
                            .map(|entry| entry.prompts.clone())
                            .unwrap_or_default(),
                        error_message,
                        tools,
                    }
                })
                .collect();
        }

        self.config
            .mcp_servers
            .iter()
            .map(|server| {
                let transport = server
                    .url
                    .as_ref()
                    .map(|_| server.server_type.clone())
                    .or_else(|| server.command.as_ref().map(|_| "stdio".to_string()))
                    .unwrap_or_else(|| server.server_type.clone());
                let description = if let Some(url) = &server.url {
                    format!("Endpoint: {}", url)
                } else if let Some(command) = &server.command {
                    let args = if server.args.is_empty() {
                        String::new()
                    } else {
                        format!(" {}", server.args.join(" "))
                    };
                    format!("Command: {}{}", command, args)
                } else {
                    "Configured server".to_string()
                };
                McpServerView {
                    name: server.name.clone(),
                    transport,
                    status: McpViewStatus::Disconnected,
                    tool_count: 0,
                    resource_count: 0,
                    prompt_count: 0,
                    resources: vec![],
                    prompts: vec![],
                    error_message: None,
                    tools: vec![McpToolView {
                        name: "connection".to_string(),
                        server: server.name.clone(),
                        description,
                        input_schema: None,
                    }],
                }
            })
            .collect()
    }

    fn open_agents_menu(&mut self) {
        let root = self.project_root();
        self.agents_menu.open(&root);
        self.agents_menu.active_agents = self
            .agent_status
            .iter()
            .enumerate()
            .map(|(idx, (name, status))| AgentInfo {
                id: format!("agent-{}", idx + 1),
                name: name.clone(),
                status: match status.as_str() {
                    "running" => AgentStatus::Running,
                    "waiting" | "waiting_for_tool" => AgentStatus::WaitingForTool,
                    "complete" | "completed" | "done" => AgentStatus::Complete,
                    "failed" | "error" => AgentStatus::Failed,
                    _ => AgentStatus::Idle,
                },
                current_tool: None,
                turns_completed: 0,
                is_coordinator: false,
                last_output: Some(status.clone()),
            })
            .collect();
    }

    /// Add a message directly (e.g. from a non-streaming source).
    pub fn add_message(&mut self, role: Role, text: String) {
        let msg = match role {
            Role::User => Message::user(text),
            Role::Assistant => Message::assistant(text),
        };
        self.messages.push(msg);
        self.invalidate_transcript();
        self.on_new_message();
    }

    pub fn replace_messages(&mut self, messages: Vec<Message>) {
        self.messages = messages;
        self.invalidate_transcript();
    }

    pub fn push_message(&mut self, message: Message) {
        self.messages.push(message);
        self.invalidate_transcript();
        self.on_new_message();
    }

    /// Push a synthetic system annotation into the conversation pane.
    /// It will appear after the current last message.
    pub fn push_system_message(&mut self, text: String, style: SystemMessageStyle) {
        self.system_annotations.push(SystemAnnotation {
            after_index: self.messages.len(),
            text,
            style,
        });
        self.invalidate_transcript();
    }

    /// Called whenever a new message is appended to `messages`.
    /// Manages the auto-scroll / new-message-counter state.
    fn on_new_message(&mut self) {
        if self.auto_scroll {
            // Auto-scroll: keep offset at 0 so render shows the bottom.
            self.scroll_offset = 0;
        } else {
            self.new_messages_while_scrolled =
                self.new_messages_while_scrolled.saturating_add(1);
        }
    }

    pub fn invalidate_transcript(&self) {
        self.transcript_version
            .set(self.transcript_version.get().wrapping_add(1));
    }

    /// Check current token usage and push token warning notifications as
    /// appropriate.  Call this after updating `token_count`.
    pub fn check_token_warnings(&mut self) {
        let window =
            cc_query::context_window_for_model(&self.model_name) as u32;
        if window == 0 {
            return;
        }
        let pct = (self.token_count as f64 / window as f64 * 100.0) as u8;

        // Only escalate — never repeat a threshold already shown.
        if pct >= 100 && self.token_warning_threshold_shown < 100 {
            self.token_warning_threshold_shown = 100;
            self.notifications.push(
                NotificationKind::Error,
                "Context window full. Running auto-compact\u{2026}".to_string(),
                None,
            );
        } else if pct >= 95 && self.token_warning_threshold_shown < 95 {
            self.token_warning_threshold_shown = 95;
            self.notifications.push(
                NotificationKind::Error,
                "Context window 95% full! Run /compact now.".to_string(),
                None, // persistent until dismissed
            );
        } else if pct >= 80 && self.token_warning_threshold_shown < 80 {
            self.token_warning_threshold_shown = 80;
            self.notifications.push(
                NotificationKind::Warning,
                "Context window 80% full. Consider /compact.".to_string(),
                Some(30),
            );
        }
    }

    /// Take the current input buffer, push it to history, and return it.
    pub fn take_input(&mut self) -> String {
        let input = self.prompt_input.take();
        if !input.is_empty() {
            self.prompt_input.history.push(input.clone());
            self.prompt_input.history_pos = None;
            self.prompt_input.history_draft.clear();
            self.input_history = self.prompt_input.history.clone();
            self.history_index = self.prompt_input.history_pos;
        }
        self.refresh_prompt_input();
        input
    }

    /// Open the rewind flow with the current message list converted to
    /// `SelectorMessage` entries.
    pub fn open_rewind_flow(&mut self) {
        let selector_msgs: Vec<SelectorMessage> = self
            .messages
            .iter()
            .enumerate()
            .map(|(i, m)| {
                let text = m.get_all_text();
                let preview: String = text.chars().take(80).collect();
                let has_tool_use = !m.get_tool_use_blocks().is_empty();
                SelectorMessage {
                    idx: i,
                    role: format!("{:?}", m.role).to_lowercase(),
                    preview,
                    has_tool_use,
                }
            })
            .collect();
        self.rewind_flow.open(selector_msgs);
    }

    /// Return the elapsed session time as a human-readable string, e.g. "2m 5s".
    pub fn elapsed_str(&self) -> String {
        let secs = self.session_start.elapsed().as_secs();
        if secs < 60 {
            format!("{}s", secs)
        } else {
            format!("{}m {}s", secs / 60, secs % 60)
        }
    }

    fn prompt_mode(&self) -> InputMode {
        if self.is_streaming {
            InputMode::Readonly
        } else if self.plan_mode {
            InputMode::Plan
        } else {
            InputMode::Default
        }
    }

    fn sync_legacy_prompt_fields(&mut self) {
        self.input = self.prompt_input.text.clone();
        self.cursor_pos = self.prompt_input.cursor;
        self.history_index = self.prompt_input.history_pos;
    }

    fn refresh_prompt_input(&mut self) {
        self.prompt_input.mode = self.prompt_mode();
        self.prompt_input.update_suggestions(PROMPT_SLASH_COMMANDS);
        self.sync_legacy_prompt_fields();
    }

    pub fn set_prompt_text(&mut self, text: String) {
        self.prompt_input.replace_text(text);
        self.refresh_prompt_input();
    }

    pub fn attach_turn_diff_state(
        &mut self,
        file_history: Arc<parking_lot::Mutex<FileHistory>>,
        current_turn: Arc<std::sync::atomic::AtomicUsize>,
    ) {
        self.file_history = Some(file_history);
        self.current_turn = Some(current_turn);
        self.refresh_turn_diff_from_history();
    }

    pub fn attach_mcp_manager(&mut self, mcp_manager: Arc<cc_mcp::McpManager>) {
        self.mcp_manager = Some(mcp_manager);
    }

    pub fn refresh_mcp_view(&mut self) {
        let servers = self.load_mcp_servers();
        self.mcp_view.open(servers);
    }

    pub fn take_pending_mcp_reconnect(&mut self) -> bool {
        let pending = self.pending_mcp_reconnect;
        self.pending_mcp_reconnect = false;
        pending
    }

    /// Returns and clears any pending MCP approval result.
    pub fn take_mcp_approval_result(&mut self) -> Option<crate::dialogs::McpApprovalChoice> {
        if !self.mcp_approval.visible {
            return None;
        }
        // The dialog closes itself on confirm; we check if it's now closed
        None // Actual result is read by CLI loop via mcp_approval.visible + confirm()
    }

    /// Detect the current PR from environment variables or git.
    pub fn detect_pr(&mut self) {
        // Check CLAUDE_PR_NUMBER and CLAUDE_PR_URL env vars
        if let Ok(num) = std::env::var("CLAUDE_PR_NUMBER") {
            if let Ok(n) = num.parse::<u32>() {
                self.pr_number = Some(n);
            }
        }
        if let Ok(url) = std::env::var("CLAUDE_PR_URL") {
            self.pr_url = Some(url);
        }
        // Fall back to gh CLI if no env vars
        if self.pr_number.is_none() {
            if let Ok(output) = std::process::Command::new("gh")
                .args(["pr", "view", "--json", "number,url", "--jq", ".number,.url"])
                .output()
            {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    let parts: Vec<&str> = text.trim().split('\n').collect();
                    if parts.len() >= 2 {
                        if let Ok(n) = parts[0].trim().parse::<u32>() {
                            self.pr_number = Some(n);
                            self.pr_url = Some(parts[1].trim().to_string());
                        }
                    }
                }
            }
        }
    }

    fn clear_prompt(&mut self) {
        self.prompt_input.clear();
        self.refresh_prompt_input();
    }

    fn refresh_turn_diff_from_history(&mut self) {
        let Some(file_history) = self.file_history.as_ref() else {
            self.diff_viewer.set_turn_diff(Vec::new());
            return;
        };
        let Some(current_turn) = self.current_turn.as_ref() else {
            self.diff_viewer.set_turn_diff(Vec::new());
            return;
        };

        let turn_index = current_turn.load(std::sync::atomic::Ordering::Relaxed);
        if turn_index == 0 {
            self.diff_viewer.set_turn_diff(Vec::new());
            return;
        }

        let root = self.project_root();
        let files = {
            let history = file_history.lock();
            build_turn_diff(&history, turn_index, &root)
        };
        self.diff_viewer.set_turn_diff(files);
    }

    // -------------------------------------------------------------------
    // Event handling
    // -------------------------------------------------------------------

    /// Process a keyboard event. Returns `true` when the input should be
    /// submitted (Enter pressed with no blocking dialog).
    pub fn handle_key_event(&mut self, key: KeyEvent) -> bool {
        if self.global_search.open {
            return self.handle_global_search_key(key);
        }
        let key_context = self.current_key_context();
        if let Some(keystroke) = key_event_to_keystroke(&key) {
            let had_pending_chord = self.keybindings.has_pending_chord();
            match self.keybindings.process(keystroke, &key_context) {
                KeybindingResult::Action(action) => {
                    return self.handle_keybinding_action(&action);
                }
                KeybindingResult::Unbound | KeybindingResult::Pending => return false,
                KeybindingResult::NoMatch if had_pending_chord => return false,
                KeybindingResult::NoMatch => {}
            }
        } else {
            self.keybindings.cancel_chord();
        }

        // Model picker intercepts navigation and Esc
        if self.model_picker.visible {
            match key.code {
                KeyCode::Esc => self.model_picker.close(),
                KeyCode::Up => self.model_picker.select_prev(),
                KeyCode::Down => self.model_picker.select_next(),
                KeyCode::Enter => {
                    if let Some(model_id) = self.model_picker.confirm() {
                        self.set_model(model_id.clone());
                        self.status_message = Some(format!("Model: {}", model_id));
                    }
                }
                KeyCode::Backspace => self.model_picker.pop_filter_char(),
                KeyCode::Char(c) => self.model_picker.push_filter_char(c),
                _ => {}
            }
            return false;
        }

        // Session browser intercepts navigation and Esc
        if self.session_browser.visible {
            use crate::session_browser::SessionBrowserMode;
            match self.session_browser.mode {
                SessionBrowserMode::Browse => {
                    match key.code {
                        KeyCode::Esc => self.session_browser.close(),
                        KeyCode::Up => self.session_browser.select_prev(),
                        KeyCode::Down => self.session_browser.select_next(),
                        KeyCode::Char('r') => self.session_browser.start_rename(),
                        _ => {}
                    }
                }
                SessionBrowserMode::Rename => {
                    match key.code {
                        KeyCode::Esc => self.session_browser.cancel(),
                        KeyCode::Enter => {
                            if let Some((_id, name)) = self.session_browser.confirm_rename() {
                                self.session_title = Some(name.clone());
                                self.status_message = Some(format!("Renamed to: {}", name));
                            }
                        }
                        KeyCode::Backspace => self.session_browser.pop_rename_char(),
                        KeyCode::Char(c) => self.session_browser.push_rename_char(c),
                        _ => {}
                    }
                }
                SessionBrowserMode::Confirm => {
                    match key.code {
                        KeyCode::Esc | KeyCode::Char('n') => self.session_browser.cancel(),
                        KeyCode::Enter | KeyCode::Char('y') => {
                            self.session_browser.close();
                        }
                        _ => {}
                    }
                }
            }
            return false;
        }

        // MCP approval dialog
        if self.mcp_approval.visible {
            let result = crate::dialogs::handle_mcp_approval_key(&mut self.mcp_approval, key);
            if result.is_some() {
                // Result processed by CLI loop via take_mcp_approval_result()
            }
            return false;
        }

        // Feedback survey intercepts digit keys and Esc
        if self.feedback_survey.visible {
            if key.code == KeyCode::Esc {
                self.feedback_survey.close();
                return false;
            }
            if let KeyCode::Char(c) = key.code {
                if let Some(d) = c.to_digit(10) {
                    self.feedback_survey.handle_digit(d as u8);
                    return false;
                }
            }
            return false;
        }

        // Memory file selector intercepts navigation and Esc
        if self.memory_file_selector.visible {
            match key.code {
                KeyCode::Esc => self.memory_file_selector.close(),
                KeyCode::Up => self.memory_file_selector.select_prev(),
                KeyCode::Down => self.memory_file_selector.select_next(),
                KeyCode::Enter => {
                    // Selection acknowledged — consumer can read selected_path()
                    self.memory_file_selector.close();
                }
                _ => {}
            }
            return false;
        }

        // Hooks config menu intercepts navigation and Esc
        if self.hooks_config_menu.visible {
            match key.code {
                KeyCode::Esc | KeyCode::Char('q') => self.hooks_config_menu.close(),
                KeyCode::Up => self.hooks_config_menu.select_prev(),
                KeyCode::Down => self.hooks_config_menu.select_next(),
                _ => {}
            }
            return false;
        }

        if self.diff_viewer.open {
            self.handle_diff_viewer_key(key);
            return false;
        }

        if self.agents_menu.open {
            self.handle_agents_menu_key(key);
            return false;
        }

        if self.mcp_view.open {
            self.handle_mcp_view_key(key);
            return false;
        }

        if self.stats_dialog.open {
            self.handle_stats_dialog_key(key);
            return false;
        }

        // Settings screen intercepts keys
        if self.settings_screen.visible {
            crate::settings_screen::handle_settings_key(
                &mut self.settings_screen,
                &mut self.config,
                key,
            );
            return false;
        }

        // Theme picker intercepts keys
        if self.theme_screen.visible {
            if let Some(theme_name) =
                crate::theme_screen::handle_theme_key(&mut self.theme_screen, key)
            {
                self.apply_theme(&theme_name);
            }
            return false;
        }

        // Privacy screen intercepts keys
        if self.privacy_screen.visible {
            crate::privacy_screen::handle_privacy_key(&mut self.privacy_screen, key);
            return false;
        }

        // Rewind flow overlay intercepts keys first
        if self.rewind_flow.visible {
            return self.handle_rewind_flow_key(key);
        }

        // Help overlay intercepts keys next
        if self.help_overlay.visible {
            return self.handle_help_overlay_key(key);
        }

        // New history-search overlay
        if self.history_search_overlay.visible {
            return self.handle_history_search_overlay_key(key);
        }

        if self.global_search.open {
            return self.handle_global_search_key(key);
        }

        // Legacy history-search mode intercepts most keys
        if self.history_search.is_some() {
            return self.handle_history_search_key(key);
        }

        // Permission dialog mode intercepts most keys
        if self.permission_request.is_some() {
            self.handle_permission_key(key);
            return false;
        }

        // Notification dismiss
        if key.code == KeyCode::Esc && !self.notifications.is_empty() {
            self.notifications.dismiss_current();
            return false;
        }

        // Plugin hint dismiss
        if key.code == KeyCode::Esc {
            if let Some(hint) = self.plugin_hints.iter_mut().find(|h| h.is_visible()) {
                hint.dismiss();
                return false;
            }
        }

        // Overage upsell dismiss
        if key.code == KeyCode::Esc && self.overage_upsell.visible {
            self.overage_upsell.dismiss();
            return false;
        }

        // Voice mode notice dismiss
        if key.code == KeyCode::Esc && self.voice_mode_notice.visible {
            self.voice_mode_notice.dismiss();
            return false;
        }

        // Desktop upsell startup dialog
        if self.desktop_upsell.visible {
            match key.code {
                KeyCode::Up | KeyCode::BackTab => {
                    self.desktop_upsell.select_prev();
                    return false;
                }
                KeyCode::Down | KeyCode::Tab => {
                    self.desktop_upsell.select_next();
                    return false;
                }
                KeyCode::Enter => {
                    self.desktop_upsell.confirm();
                    return false;
                }
                KeyCode::Esc => {
                    self.desktop_upsell.dismiss_temporarily();
                    return false;
                }
                _ => return false,
            }
        }

        // Memory update notification dismiss
        if key.code == KeyCode::Esc && self.memory_update_notification.visible {
            self.memory_update_notification.dismiss();
            return false;
        }

        // MCP elicitation dialog — highest priority modal
        if self.elicitation.visible {
            match key.code {
                KeyCode::Esc => {
                    self.elicitation.cancel();
                    return false;
                }
                KeyCode::Enter => {
                    self.elicitation.submit();
                    return false;
                }
                KeyCode::Tab | KeyCode::Down => {
                    if let crossterm::event::KeyModifiers::SHIFT = key.modifiers {
                        self.elicitation.prev_field();
                    } else {
                        self.elicitation.next_field();
                    }
                    return false;
                }
                KeyCode::BackTab | KeyCode::Up => {
                    self.elicitation.prev_field();
                    return false;
                }
                KeyCode::Left => {
                    self.elicitation.cycle_enum_prev();
                    return false;
                }
                KeyCode::Right => {
                    self.elicitation.cycle_enum_next();
                    return false;
                }
                KeyCode::Char(' ') => {
                    self.elicitation.toggle_active();
                    return false;
                }
                KeyCode::Backspace => {
                    self.elicitation.backspace();
                    return false;
                }
                KeyCode::Char(c) => {
                    self.elicitation.insert_char(c);
                    return false;
                }
                _ => return false,
            }
        }

        // ---- Voice hold-to-talk (Alt+V toggles recording on/off) ----------
        if key.code == KeyCode::Char('v')
            && key.modifiers.contains(KeyModifiers::ALT)
            && self.voice_recorder.is_some()
        {
            if !self.voice_recording {
                // First press: start recording.
                let (tx, rx) = tokio::sync::mpsc::channel(8);
                self.voice_event_rx = Some(rx);
                self.voice_recording = true;
                if let Some(ref recorder_arc) = self.voice_recorder {
                    let recorder = recorder_arc.clone();
                    // Use spawn_blocking so we don't hold a std::sync::MutexGuard
                    // across an await point.  start_recording internally spawns a
                    // tokio task and returns quickly, so blocking is negligible.
                    tokio::task::spawn_blocking(move || {
                        if let Ok(mut r) = recorder.lock() {
                            // start_recording is async but its real work happens in
                            // a spawned task; use block_on to drive the short setup.
                            tokio::runtime::Handle::current()
                                .block_on(r.start_recording(tx))
                                .ok();
                        }
                    });
                }
                self.notifications.push(
                    NotificationKind::Info,
                    "Recording\u{2026} (press Alt+V again to transcribe)".to_string(),
                    None,
                );
            } else {
                // Second press: stop recording.  stop_recording() just flips an
                // AtomicBool; drive it synchronously to avoid Send issues.
                self.voice_recording = false;
                if let Some(ref recorder_arc) = self.voice_recorder {
                    let recorder = recorder_arc.clone();
                    tokio::task::spawn_blocking(move || {
                        if let Ok(mut r) = recorder.lock() {
                            tokio::runtime::Handle::current()
                                .block_on(r.stop_recording())
                                .ok();
                        }
                    });
                }
                self.notifications.push(
                    NotificationKind::Info,
                    "Transcribing\u{2026}".to_string(),
                    Some(10),
                );
            }
            return false;
        }

        match key.code {
            // ---- Quit / cancel ----------------------------------------
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if self.is_streaming {
                    self.is_streaming = false;
                    self.spinner_verb = None;
                    self.streaming_text.clear();
                    self.tool_use_blocks.clear();
                    self.status_message = Some("Cancelled.".to_string());
                } else {
                    self.should_quit = true;
                }
            }
            KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if self.prompt_input.is_empty() {
                    self.should_quit = true;
                }
            }

            // ---- History search ----------------------------------------
            KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                // Open the new overlay-based history search
                let overlay = HistorySearchOverlay::open(&self.prompt_input.history);
                self.history_search_overlay = overlay;
                // Also open legacy for backwards compat
                let mut hs = HistorySearch::new();
                hs.update_matches(&self.prompt_input.history);
                self.history_search = Some(hs);
            }
            KeyCode::Char('p') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.global_search.open();
                self.refresh_global_search();
            }

            // ---- Help overlay ------------------------------------------
            KeyCode::F(1) => {
                self.show_help = !self.show_help;
                self.help_overlay.toggle();
            }
            KeyCode::Char('?') if key.modifiers.is_empty() && !self.is_streaming => {
                self.show_help = !self.show_help;
                self.help_overlay.toggle();
            }

            // ---- Text entry (blocked while streaming) ------------------
            KeyCode::Char(c) if !self.is_streaming => {
                if self.prompt_input.vim_enabled && self.prompt_input.vim_mode != VimMode::Insert {
                    self.prompt_input.vim_command(&c.to_string());
                } else {
                    self.prompt_input.insert_char(c);
                }
                self.refresh_prompt_input();
            }
            KeyCode::Backspace if !self.is_streaming => {
                self.prompt_input.backspace();
                self.refresh_prompt_input();
            }
            KeyCode::Delete if !self.is_streaming => {
                self.prompt_input.delete();
                self.refresh_prompt_input();
            }
            KeyCode::Left if !self.is_streaming => {
                self.prompt_input.move_left();
                self.sync_legacy_prompt_fields();
            }
            KeyCode::Right if !self.is_streaming => {
                self.prompt_input.move_right();
                self.sync_legacy_prompt_fields();
            }
            KeyCode::Home if !self.is_streaming => {
                self.prompt_input.cursor = 0;
                self.sync_legacy_prompt_fields();
            }
            KeyCode::End if !self.is_streaming => {
                self.prompt_input.cursor = self.prompt_input.text.len();
                self.sync_legacy_prompt_fields();
            }
            KeyCode::Tab if !self.is_streaming => {
                if !self.prompt_input.suggestions.is_empty() {
                    if self.prompt_input.suggestion_index.is_none() {
                        self.prompt_input.suggestion_index = Some(0);
                    }
                    self.prompt_input.accept_suggestion();
                    self.refresh_prompt_input();
                }
            }

            // ---- Submit ------------------------------------------------
            KeyCode::Enter if !self.is_streaming => {
                // New user input: snap back to bottom.
                self.auto_scroll = true;
                self.new_messages_while_scrolled = 0;
                self.scroll_offset = 0;
                return true;
            }

            // ---- Input history navigation ------------------------------
            KeyCode::Up => {
                if !self.prompt_input.suggestions.is_empty() && self.prompt_input.text.starts_with('/') {
                    self.prompt_input.suggestion_prev();
                } else if !self.prompt_input.history.is_empty() {
                    self.prompt_input.history_up();
                }
                self.refresh_prompt_input();
            }
            KeyCode::Down => {
                if !self.prompt_input.suggestions.is_empty() && self.prompt_input.text.starts_with('/') {
                    self.prompt_input.suggestion_next();
                } else if self.prompt_input.history_pos.is_some() {
                    self.prompt_input.history_down();
                }
                self.refresh_prompt_input();
            }

            // ---- Scroll ------------------------------------------------
            KeyCode::PageUp => {
                self.scroll_offset = self.scroll_offset.saturating_add(10);
                // Scrolling up disables auto-follow.
                self.auto_scroll = false;
            }
            KeyCode::PageDown => {
                let new_off = self.scroll_offset.saturating_sub(10);
                self.scroll_offset = new_off;
                if new_off == 0 {
                    // Scrolled all the way back to bottom — re-enable auto-follow.
                    self.auto_scroll = true;
                    self.new_messages_while_scrolled = 0;
                }
            }

            _ => {}
        }
        false
    }

    fn current_key_context(&self) -> KeyContext {
        if self.diff_viewer.open {
            KeyContext::DiffDialog
        } else if self.agents_menu.open || self.mcp_view.open || self.stats_dialog.open {
            KeyContext::Select
        } else if self.settings_screen.visible {
            KeyContext::Settings
        } else if self.theme_screen.visible {
            KeyContext::ThemePicker
        } else if self.rewind_flow.visible {
            KeyContext::Confirmation
        } else if self.help_overlay.visible {
            KeyContext::Help
        } else if self.history_search_overlay.visible || self.history_search.is_some() {
            KeyContext::HistorySearch
        } else if self.permission_request.is_some() {
            KeyContext::Confirmation
        } else if self.show_help {
            KeyContext::Help
        } else {
            KeyContext::Chat
        }
    }

    // -------------------------------------------------------------------
    // New overlay key handlers
    // -------------------------------------------------------------------

    fn handle_stats_dialog_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => self.stats_dialog.close(),
            KeyCode::Tab | KeyCode::Right => self.stats_dialog.next_tab(),
            KeyCode::BackTab | KeyCode::Left => self.stats_dialog.prev_tab(),
            KeyCode::Char('r') => self.stats_dialog.cycle_range(),
            KeyCode::Up => self.stats_dialog.scroll = self.stats_dialog.scroll.saturating_sub(1),
            KeyCode::Down => self.stats_dialog.scroll = self.stats_dialog.scroll.saturating_add(1),
            _ => {}
        }
    }

    fn handle_mcp_view_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => self.mcp_view.close(),
            KeyCode::Tab | KeyCode::Left | KeyCode::Right => self.mcp_view.switch_pane(),
            KeyCode::Up => self.mcp_view.select_prev(),
            KeyCode::Down => self.mcp_view.select_next(),
            KeyCode::Backspace => self.mcp_view.pop_search_char(),
            KeyCode::Char('r') => {
                self.pending_mcp_reconnect = true;
                self.status_message = Some("Reconnecting MCP runtime...".to_string());
            }
            KeyCode::Char(c) if key.modifiers.is_empty() => {
                if self.mcp_view.active_pane != crate::mcp_view::McpViewPane::ServerList {
                    self.mcp_view.push_search_char(c);
                }
            }
            _ => {}
        }
    }

    fn handle_agents_menu_key(&mut self, key: KeyEvent) {
        if matches!(self.agents_menu.route, AgentsRoute::Editor(_)) {
            match key.code {
                KeyCode::Esc => self.agents_menu.go_back(),
                KeyCode::Tab | KeyCode::Down => self.agents_menu.editor_next_field(),
                KeyCode::BackTab | KeyCode::Up => self.agents_menu.editor_prev_field(),
                KeyCode::Enter => self.agents_menu.editor_insert_newline(),
                KeyCode::Backspace => self.agents_menu.editor_backspace(),
                KeyCode::Char('s') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    match self.agents_menu.save_editor() {
                        Ok(msg) => self.status_message = Some(msg),
                        Err(err) => {
                            self.agents_menu.editor.error = Some(err.clone());
                            self.agents_menu.editor.saved_message = None;
                            self.status_message = Some(err);
                        }
                    }
                }
                KeyCode::Char(ch) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                    self.agents_menu.editor_insert_char(ch);
                }
                _ => {}
            }
            return;
        }

        match key.code {
            KeyCode::Esc | KeyCode::Char('q') | KeyCode::Backspace => self.agents_menu.go_back(),
            KeyCode::Up => self.agents_menu.select_prev(),
            KeyCode::Down => self.agents_menu.select_next(),
            KeyCode::Enter | KeyCode::Right => self.agents_menu.confirm_selection(),
            KeyCode::Left => self.agents_menu.go_back(),
            _ => {}
        }
    }

    fn handle_diff_viewer_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => self.diff_viewer.close(),
            KeyCode::Tab | KeyCode::Left | KeyCode::Right => self.diff_viewer.switch_pane(),
            KeyCode::Char('d') => {
                let root = self.project_root();
                self.diff_viewer.toggle_diff_type(&root);
            }
            KeyCode::Up => {
                if self.diff_viewer.active_pane == DiffPane::FileList {
                    self.diff_viewer.select_prev();
                } else {
                    self.diff_viewer.scroll_detail_up();
                }
            }
            KeyCode::Down => {
                if self.diff_viewer.active_pane == DiffPane::FileList {
                    self.diff_viewer.select_next();
                } else {
                    self.diff_viewer.scroll_detail_down();
                }
            }
            KeyCode::PageUp => self.diff_viewer.scroll_detail_up(),
            KeyCode::PageDown => self.diff_viewer.scroll_detail_down(),
            _ => {}
        }
    }

    fn handle_help_overlay_key(&mut self, key: KeyEvent) -> bool {
        match key.code {
            KeyCode::Esc | KeyCode::F(1) => {
                self.help_overlay.close();
                self.show_help = false;
            }
            KeyCode::Char('?') if key.modifiers.is_empty() => {
                self.help_overlay.close();
                self.show_help = false;
            }
            KeyCode::Up => {
                self.help_overlay.scroll_up();
            }
            KeyCode::Down => {
                let max = 50u16; // generous upper bound; renderer will clamp
                self.help_overlay.scroll_down(max);
            }
            KeyCode::Backspace => {
                self.help_overlay.pop_filter_char();
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.help_overlay.push_filter_char(c);
            }
            _ => {}
        }
        false
    }

    fn handle_history_search_overlay_key(&mut self, key: KeyEvent) -> bool {
        match key.code {
            KeyCode::Esc => {
                self.history_search_overlay.close();
                self.history_search = None;
            }
            KeyCode::Enter => {
                if let Some(entry) = self
                    .history_search_overlay
                    .current_entry(&self.prompt_input.history)
                {
                    self.set_prompt_text(entry.to_string());
                }
                self.history_search_overlay.close();
                self.history_search = None;
            }
            KeyCode::Up => {
                self.history_search_overlay.select_prev();
                if let Some(hs) = self.history_search.as_mut() {
                    if hs.selected > 0 {
                        hs.selected -= 1;
                    }
                }
            }
            KeyCode::Down => {
                self.history_search_overlay.select_next();
                if let Some(hs) = self.history_search.as_mut() {
                    let max = hs.matches.len().saturating_sub(1);
                    if hs.selected < max {
                        hs.selected += 1;
                    }
                }
            }
            KeyCode::Backspace => {
                let history = self.prompt_input.history.clone();
                self.history_search_overlay.pop_char(&history);
                if let Some(hs) = self.history_search.as_mut() {
                    hs.query.pop();
                    hs.update_matches(&history);
                }
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                let history = self.prompt_input.history.clone();
                self.history_search_overlay.push_char(c, &history);
                if let Some(hs) = self.history_search.as_mut() {
                    hs.query.push(c);
                    hs.update_matches(&history);
                }
            }
            _ => {}
        }
        false
    }

    fn handle_rewind_flow_key(&mut self, key: KeyEvent) -> bool {
        use crate::overlays::RewindStep;
        match &self.rewind_flow.step {
            RewindStep::Selecting => match key.code {
                KeyCode::Esc => {
                    self.rewind_flow.close();
                }
                KeyCode::Enter => {
                    self.rewind_flow.confirm_selection();
                }
                KeyCode::Up => {
                    self.rewind_flow.selector.select_prev();
                }
                KeyCode::Down => {
                    self.rewind_flow.selector.select_next();
                }
                _ => {}
            },
            RewindStep::Confirming { .. } => match key.code {
                KeyCode::Char('y') | KeyCode::Char('Y') => {
                    if let Some(idx) = self.rewind_flow.accept_confirm() {
                        // Truncate conversation to the selected message index.
                        self.messages.truncate(idx);
                        // Remove system annotations placed after the truncation point.
                        self.system_annotations.retain(|a| a.after_index <= idx);
                        self.notifications.push(
                            NotificationKind::Success,
                            format!("Rewound to message #{}", idx),
                            Some(4),
                        );
                    }
                }
                KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => {
                    self.rewind_flow.reject_confirm();
                }
                _ => {}
            },
        }
        false
    }

    fn handle_global_search_key(&mut self, key: KeyEvent) -> bool {
        match key.code {
            KeyCode::Esc => {
                self.global_search.close();
            }
            KeyCode::Enter => {
                if let Some(selected) = self.global_search.selected_ref() {
                    self.set_prompt_text(selected);
                }
                self.global_search.close();
            }
            KeyCode::Up => self.global_search.select_prev(),
            KeyCode::Down => self.global_search.select_next(),
            KeyCode::Backspace => {
                self.global_search.pop_char();
                self.refresh_global_search();
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.global_search.push_char(c);
                self.refresh_global_search();
            }
            _ => {}
        }
        false
    }

    fn handle_keybinding_action(&mut self, action: &str) -> bool {
        match action {
            "interrupt" => {
                if self.is_streaming {
                    self.is_streaming = false;
                    self.spinner_verb = None;
                    self.streaming_text.clear();
                    self.tool_use_blocks.clear();
                    self.status_message = Some("Cancelled.".to_string());
                } else {
                    self.should_quit = true;
                }
                false
            }
            "exit" => {
                if self.prompt_input.is_empty() {
                    self.should_quit = true;
                }
                false
            }
            "redraw" => false,
            "historySearch" => {
                let overlay = HistorySearchOverlay::open(&self.prompt_input.history);
                self.history_search_overlay = overlay;
                let mut hs = HistorySearch::new();
                hs.update_matches(&self.prompt_input.history);
                self.history_search = Some(hs);
                false
            }
            "openSearch" => {
                self.global_search.open();
                self.refresh_global_search();
                false
            }
            "submit" => !self.is_streaming,
            "historyPrev" => {
                if !self.prompt_input.history.is_empty() {
                    self.prompt_input.history_up();
                    self.refresh_prompt_input();
                }
                false
            }
            "historyNext" => {
                if self.prompt_input.history_pos.is_some() {
                    self.prompt_input.history_down();
                    self.refresh_prompt_input();
                }
                false
            }
            "scrollUp" => {
                self.scroll_offset = self.scroll_offset.saturating_add(10);
                self.auto_scroll = false;
                false
            }
            "scrollDown" => {
                let new_off = self.scroll_offset.saturating_sub(10);
                self.scroll_offset = new_off;
                if new_off == 0 {
                    self.auto_scroll = true;
                    self.new_messages_while_scrolled = 0;
                }
                false
            }
            "yes" => {
                self.permission_request = None;
                false
            }
            "no" => {
                self.permission_request = None;
                false
            }
            "prevOption" => {
                if let Some(pr) = self.permission_request.as_mut() {
                    if pr.selected_option > 0 {
                        pr.selected_option -= 1;
                    }
                }
                false
            }
            "nextOption" => {
                if let Some(pr) = self.permission_request.as_mut() {
                    if pr.selected_option + 1 < pr.options.len() {
                        pr.selected_option += 1;
                    }
                }
                false
            }
            "close" => {
                self.show_help = false;
                self.help_overlay.close();
                false
            }
            "select" => {
                // Legacy history search select
                if let Some(hs) = self.history_search.as_ref() {
                    if let Some(entry) = hs.current_entry(&self.prompt_input.history) {
                        self.set_prompt_text(entry.to_string());
                    }
                }
                self.history_search = None;
                self.history_search_overlay.close();
                false
            }
            "cancel" => {
                self.history_search = None;
                self.history_search_overlay.close();
                false
            }
            "prevResult" => {
                if let Some(hs) = self.history_search.as_mut() {
                    if hs.selected > 0 {
                        hs.selected -= 1;
                    }
                }
                self.history_search_overlay.select_prev();
                false
            }
            "nextResult" => {
                if let Some(hs) = self.history_search.as_mut() {
                    let max = hs.matches.len().saturating_sub(1);
                    if hs.selected < max {
                        hs.selected += 1;
                    }
                }
                self.history_search_overlay.select_next();
                false
            }
            _ => false,
        }
    }

    /// Handle a key event while in legacy history-search mode.
    fn handle_history_search_key(&mut self, key: KeyEvent) -> bool {
        let hs = match self.history_search.as_mut() {
            Some(h) => h,
            None => return false,
        };
        match key.code {
            KeyCode::Esc => {
                self.history_search = None;
                self.history_search_overlay.close();
            }
            KeyCode::Enter => {
                if let Some(entry) = hs.current_entry(&self.prompt_input.history) {
                    self.set_prompt_text(entry.to_string());
                }
                self.history_search = None;
                self.history_search_overlay.close();
            }
            KeyCode::Up => {
                if hs.selected > 0 {
                    hs.selected -= 1;
                }
            }
            KeyCode::Down => {
                let max = hs.matches.len().saturating_sub(1);
                if hs.selected < max {
                    hs.selected += 1;
                }
            }
            KeyCode::Backspace => {
                hs.query.pop();
                let history = self.prompt_input.history.clone();
                if let Some(hs) = self.history_search.as_mut() {
                    hs.update_matches(&history);
                }
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                hs.query.push(c);
                let history = self.prompt_input.history.clone();
                if let Some(hs) = self.history_search.as_mut() {
                    hs.update_matches(&history);
                }
            }
            _ => {}
        }
        false
    }

    /// Handle a key event while a permission dialog is active.
    fn handle_permission_key(&mut self, key: KeyEvent) {
        let pr = match self.permission_request.as_mut() {
            Some(p) => p,
            None => return,
        };

        match key.code {
            KeyCode::Char(c) => {
                if let Some(digit) = c.to_digit(10) {
                    let idx = (digit as usize).saturating_sub(1);
                    if idx < pr.options.len() {
                        pr.selected_option = idx;
                    }
                } else {
                    for (i, opt) in pr.options.iter().enumerate() {
                        if opt.key == c {
                            pr.selected_option = i;
                            self.permission_request = None;
                            return;
                        }
                    }
                }
            }
            KeyCode::Enter => {
                self.permission_request = None;
            }
            KeyCode::Up => {
                let pr = self.permission_request.as_mut().unwrap();
                if pr.selected_option > 0 {
                    pr.selected_option -= 1;
                }
            }
            KeyCode::Down => {
                let pr = self.permission_request.as_mut().unwrap();
                if pr.selected_option + 1 < pr.options.len() {
                    pr.selected_option += 1;
                }
            }
            KeyCode::Esc => {
                self.permission_request = None;
            }
            _ => {}
        }
    }

    // -------------------------------------------------------------------
    // Query event handling
    // -------------------------------------------------------------------

    /// Push a completed assistant message and trigger auto-scroll bookkeeping.
    fn push_assistant_message(&mut self, text: String) {
        let msg = Message::assistant(text);
        self.messages.push(msg);
        self.invalidate_transcript();
        self.on_new_message();
    }

    /// Process a query event from the agentic loop.
    pub fn handle_query_event(&mut self, event: QueryEvent) {
        match event {
            QueryEvent::Stream(stream_evt) => {
                if !self.is_streaming {
                    let seed = self.frame_count as usize ^ (self.messages.len() * 17);
                    self.spinner_verb = Some(sample_spinner_verb(seed).to_string());
                    self.turn_start = Some(std::time::Instant::now());
                    self.last_turn_elapsed = None;
                    self.last_turn_verb = None;
                }
                self.is_streaming = true;
                match stream_evt {
                    cc_api::StreamEvent::ContentBlockDelta { delta, .. } => {
                        // Reset stall timer on any incoming delta — we're making progress.
                        self.stall_start = None;
                        match delta {
                            cc_api::streaming::ContentDelta::TextDelta { text } => {
                                self.streaming_text.push_str(&text);
                                self.invalidate_transcript();
                            }
                            cc_api::streaming::ContentDelta::ThinkingDelta { thinking } => {
                                debug!(len = thinking.len(), "Thinking delta received");
                            }
                            _ => {}
                        }
                    }
                    cc_api::StreamEvent::MessageStop => {
                        self.is_streaming = false;
                        self.spinner_verb = None;
                        self.stall_start = None;
                        if !self.streaming_text.is_empty() {
                            let text = std::mem::take(&mut self.streaming_text);
                            self.push_assistant_message(text);
                        }
                    }
                    _ => {
                        // Any other stream event: if we have no stall_start yet,
                        // record now so the red-spinner timer can begin.
                        if self.stall_start.is_none() {
                            self.stall_start = Some(std::time::Instant::now());
                        }
                    }
                }
            }

            QueryEvent::ToolStart { tool_name, tool_id, input_json } => {
                if !self.is_streaming && self.spinner_verb.is_none() {
                    let seed = self.frame_count as usize ^ (self.messages.len() * 17);
                    self.spinner_verb = Some(sample_spinner_verb(seed).to_string());
                }
                self.is_streaming = true;
                self.status_message = Some(format!("Running {}…", tool_name));
                if let Some(existing) =
                    self.tool_use_blocks.iter_mut().find(|b| b.id == tool_id)
                {
                    existing.status = ToolStatus::Running;
                    existing.output_preview = None;
                    existing.input_json = input_json;
                } else {
                    self.tool_use_blocks.push(ToolUseBlock {
                        id: tool_id,
                        name: tool_name,
                        status: ToolStatus::Running,
                        output_preview: None,
                        input_json,
                    });
                }
                self.invalidate_transcript();
            }

            QueryEvent::ToolEnd {
                tool_name: _,
                tool_id,
                result,
                is_error,
            } => {
                // Build a multi-line preview: show up to 3 lines, truncate if more.
                let all_lines: Vec<&str> = result.lines().collect();
                let preview_lines = all_lines.len().min(3);
                let mut preview = all_lines[..preview_lines].join("\n");
                let remaining = all_lines.len().saturating_sub(preview_lines);
                if remaining > 0 {
                    preview.push_str(&format!("\n\u{2026} {} more lines", remaining));
                }
                if let Some(block) =
                    self.tool_use_blocks.iter_mut().find(|b| b.id == tool_id)
                {
                    block.status = if is_error {
                        ToolStatus::Error
                    } else {
                        ToolStatus::Done
                    };
                    block.output_preview = Some(preview);
                }
                self.invalidate_transcript();
                if is_error {
                    self.status_message = Some(format!("Tool error: {}", result));
                } else {
                    self.status_message = None;
                }
                self.refresh_turn_diff_from_history();
            }

            QueryEvent::TurnComplete { turn, stop_reason, .. } => {
                debug!(turn, stop_reason, "Turn complete");
                self.is_streaming = false;
                self.spinner_verb = None;
                // Record elapsed time and pick a completion verb
                if let Some(start) = self.turn_start.take() {
                    let secs = start.elapsed().as_secs();
                    let seed = self.frame_count as usize ^ (self.messages.len() * 7);
                    self.last_turn_elapsed = Some(format_elapsed(secs));
                    self.last_turn_verb = Some(sample_completion_verb(seed));
                }
                if !self.streaming_text.is_empty() {
                    let text = std::mem::take(&mut self.streaming_text);
                    self.push_assistant_message(text);
                }
                self.tool_use_blocks.retain(|b| b.status != ToolStatus::Running);
                self.invalidate_transcript();
                self.refresh_turn_diff_from_history();
            }

            QueryEvent::Status(msg) => {
                self.status_message = Some(msg);
            }

            QueryEvent::Error(msg) => {
                self.is_streaming = false;
                self.spinner_verb = None;
                self.streaming_text.clear();
                self.invalidate_transcript();
                let err_msg = format!("Error: {}", msg);
                self.push_assistant_message(err_msg.clone());
                self.status_message = Some(err_msg);
            }
            QueryEvent::TokenWarning { state, pct_used } => {
                // Display a status bar warning when approaching the context limit.
                use cc_query::compact::TokenWarningState;
                let msg = match state {
                    TokenWarningState::Ok => None,
                    TokenWarningState::Warning => Some(format!(
                        "Context window {:.0}% full — consider /compact",
                        pct_used * 100.0
                    )),
                    TokenWarningState::Critical => Some(format!(
                        "Context window {:.0}% full — /compact recommended now",
                        pct_used * 100.0
                    )),
                };
                if let Some(warning) = msg {
                    self.status_message = Some(warning);
                }
            }
        }

        // Re-sync token count from tracker and check warning thresholds.
        self.token_count = self.cost_tracker.total_tokens() as u32;
        self.check_token_warnings();
    }

    // -------------------------------------------------------------------
    // Main run loop
    // -------------------------------------------------------------------

    /// Run the TUI event loop. Returns `Some(input)` when the user submits
    /// a message, or `None` when the user quits.
    pub fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    ) -> anyhow::Result<Option<String>> {
        loop {
            self.frame_count = self.frame_count.wrapping_add(1);

            // Sync cost/token counters from the shared tracker
            self.cost_usd = self.cost_tracker.total_cost_usd();
            self.token_count = self.cost_tracker.total_tokens() as u32;

            // Expire old notifications
            self.notifications.tick();

            // Draw the frame
            terminal.draw(|f| render::render_app(f, self))?;

            // Poll for events with a short timeout so we can redraw for animation
            if event::poll(std::time::Duration::from_millis(50))? {
                match event::read()? {
                    Event::Key(key) => {
                        // On Windows crossterm fires Press + Release; only handle Press.
                        if key.kind != crossterm::event::KeyEventKind::Press {
                            continue;
                        }
                        let should_submit = self.handle_key_event(key);
                        if self.should_quit {
                            return Ok(None);
                        }
                        if should_submit {
                            // Check if this is a slash command that should open a UI screen
                            if crate::input::is_slash_command(&self.prompt_input.text) {
                                let cmd = {
                                    let (c, _) =
                                        crate::input::parse_slash_command(&self.prompt_input.text);
                                    c.to_string()
                                };
                                if self.intercept_slash_command(&cmd) {
                                    self.clear_prompt();
                                    continue;
                                }
                            }
                            let input = self.take_input();
                            if !input.is_empty() {
                                return Ok(Some(input));
                            }
                        }
                    }
                    Event::Paste(data)
                        if !self.is_streaming
                            && self.permission_request.is_none()
                            && !self.history_search_overlay.visible
                            && self.history_search.is_none() =>
                    {
                        self.prompt_input.paste(&data);
                        self.refresh_prompt_input();
                    }
                    _ => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_app() -> App {
        let config = Config::default();
        let cost_tracker = cc_core::cost::CostTracker::new();
        App::new(config, cost_tracker)
    }

    #[test]
    fn test_clear_slash_command_clears_messages() {
        let mut app = make_app();
        app.add_message(Role::User, "hello".to_string());
        app.add_message(Role::Assistant, "world".to_string());
        assert_eq!(app.messages.len(), 2);
        assert!(app.intercept_slash_command("clear"));
        assert_eq!(app.messages.len(), 0);
    }

    #[test]
    fn test_exit_slash_command_sets_quit_flag() {
        let mut app = make_app();
        assert!(!app.should_quit);
        assert!(app.intercept_slash_command("exit"));
        assert!(app.should_quit);
    }

    #[test]
    fn test_vim_slash_command_toggles_vim() {
        let mut app = make_app();
        assert!(!app.prompt_input.vim_enabled);
        assert!(app.intercept_slash_command("vim"));
        assert!(app.prompt_input.vim_enabled);
        assert!(app.intercept_slash_command("vim"));
        assert!(!app.prompt_input.vim_enabled);
    }

    #[test]
    fn test_model_slash_command_opens_picker() {
        let mut app = make_app();
        assert!(!app.model_picker.visible);
        assert!(app.intercept_slash_command("model"));
        assert!(app.model_picker.visible);
    }

    #[test]
    fn test_fast_slash_command_toggles_fast_mode() {
        let mut app = make_app();
        assert!(!app.fast_mode);
        assert!(app.intercept_slash_command("fast"));
        assert!(app.fast_mode);
        assert!(app.intercept_slash_command("fast"));
        assert!(!app.fast_mode);
    }

    #[test]
    fn test_output_style_cycles() {
        let mut app = make_app();
        assert_eq!(app.output_style, "auto");
        assert!(app.intercept_slash_command("output-style"));
        assert_eq!(app.output_style, "stream");
        assert!(app.intercept_slash_command("output-style"));
        assert_eq!(app.output_style, "verbose");
        assert!(app.intercept_slash_command("output-style"));
        assert_eq!(app.output_style, "auto");
    }
}
