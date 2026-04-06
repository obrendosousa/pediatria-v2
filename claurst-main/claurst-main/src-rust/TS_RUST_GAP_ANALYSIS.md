# TypeScript → Rust 1:1 Parity Gap Analysis

> Generated: 2026-04-02
> **Status as of Batch 15 (2026-04-02): All P0 and P1 gaps implemented. 929 tests, 0 failures.**
>
> Items marked ~~done~~ below were completed in Batch 15. Remaining open items are P2 only.

> Rust state as of Batch 14 (801 tests, all passing).
> Status legend: **done** · **partial** · **missing**

---

## How to read this document

Each section lists TypeScript features with their current Rust parity status.
Priority:
- **P0** — Visible in every session; users will notice immediately if missing
- **P1** — Significant capability gap; degrades daily use
- **P2** — Nice-to-have; polish, power-user, or edge-case features

---

## 1. Message Rendering (31 TS components → Rust equivalents)

### 1.1 User-role messages

| TS Component | Rust Renderer | Status | Notes |
|---|---|---|---|
| `UserPromptMessage` | `render_user_text` | **done** | |
| `UserTextMessage` | `render_user_text` | **done** | |
| `UserBashInputMessage` | `render_bash_input_line` | **done** | MSG-01 (Batch 14) |
| `UserBashOutputMessage` | `render_bash_output_block` | **done** | MSG-01 (Batch 14) |
| `UserImageMessage` | image block in `render_message` | **partial** | Shows `[Image: W×H]` placeholder; no inline image rendering |
| `UserLocalCommandOutputMessage` | — | **missing** | Output from `!`-prefixed local shell commands; should show faint gray block with command header |
| `UserCommandMessage` | — | **missing** | Skill invocation (`▸ Skill(name)`) or slash command display; show chevron + command name + args |
| `UserChannelMessage` | — | **missing** | Channel/teammate communication message; shows sender badge + message body |
| `UserMemoryInputMessage` | — | **missing** | `# key: value` memory writes; show `#` prefix in cyan + "Got it." confirmation footer |
| `UserPlanMessage` | `render_plan_steps` | **done** | |
| `UserTeammateMessage` | — | **missing** | Teammate-originated message in multi-agent sessions; shows teammate badge + indent |
| `UserResourceUpdateMessage` | — | **missing** | MCP resource refresh notification: `↻ server: uri · reason` |
| `UserAgentNotificationMessage` | `render_agent_notification` | **partial** | Renders text only; missing agent type badge and severity color-coding |

### 1.2 Assistant-role messages

| TS Component | Rust Renderer | Status | Notes |
|---|---|---|---|
| `AssistantTextMessage` | `render_assistant_text` | **done** | Full markdown rendering |
| `AssistantThinkingMessage` | `render_thinking_block` | **done** | Collapse/expand toggle |
| `AssistantRedactedThinkingMessage` | `render_thinking_block` | **done** | Shown as collapsed-only |
| `AssistantToolUseMessage` | `render_tool_use` + bash dispatch | **done** | Bash uses `render_bash_input_line` |

### 1.3 System messages

| TS Component | Rust Renderer | Status | Notes |
|---|---|---|---|
| `SystemTextMessage` | `render_system_message` | **done** | |
| `SystemAPIErrorMessage` | — | **missing** | Retry countdown timer + truncated error with `[expand]` hint; distinct red border |

### 1.4 Special messages

| TS Component | Rust Renderer | Status | Notes |
|---|---|---|---|
| `AttachmentMessage` | `render_attachment_message` | **done** | Width-scaled preview |
| `AdvisorMessage` | `render_advisor_message` | **done** | loading/done states |
| `PlanApprovalMessage` | `render_plan_approval` | **done** | |
| `RateLimitMessage` | `render_rate_limit_banner` | **partial** | Shows countdown; missing upsell options (upgrade link) |
| `ShutdownMessage` | `render_shutdown_message` | **done** | |
| `HookProgressMessage` | `render_hook_progress` | **done** | |
| `CompactBoundaryMessage` | `render_compact_boundary` | **done** | |
| `CollapsedReadSearchContent` | — | **missing** | Grouped read/search tool calls collapsed into single row; `+ N more` expand pattern |
| `TaskAssignmentMessage` | — | **missing** | Cyan-bordered box: Task ID, subject, description; used in agentic sub-task assignment |
| `GroupedToolUseContent` | — | **missing** | Multiple tool calls from one assistant turn collapsed under a single expandable header |
| `teamMemCollapsed` | — | **missing** | Teammate collapsed summary row in multi-agent transcript |

