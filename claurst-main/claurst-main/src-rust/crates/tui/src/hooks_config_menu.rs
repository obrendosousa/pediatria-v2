// hooks_config_menu.rs — Read-only hooks browser matching TS HooksConfigMenu.tsx

use ratatui::buffer::Buffer;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Wrap};

use crate::overlays::centered_rect;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

pub struct HookEntry {
    /// Event name: "PreToolUse", "PostToolUse", "PreSession", etc.
    pub event: String,
    /// Tool pattern like "Bash", "*"
    pub matcher: String,
    /// Shell command to run when the hook fires
    pub command: String,
}

pub struct HooksConfigMenuState {
    pub visible: bool,
    pub hooks: Vec<HookEntry>,
    pub selected: usize,
    pub scroll_offset: usize,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl HooksConfigMenuState {
    pub fn new() -> Self {
        Self {
            visible: false,
            hooks: Vec::new(),
            selected: 0,
            scroll_offset: 0,
        }
    }

    /// Open the menu and load hooks from `~/.claude/settings.json`.
    ///
    /// Parses the `hooks` field of the JSON settings file into a flat
    /// `HookEntry` list.  If the file is missing or has no hooks the list
    /// will simply be empty.
    pub fn open(&mut self) {
        self.selected = 0;
        self.scroll_offset = 0;
        self.hooks.clear();
        self.load_hooks();
        self.visible = true;
    }

    pub fn close(&mut self) {
        self.visible = false;
    }

    pub fn scroll_up(&mut self) {
        self.scroll_offset = self.scroll_offset.saturating_sub(1);
    }

    pub fn scroll_down(&mut self, max: usize) {
        if self.scroll_offset + 1 < max {
            self.scroll_offset += 1;
        }
    }

    pub fn select_prev(&mut self) {
        if self.selected > 0 {
            self.selected -= 1;
        }
    }

    pub fn select_next(&mut self) {
        if !self.hooks.is_empty() && self.selected + 1 < self.hooks.len() {
            self.selected += 1;
        }
    }

    // ---- Private helpers ---------------------------------------------------

    fn load_hooks(&mut self) {
        let settings_path = cc_core::config::Settings::config_dir().join("settings.json");
        let json_str = match std::fs::read_to_string(&settings_path) {
            Ok(s) => s,
            Err(_) => return,
        };
        let root: serde_json::Value = match serde_json::from_str(&json_str) {
            Ok(v) => v,
            Err(_) => return,
        };

        // Expected structure (mirrors claude-code TS settings schema):
        // {
        //   "hooks": {
        //     "PreToolUse": [
        //       { "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo hi" }] }
        //     ],
        //     ...
        //   }
        // }
        let hooks_map = match root.get("hooks").and_then(|h| h.as_object()) {
            Some(m) => m,
            None => return,
        };

        for (event_name, event_val) in hooks_map {
            let entries = match event_val.as_array() {
                Some(a) => a,
                None => continue,
            };
            for entry in entries {
                let matcher = entry
                    .get("matcher")
                    .and_then(|v| v.as_str())
                    .unwrap_or("*")
                    .to_string();

                if let Some(hook_list) = entry.get("hooks").and_then(|h| h.as_array()) {
                    for hook in hook_list {
                        let command = hook
                            .get("command")
                            .and_then(|c| c.as_str())
                            .unwrap_or("")
                            .to_string();
                        if !command.is_empty() {
                            self.hooks.push(HookEntry {
                                event: event_name.clone(),
                                matcher: matcher.clone(),
                                command,
                            });
                        }
                    }
                }
            }
        }
    }
}

impl Default for HooksConfigMenuState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// Render the hooks config menu as a large centered overlay.
pub fn render_hooks_config_menu(
    state: &HooksConfigMenuState,
    area: Rect,
    buf: &mut Buffer,
) {
    if !state.visible {
        return;
    }

    let dialog_width = 80u16.min(area.width.saturating_sub(4));
    let dialog_height = 28u16.min(area.height.saturating_sub(4));
    let dialog_area = centered_rect(dialog_width, dialog_height, area);

    let mut lines: Vec<Line> = Vec::new();

    if state.hooks.is_empty() {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![Span::styled(
            "  No hooks configured.",
            Style::default().fg(Color::DarkGray),
        )]));
        lines.push(Line::from(vec![Span::styled(
            "  Edit ~/.claude/settings.json to add hooks.",
            Style::default().fg(Color::DarkGray),
        )]));
    } else {
        let mut current_event = String::new();

        for (i, hook) in state.hooks.iter().enumerate() {
            // Group header when event changes
            if hook.event != current_event {
                if !current_event.is_empty() {
                    lines.push(Line::from(""));
                }
                current_event = hook.event.clone();
                lines.push(Line::from(vec![Span::styled(
                    format!("  {}", hook.event),
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED),
                )]));
                lines.push(Line::from(""));
            }

            let selected = i == state.selected;
            let row_style = if selected {
                Style::default()
                    .fg(Color::Rgb(215, 119, 87))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };

            let prefix = if selected { "  \u{203a} " } else { "    " };
            lines.push(Line::from(vec![
                Span::styled(
                    format!("{prefix}{:<12}", hook.matcher),
                    row_style,
                ),
                Span::styled(
                    format!("  {}", hook.command),
                    Style::default().fg(Color::DarkGray),
                ),
            ]));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![Span::styled(
        "  Edit settings.json to change  \u{00b7}  Esc close",
        Style::default()
            .fg(Color::DarkGray)
            .add_modifier(Modifier::ITALIC),
    )]));

    let inner_height = dialog_height.saturating_sub(2) as usize;
    let total = lines.len();
    let max_scroll = total.saturating_sub(inner_height);
    let scroll = state.scroll_offset.min(max_scroll) as u16;

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Hooks Configuration (read-only) ")
        .border_style(Style::default().fg(Color::Cyan));

    let para = Paragraph::new(lines)
        .block(block)
        .alignment(Alignment::Left)
        .wrap(Wrap { trim: false })
        .scroll((scroll, 0));

    use ratatui::widgets::Widget;
    para.render(dialog_area, buf);
}