### Implementation plan for missing/partial message types (P1)

**Batch 15 candidates:**
1. `SystemAPIErrorMessage` — add `render_system_api_error(msg: &str, retry_secs: Option<u32>)` to `messages/mod.rs`. Show a red-bordered block, first 5 lines visible, `[expand]` hint when truncated, countdown line when `retry_secs` is set.
2. `UserCommandMessage` — add `render_user_command(name: &str, args: &str)` — chevron prefix + cyan command name.
3. `UserMemoryInputMessage` — add `render_user_memory_input(key: &str, value: &str)` — `# key: value` in cyan + "Got it." footer.
4. `UserLocalCommandOutputMessage` — add `render_local_command_output(command: &str, output: &str)` — faint gray block.
5. `CollapsedReadSearchContent` — add `render_collapsed_read_search(tool_name: &str, paths: &[&str], n_hidden: usize)` — `▸ Read N files (+ M more)`.
6. `TaskAssignmentMessage` — add `render_task_assignment(id: &str, subject: &str, desc: &str)` — cyan top-border box.
7. `GroupedToolUseContent` — add `render_grouped_tool_use(names: &[&str])` — collapsible header row.
8. `RateLimitMessage` upsell — extend `render_rate_limit_banner` to accept optional `upgrade_hint: bool`.
9. `UserResourceUpdateMessage` — add `render_resource_update(server: &str, uri: &str, reason: &str)` — `↻` prefix.
10. `UserAgentNotificationMessage` — extend `render_agent_notification` with severity param (info/warn/error).

---

## 2. Slash Commands

### 2.1 Current Rust intercept coverage

The Rust `intercept_slash_command()` handles 16 commands:

| Command | Rust Action |
|---|---|
| `/config`, `/settings` | Open settings screen |
| `/theme` | Open theme picker |
| `/privacy`, `/privacy-settings` | Open privacy dialog |
| `/stats` | Open stats dialog |
| `/mcp` | Open MCP view |
| `/agents` | Open agents browser |
| `/diff` | Open git diff viewer |
| `/changes` | Open turn diff viewer |
| `/search`, `/find` | Open global search |
| `/survey`, `/feedback` | Open feedback survey |
| `/memory` | Open memory file selector |
| `/hooks` | Open hooks config menu |

### 2.2 Missing slash commands (P0/P1)

The TypeScript REPL handles ~70 slash commands. Major missing ones:

| Command | Priority | TS Behavior | Rust Action Needed |
|---|---|---|---|
| `/help` | P0 | Show help overlay with all commands | Add help overlay or show overlay with keybinding hints |
| `/clear` | P0 | Clear transcript and reset session | Reset `app.messages`, `app.annotations`, etc. |
| `/compact` | P0 | Compact transcript context | Trigger compact request via CLI event |
| `/exit`, `/quit` | P0 | Exit the application | Set `app.should_quit = true` |
| `/vim` | P0 | Toggle vim mode | Toggle `app.prompt.vim_mode` |
| `/model` | P1 | Open model picker | Add `ModelPickerState` overlay (see §5) |
| `/copy` | P1 | Copy last response to clipboard | Write last assistant text to clipboard |
| `/output-style` | P1 | Cycle output style (auto/stream/verbose) | Toggle `output_style` app field |
| `/keybindings` | P1 | Show keybindings dialog | Show keybindings overlay (see §5) |
| `/login` | P1 | Trigger OAuth login flow | Emit login event to CLI loop |
| `/logout` | P1 | Logout and clear auth | Emit logout event to CLI loop |
| `/cost` | P1 | Show cost breakdown | Show cost section of stats dialog |
| `/fast` | P1 | Toggle fast mode | Toggle fast mode app field |
| `/effort` | P1 | Set effort level | Cycle effort levels |
| `/voice` | P1 | Toggle voice mode | Toggle `app.voice_mode` |
| `/doctor` | P1 | Run diagnostics | Trigger doctor action via CLI |
| `/init` | P1 | Initialize CLAUDE.md | Trigger init via CLI |
| `/review` | P1 | Open diff review | Navigate to diff viewer |
| `/rewind` | P1 | Rewind to earlier turn | Show rewind overlay |
| `/resume` | P1 | Resume a past session | Show session browser |
| `/commit` | P2 | Invoke commit skill | Invoke skill via CLI |
| `/context` | P2 | Show context visualization | Add context viz overlay |
| `/rename` | P2 | Rename current session | Prompt for new session name |
| `/export` | P2 | Export conversation | Trigger export |
| `/session` | P2 | Manage sessions | Show session browser overlay |

**Implementation plan:**
Add a second intercept pass in `lib.rs` event handling (before passing to query) for the P0 commands. For P1, add state fields + handlers. The cleanest approach is:
1. Add `/help` — render `render_help_overlay()` in overlays.rs
2. Add `/clear`, `/exit` — pure app state mutations
3. Add `/compact` — emit `AppEvent::RequestCompact` to CLI loop
4. Add `/vim` — toggle `app.prompt.vim_mode`
5. Add `/model` — new `ModelPickerState` overlay

---

## 3. Prompt Input & Footer

### 3.1 Left-side footer elements

| TS Component | Rust Status | Notes |
|---|---|---|
| PR badge (`PrBadge`) | **missing** | Shows PR number + review state when `CLAUDE_PR_*` env vars or git PR detected |
| Team selector pill (`TeamStatus`) | **missing** | ANT-only for now; can be gated |
| Background task status (`BackgroundTaskStatus`) | **missing** | Pill for non-local_agent background tasks |
| Tungsten/tmux pill (`TungstenPill`) | **missing** | ANT-only; can be gated |
| VIM mode indicator | **done** | `-- INSERT --` / `-- NORMAL --` badges |
| Permission mode indicator | **partial** | Shows in status bar but not as a clear left-side pill |
| Proactive countdown | **missing** | Countdown timer for proactive actions |
| Voice warmup hint | **missing** | Hint shown during voice warmup phase |

### 3.2 Vim editor parity

| Feature | Rust Status | Notes |
|---|---|---|
| Basic motions (h/j/k/l, w/b/e, W/B/E) | **done** | Batch 10 |
| Count prefixes (3w, 5j) | **done** | Batch 10 |
| Operators (d/c/y + motion) | **done** | Batch 10 |
| Line operators (dd/yy/cc) | **done** | Batch 10 |
| Find (f/t/F/T + ;/,) | **done** | Batch 10 |
| Replace (r) | **done** | Batch 10 |
| Undo (u) | **done** | Batch 10 |
| Visual mode (v + y/d/c) | **done** | Batch 10 |
| gg / G | **done** | Batch 10 |
| Registers (`"ay`, `"ap`) | **missing** | TS vim has named register support |
| Macros (`qq`, `q`, `@q`) | **missing** | TS vim has macro record/replay |
| Marks (`ma`, `'a`) | **missing** | TS vim has mark set/jump |
| Command-line mode (`:`) | **missing** | TS vim has `:` command mode |
| Repeat (`.`) | **missing** | TS vim has dot-repeat |
| Search within prompt (`/`, `n`, `N`) | **missing** | In-prompt search |
| Visual line mode (`V`) | **missing** | |
| Visual block mode (`Ctrl+V`) | **missing** | |

### 3.3 Paste / image input

| Feature | Rust Status | Notes |
|---|---|---|
| Text paste (Ctrl+V) | **done** | Routes through `PromptInputState::paste` |
| Large paste with placeholder | **done** | Batch 1 |
| Image paste (clipboard image) | **missing** | TS detects image on clipboard and attaches it |
| Drag-and-drop file | **missing** | TS handles dragover/drop events |
| Lazy space after pills | **missing** | TS inserts space after suggestion acceptance if next char is not space |
| Bash mode (`!` prefix) | **partial** | `!` prefix detection exists but no distinct visual bash mode |

### 3.4 History search

| Feature | Rust Status | Notes |
|---|---|---|
| Basic history up/down | **done** | |
| Substring filter in history | **partial** | `overlays.rs` has history search overlay |
| Timestamps in history | **missing** | TS shows relative timestamps in history dropdown |
| Fuzzy/subsequence match | **missing** | TS uses subsequence scoring |
| Pinned history entries | **missing** | TS allows pinning frequently used prompts |

---

## 4. Status Line

### 4.1 Current Rust status bar (right side)

Done: streaming spinner · context window `{used}k/{total}k ({pct}%)` color-coded · cost `$X.XX` · rate limit bars · vim mode badge · agent type badge · worktree branch · bridge badge.

### 4.2 TS `StatusLine.tsx` features not yet in Rust

| Feature | Priority | Notes |
|---|---|---|
| External command execution (`executeStatusLineCommand()`) | P1 | TS runs a configurable external command; output is ANSI-rendered in the status bar. Controlled by `CLAUDE_STATUS_COMMAND` env var. |
| Debounced updates (500ms) | P1 | Rust re-renders every frame; TS debounces status command at 500ms. Rust should rate-limit the status command execution if implemented. |
| Left-side model name display | P2 | TS shows current model name in left side of status bar |
| Token budget warning color | **partial** | Done (color-coded %) but TS also shows "auto-compact" callout in amber when approaching limit |

### 4.3 External status line implementation plan

```
App field: status_line_override: Option<String>   // raw ANSI string
CLI loop: spawn status command on interval (500ms), update app field
render.rs: parse ANSI in status_line_override and render in left/right status zone
```

---

## 5. Dialogs and Overlays

### 5.1 TS dialogs with no Rust equivalent

| TS Dialog | Priority | Description |
|---|---|---|
| `InvalidConfigDialog` | P0 | Shown on startup when `settings.json` or `CLAUDE.md` is malformed; blocks use until dismissed or fixed |
| `InvalidSettingsDialog` | P0 | Variant for specific settings validation failures |
| `QuickOpenDialog` | P1 | Quick file opener (distinct from global search); navigable file list |
| `HistorySearchDialog` | P1 | Full history search with timestamps and fuzzy scoring |
| `ModelPickerDialog` | P1 | Pick from available models; shows pricing, capability badges |
| `OutputStylePicker` | P1 | Pick output style (auto / stream / verbose) |
| `BridgeDialog` | P1 | Bridge connection status and QR code for mobile handoff |
| `IdeOnboardingDialog` | P2 | First-run IDE extension setup wizard |
| `IdleReturnDialog` | P2 | "Welcome back" dialog after session idle |
| `WorktreeExitDialog` | P2 | Confirm worktree cleanup on exit |
| `BypassPermissionsModeDialog` | P2 | Confirm entering bypass-permissions (dangerous) mode |
| `AutoModeOptInDialog` | P2 | Opt-in to automatic tool approval |
| `CostThresholdDialog` | P2 | Cost threshold warning when session exceeds limit |
| `ChannelDowngradeDialog` | P2 | Notify user of channel downgrade |
| `MCPServerApprovalDialog` | P2 | Approve MCP server connection for this session |
| `ClaudeMdExternalIncludesDialog` | P2 | Show external CLAUDE.md includes and prompt to trust them |
| `ExportDialog` | P2 | Export conversation in various formats |
| `RemoteEnvironmentDialog` | P2 | Remote environment connection setup |
| `DevChannelsDialog` | P2 | Dev channel selector |
| `IdeAutoConnectDialog` | P2 | IDE auto-connect setup |

### 5.2 Help overlay

The Rust TUI has no `/help` screen at all. TS shows a searchable command list.

**Minimal implementation:** add `HelpOverlayState` to `overlays.rs` with a static list of commands + keybindings; open on `/help` or `?` in normal mode.

### 5.3 Permission dialogs (Bash-specific)

TS `BashPermissionDialog` has **5 options** depending on classifier result:
1. Allow once
2. Allow for this session
3. Allow for project (add to `.claude/settings.json`)
4. Deny
5. *(if classifier suggests it)* Allow with prefix rule (e.g., allow `git commit*`)

Rust `dialogs.rs` has a **generic 4-option** dialog (once / session / global / deny).

**Gap:** no prefix-based allow option, no classifier integration. File permission dialog in TS has 3 options (once/session/deny) vs Rust's generic 4.

---

## 6. Settings Screen

### 6.1 TS settings not in Rust

| Setting | Tab | Priority | Notes |
|---|---|---|---|
| Auto-compact threshold (slider) | General | P1 | Controls when context is auto-compacted; 0-100% |
| Speculative decoding toggle | General | P1 | Enables/disables speculative execution |
| Reduce motion toggle | Display | P2 | Disables animations |
| Terminal progress bar toggle | Display | P2 | Show/hide progress bars during tool use |
| Show turn duration | Display | P2 | Show elapsed time per turn |
| Desktop notifications | General | P1 | OS-level notifications on turn complete |
| Push settings to cloud | General | P2 | Sync settings to Claude account |
| Auto-accept tools after N turns | General | P1 | Auto-approval threshold |
| Context-aware completions | General | P2 | Use project context for suggestions |
| Model selector | General | P0 | Pick default model; TS has `ModelPicker` component with tier/pricing |
| Theme picker (visual) | Display | P1 | Color theme selection with swatches; Rust has `theme_screen.rs` but limited |
| Language/locale picker | Display | P2 | UI language selector |
| Output style default | General | P1 | Default output style (auto/stream/verbose) |
| Keybindings editor | Advanced | P1 | Customize keyboard shortcuts per action |
| Max tokens override | Advanced | P2 | Per-session max token budget |
| Effort level default | Advanced | P2 | Default effort level for new sessions |

### 6.2 Current Rust settings tabs

`settings_screen.rs` has: **General**, **Display**, **Privacy**, **Advanced**, **KeyBindings** — but most tabs show placeholder content or minimal real settings. `Privacy` is fully real (reads from `settings.json` via `PrivacySnapshot::load()`).

---

## 7. Agent Progress and Multi-Agent

### 7.1 `AgentProgressLine` component

TS `AgentProgressLine.tsx` renders a tree structure:
```
├─ [coordinator] Orchestrator (3 tools, 1.2k tokens)
│  └─ [subagent] Explorer Agent (5 tools, 800 tokens) ✓
│     └─ [tool] BashTool running...
```

Rust has `agents_view.rs` which shows agent definitions, but **no tree-structure live progress view** during active multi-agent sessions.

**Gap:**
- No `├─` / `└─` tree rendering for live agent hierarchy
- No per-agent tool count / token count display
- No real-time status line per agent ("running", "waiting", "done")
- No agent type badge colors (coordinator=blue, subagent=cyan, tool=gray)

### 7.2 `CoordinatorAgentStatus` and `TeammateViewHeader`

TS has distinct coordinator status and teammate view header for multi-agent sessions. Both are **missing** from Rust.

### 7.3 `TokenWarning`

TS `TokenWarning.tsx` shows:
- Color-coded percentage bar (green → yellow → red)
- Auto-compact callout in amber at ~80%
- Explicit "compact now" affordance button

Rust status bar shows the percentage color-coded but lacks:
- The callout message for "approaching limit"
- Any in-line "compact now" action hint
- The visual bar widget

---

## 8. Stats Dialog

### 8.1 Current Rust stats

`stats_dialog.rs` has three tabs:
1. **Overview** — totals (input/output/cache tokens, cost, turns, session duration)
2. **Daily Tokens** — per-day token counts (sparklines)
3. **Cost Heatmap** — calendar heatmap of cost

### 8.2 TS `Stats.tsx` features not yet ported

| Feature | Priority | Notes |
|---|---|---|
| Activity heatmap (commits-style) | P2 | GitHub-style grid showing session days |
| Streak tracking | P2 | Days-in-a-row stats; "current streak: N" |
| Per-model breakdown | P1 | Token/cost split by model within a session |
| Model switching history | P2 | When the model was changed during the session |
| Session export | P2 | Export stats as JSON/CSV |
| Skill/tool invocation counts | P2 | Which tools were called most often |

---

## 9. Voice Mode

| Feature | Rust Status | Notes |
|---|---|---|
| Voice mode toggle | **partial** | `voice_mode_notice.rs` shows notice; `app.voice_mode` field exists |
| Microphone capture | **missing** | TS uses Web Audio API / native audio |
| Whisper transcription | **missing** | TS pipes audio to Whisper endpoint |
| Transcription → prompt injection | **missing** | TS injects transcribed text into prompt input |
| Voice warmup phase UI | **missing** | TS shows warmup progress in footer |
| PTT (push-to-talk) keybinding | **missing** | TS has configurable PTT key |

Voice mode is a significant feature gap but may not be achievable in a pure terminal context without platform-specific audio APIs. Mark as **P2 (platform-limited)**.

---

## 10. Diff Viewer

### 10.1 Current Rust diff parity

Done: git diff · turn diff · word-level inline diffs · `[new]`/`[binary]` badges · is_new_file detection · gutter width fix.

### 10.2 Remaining gaps

| Feature | Priority | TS Reference | Notes |
|---|---|---|---|
| Syntax highlighting in diff | P2 | `StructuredDiff.tsx` / `HighlightedCode.tsx` | TS uses `highlight.js`; Rust could use `syntect` |
| Per-file expand/collapse | P2 | `FileEditToolDiff.tsx` | Click to show/hide individual file diffs |
| Diff for notebook cells | P2 | `NotebookEditToolUseRejectedMessage.tsx` | Jupyter cell-level diff |
| Blame view | P2 | N/A | Not in TS either; skip |
| Side-by-side view | P2 | N/A | TS only shows unified diff |

---

## 11. MCP

### 11.1 Done

Real reconnect · live manager state · elicitation dialog (all field kinds) · resource/prompt counts.

### 11.2 Remaining gaps

| Feature | Priority | Notes |
|---|---|---|
| MCP server approval dialog | P1 | On first connection, TS shows `MCPServerApprovalDialog` prompting to trust the server |
| MCP desktop import dialog | P2 | `MCPServerDesktopImportDialog` — import MCP server config from desktop app |
| Elicitation progress/spinner | P2 | TS shows spinner while waiting for elicitation results |
| MCP server error detail | P1 | Rust shows status; TS shows clickable error with full stderr |

---

## 12. Virtual Message List

### 12.1 Done

`VirtualList<RenderedLineItem>` scrolling · `COMPLETED_MSG_CACHE` (O(1) streaming re-renders) · `MESSAGE_LINES_CACHE` (full cache on idle).

### 12.2 Remaining gaps

| Feature | Priority | TS Reference | Notes |
|---|---|---|---|
| Search result highlighting | P1 | `VirtualMessageList.tsx` yellow bg on matched text | When search overlay is active, matching lines in transcript should highlight |
| Sticky section headers | P2 | `VirtualMessageList.tsx` sticky date/turn headers | Headers pin to top as user scrolls |
| Click-to-expand thinking | P2 | `ThinkingToggle.tsx` | In TS, click expands; Rust uses keyboard |
| Height cache per width | **done** | `COMPLETED_MSG_CACHE` keys on width | |
| Jump-to-result from search | **done** | `SEARCH-01` | |

---

## 13. Onboarding and Startup

| TS Surface | Rust Status | Notes |
|---|---|---|
| `Onboarding.tsx` first-run wizard | **missing** | Multi-step first-run setup; auth, theme, CLAUDE.md |
| `IdeOnboardingDialog` | **missing** | IDE extension setup |
| `LogoV2` (startup animation) | **done** | Clawd mascot + logo |
| `OverageCreditUpsell` | **done** | Batch 10 |
| `VoiceModeNotice` | **done** | Batch 10 |
| `DesktopUpsellStartup` | **done** | Batch 11 |
| `AutoUpdater` check | **missing** | TS shows update available banner; Rust has no auto-update check |
| `IdeAutoConnectDialog` | **missing** | IDE auto-connect setup (shown on IDE launch) |
| `ShowInIDEPrompt` | **missing** | Prompt to switch to IDE view |

---

## 14. Other Notable Gaps

### 14.1 Context visualization

TS has `ContextVisualization.tsx` — a graphical breakdown of what's in the context window (files, code, conversation). Rust has no equivalent.

### 14.2 Session management

| Feature | Rust Status | Notes |
|---|---|---|
| Session list browser | **missing** | TS has session picker overlay |
| Session rename | **missing** | `/rename` command |
| Session export | **missing** | Export conversation as markdown/JSON |
| Session resume from file | **missing** | TS `ResumeTask.tsx` / `/resume` command |
| Session preview | **missing** | `SessionPreview.tsx` — hover preview of saved session |

### 14.3 Teleport / remote

TS has a Teleport integration for remote Claude sessions:
- `TeleportStash`, `TeleportProgress`, `TeleportError`, `TeleportResumeWrapper`
- These are specialized ANT-internal features; **P2/skip** for the open source port.

### 14.4 AWS auth

TS has `AwsAuthStatusBox.tsx` — shows AWS Bedrock auth status. Rust has no AWS-specific auth UI. **P2**.

### 14.5 Diagnostics

TS has `DiagnosticsDisplay.tsx` and `/doctor` command. Rust has neither. **P1** — diagnostics are important for debugging connectivity issues.

### 14.6 Clipboard

TS has `/copy` (copy last response to clipboard). Rust has no clipboard integration. **P1**.

### 14.7 Keybindings config

TS has a full `ConfigurableShortcutHint` system and keybindings settings tab. Rust settings screen has a `KeyBindings` tab but it is read-only and shows hardcoded defaults. **P1**.

### 14.8 Background tasks

TS has `BackgroundTaskStatus` in the footer. Rust has no background task tracking. **P1** for users using sub-agent tasks.

---

## Priority Summary

### P0 — Must fix next

| # | Gap | Batch |
|---|---|---|
| 1 | `/clear`, `/exit`, `/help`, `/compact`, `/vim` slash commands | 15 |
| 2 | `InvalidConfigDialog` / `InvalidSettingsDialog` (startup blockers) | 15 |
| 3 | `SystemAPIErrorMessage` renderer (retry countdown, expand) | 15 |

### P1 — Significant capability gaps

| # | Gap |
|---|---|
| 4 | Full slash command set (~50 more) |
| 5 | `UserCommandMessage` / `UserMemoryInputMessage` / `UserLocalCommandOutputMessage` renderers |
| 6 | Model picker overlay (`/model`) |
| 7 | External status line command (`CLAUDE_STATUS_COMMAND`) |
| 8 | PR badge in prompt footer |
| 9 | Background task status in footer |
| 10 | Permission dialog: prefix-based allow option for Bash |
| 11 | History search: timestamps + fuzzy match |
| 12 | MCP server approval dialog |
| 13 | MCP server error detail |
| 14 | Diagnostics (`/doctor`) |
| 15 | Clipboard copy (`/copy`) |
| 16 | Session list / resume |
| 17 | Auto-compact callout in token warning |
| 18 | Per-model stats breakdown |
| 19 | Settings: model selector, auto-compact threshold, notification toggles |
| 20 | Agent progress live tree view (`AgentProgressLine`) |

### P2 — Polish and power-user

| # | Gap |
|---|---|
| 21 | Vim registers, macros, marks, command-line mode, dot-repeat |
| 22 | Voice mode pipeline (platform-limited) |
| 23 | Image paste / drag-and-drop |
| 24 | Syntax highlighting in diff |
| 25 | Search result highlighting in transcript |
| 26 | Sticky headers in virtual list |
| 27 | Onboarding wizard |
| 28 | Auto-update checker |
| 29 | Stats: heatmap, streaks, skill invocations |
| 30 | Session export |
| 31 | Context visualization |
| 32 | `CollapsedReadSearchContent` / `GroupedToolUseContent` / `TaskAssignmentMessage` |
| 33 | Various remaining dialogs (DevChannels, RemoteEnv, etc.) |

---

## Recommended Batch Order (Batch 15+)

### Batch 15: P0 Blockers + Core Slash Commands

1. Add `/clear`, `/exit`, `/help`, `/compact`, `/vim` handling in `lib.rs`
2. Add `InvalidConfigDialog` / `InvalidSettingsDialog` startup check
3. Add `render_system_api_error` to `messages/mod.rs`
4. Add `render_user_command` and `render_user_memory_input`

### Batch 16: Prompt Footer + Remaining Message Types

1. PR badge in footer (read `CLAUDE_PR_*` env or `gh pr status`)
2. Background task status pill
3. `render_local_command_output`, `render_collapsed_read_search`, `render_task_assignment`
4. Token warning auto-compact callout

### Batch 17: Model Picker + Remaining Slash Commands

1. `ModelPickerState` overlay + `/model` command
2. `/output-style`, `/fast`, `/effort`, `/rewind`, `/resume`, `/copy`, `/doctor`
3. Keybindings overlay + `/keybindings`

### Batch 18: Settings Depth

1. Settings: model selector, auto-compact threshold, notification toggles, keybindings editor
2. MCP server approval dialog
3. MCP server error detail expansion

### Batch 19: Agent Progress + External Status

1. `AgentProgressLine` tree rendering in transcript
2. External status line command (`CLAUDE_STATUS_COMMAND`)
3. Per-model stats breakdown

### Batch 20: History + Clipboard + Diagnostics

1. History search: timestamps, fuzzy match
2. Clipboard copy via arboard/xclip
3. `/doctor` diagnostics surface

---

*Completion estimate: Batches 15–17 close all P0 and most P1 gaps. Batches 18–20 complete P1. Batches beyond that are purely P2 polish.*
