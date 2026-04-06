//! Model picker overlay (/model command).
//! Mirrors src/components/ModelPicker.tsx

use ratatui::buffer::Buffer;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Wrap};
use unicode_width::UnicodeWidthStr;

use crate::overlays::centered_rect;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single model entry shown in the picker.
#[derive(Debug, Clone)]
pub struct ModelEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    /// Whether this is the currently active model.
    pub is_current: bool,
}

/// State for the /model picker overlay.
pub struct ModelPickerState {
    pub visible: bool,
    pub selected_idx: usize,
    pub models: Vec<ModelEntry>,
    /// Live filter typed by the user.
    pub filter: String,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl ModelPickerState {
    /// Create a new picker with the default model list (not yet visible).
    pub fn new() -> Self {
        Self {
            visible: false,
            selected_idx: 0,
            models: Self::default_models(),
            filter: String::new(),
        }
    }

    /// Open the overlay, marking `current_model` as the active entry.
    pub fn open(&mut self, current_model: &str) {
        for m in &mut self.models {
            m.is_current = m.id == current_model;
        }
        // Pre-select the current model so the user sees it highlighted.
        self.selected_idx = self
            .models
            .iter()
            .position(|m| m.is_current)
            .unwrap_or(0);
        self.filter.clear();
        self.visible = true;
    }

    /// Close the overlay without selecting.
    pub fn close(&mut self) {
        self.visible = false;
        self.filter.clear();
    }

    /// Move selection up one row (wraps to last if at top).
    pub fn select_prev(&mut self) {
        let count = self.filtered_models().len();
        if count == 0 {
            return;
        }
        if self.selected_idx == 0 {
            self.selected_idx = count - 1;
        } else {
            self.selected_idx -= 1;
        }
    }

    /// Move selection down one row (wraps to first if at bottom).
    pub fn select_next(&mut self) {
        let count = self.filtered_models().len();
        if count == 0 {
            return;
        }
        self.selected_idx = (self.selected_idx + 1) % count;
    }

    /// Confirm the current selection. Returns the selected model ID and closes.
    pub fn confirm(&mut self) -> Option<String> {
        let filtered = self.filtered_models();
        let entry = filtered.get(self.selected_idx)?;
        let id = entry.id.clone();
        self.close();
        Some(id)
    }

    /// Append a character to the filter string and reset the selection.
    pub fn push_filter_char(&mut self, c: char) {
        self.filter.push(c);
        self.selected_idx = 0;
    }

    /// Remove the last character from the filter string.
    pub fn pop_filter_char(&mut self) {
        self.filter.pop();
        self.selected_idx = 0;
    }

    /// Return models that match the current filter (case-insensitive).
    pub fn filtered_models(&self) -> Vec<&ModelEntry> {
        if self.filter.is_empty() {
            return self.models.iter().collect();
        }
        let needle = self.filter.to_lowercase();
        self.models
            .iter()
            .filter(|m| {
                m.id.to_lowercase().contains(needle.as_str())
                    || m.display_name.to_lowercase().contains(needle.as_str())
                    || m.description.to_lowercase().contains(needle.as_str())
            })
            .collect()
    }

    /// Hardcoded list of Claude models available as of 2025.
    pub fn default_models() -> Vec<ModelEntry> {
        vec![
            ModelEntry {
                id: "claude-opus-4-6".to_string(),
                display_name: "Claude Opus 4.6".to_string(),
                description: "Most capable model — best for complex reasoning and analysis".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-sonnet-4-6".to_string(),
                display_name: "Claude Sonnet 4.6".to_string(),
                description: "Balanced performance and speed — great for coding tasks".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-haiku-4-5-20251001".to_string(),
                display_name: "Claude Haiku 4.5 (2025-10-01)".to_string(),
                description: "Fast and efficient — ideal for quick completions".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-opus-4-5".to_string(),
                display_name: "Claude Opus 4.5".to_string(),
                description: "Previous Opus generation — powerful multimodal reasoning".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-sonnet-4-5".to_string(),
                display_name: "Claude Sonnet 4.5".to_string(),
                description: "Previous Sonnet generation — solid coding and writing".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-haiku-4-5".to_string(),
                display_name: "Claude Haiku 4.5".to_string(),
                description: "Previous Haiku generation — lightweight and responsive".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-3-7-sonnet-20250219".to_string(),
                display_name: "Claude 3.7 Sonnet (2025-02-19)".to_string(),
                description: "Sonnet 3.7 with enhanced instruction following".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-3-5-sonnet-20241022".to_string(),
                display_name: "Claude 3.5 Sonnet (2024-10-22)".to_string(),
                description: "Highly capable 3.5 Sonnet — reliable and well-tested".to_string(),
                is_current: false,
            },
            ModelEntry {
                id: "claude-3-5-haiku-20241022".to_string(),
                display_name: "Claude 3.5 Haiku (2024-10-22)".to_string(),
                description: "Fast 3.5 Haiku — great for high-throughput pipelines".to_string(),
                is_current: false,
            },
        ]
    }
}

impl Default for ModelPickerState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// Render the model picker overlay directly into `buf`.
///
/// Draws a centred modal (≈60 wide × ≈20 tall) with:
/// - A filter line when the user is typing
/// - A scrollable list of models
/// - Per-row `●`/`○` prefix for the current model
/// - Selection highlight on the focused row
/// - Bottom hint bar
pub fn render_model_picker(state: &ModelPickerState, area: Rect, buf: &mut Buffer) {
    if !state.visible {
        return;
    }

    const MODAL_W: u16 = 60;
    const MODAL_H: u16 = 20;

    let dialog_area = centered_rect(
        MODAL_W.min(area.width.saturating_sub(2)),
        MODAL_H.min(area.height.saturating_sub(2)),
        area,
    );

    // --- Clear background -------------------------------------------------
    for y in dialog_area.y..dialog_area.y + dialog_area.height {
        for x in dialog_area.x..dialog_area.x + dialog_area.width {
            if let Some(cell) = buf.cell_mut((x, y)) {
                cell.reset();
            }
        }
    }

    // --- Build line list --------------------------------------------------
    let mut lines: Vec<Line> = Vec::new();

    // Optional filter line
    if !state.filter.is_empty() {
        lines.push(Line::from(vec![
            Span::styled("  Filter: ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                state.filter.clone(),
                Style::default()
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD),
            ),
        ]));
        lines.push(Line::from(""));
    }

    let filtered = state.filtered_models();

    if filtered.is_empty() {
        lines.push(Line::from(vec![Span::styled(
            "  No models match filter",
            Style::default().fg(Color::DarkGray),
        )]));
    } else {
        // Inner width available for description text (subtract borders + prefix + name col).
        let inner_w = dialog_area.width.saturating_sub(2) as usize;

        for (i, model) in filtered.iter().enumerate() {
            let is_selected = i == state.selected_idx;

            // Bullet: filled circle for the currently active model, empty otherwise.
            let bullet = if model.is_current { "\u{25CF}" } else { "\u{25CB}" };
            let bullet_style = if model.is_current {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            // Truncate description so the row fits inside the modal.
            // Layout: "  {bullet} {display_name}  {description}"
            // Reserve 4 chars for margins/bullet/space + display_name width + 2 padding.
            let name_w = model.display_name.width();
            let desc_budget = inner_w.saturating_sub(4 + name_w + 2);
            let desc: String = if model.description.width() > desc_budget && desc_budget > 3 {
                let mut s = model.description.clone();
                // Truncate at character boundary.
                while s.width() > desc_budget.saturating_sub(1) {
                    s.pop();
                }
                format!("{}…", s)
            } else {
                model.description.clone()
            };

            let row_style = if is_selected {
                Style::default()
                    .bg(Color::Rgb(40, 60, 80))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };

            let name_style = if is_selected {
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD)
                    .bg(Color::Rgb(40, 60, 80))
            } else {
                Style::default().fg(Color::White)
            };

            let desc_style = if is_selected {
                Style::default()
                    .fg(Color::Rgb(180, 200, 220))
                    .bg(Color::Rgb(40, 60, 80))
            } else {
                Style::default().fg(Color::DarkGray)
            };

            lines.push(Line::from(vec![
                Span::styled("  ", row_style),
                Span::styled(bullet, bullet_style.patch(row_style)),
                Span::styled(" ", row_style),
                Span::styled(model.display_name.clone(), name_style),
                Span::styled("  ", row_style),
                Span::styled(desc, desc_style),
            ]));
        }
    }

    // Spacer + hint
    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("  ", Style::default()),
        Span::styled(
            "Enter",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled("=select  ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            "Esc",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled("=cancel  ", Style::default().fg(Color::DarkGray)),
        Span::styled("Type to filter", Style::default().fg(Color::DarkGray)),
    ]));

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Model Picker ")
        .title_alignment(Alignment::Center)
        .border_style(Style::default().fg(Color::Cyan));

    let para = Paragraph::new(lines)
        .block(block)
        .alignment(Alignment::Left)
        .wrap(Wrap { trim: false });

    use ratatui::widgets::Widget;
    para.render(dialog_area, buf);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_picker_with_current(current: &str) -> ModelPickerState {
        let mut p = ModelPickerState::new();
        p.open(current);
        p
    }

    // 1. Default model list is non-empty and contains expected IDs.
    #[test]
    fn default_models_are_populated() {
        let models = ModelPickerState::default_models();
        assert!(!models.is_empty(), "default model list must not be empty");
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"claude-sonnet-4-6"));
        assert!(ids.contains(&"claude-opus-4-6"));
        assert!(ids.contains(&"claude-3-5-haiku-20241022"));
    }

    // 2. open() marks exactly one model as current.
    #[test]
    fn open_marks_current_model() {
        let mut p = ModelPickerState::new();
        p.open("claude-sonnet-4-6");
        let current_count = p.models.iter().filter(|m| m.is_current).count();
        assert_eq!(current_count, 1);
        assert!(p
            .models
            .iter()
            .find(|m| m.id == "claude-sonnet-4-6")
            .unwrap()
            .is_current);
    }

    // 3. open() with an unknown model ID marks none as current and sets idx=0.
    #[test]
    fn open_unknown_model_selects_first() {
        let mut p = ModelPickerState::new();
        p.open("unknown-model");
        assert_eq!(p.selected_idx, 0);
        assert!(p.models.iter().all(|m| !m.is_current));
    }

    // 4. select_next() wraps around to 0 after the last entry.
    #[test]
    fn select_next_wraps() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        let total = p.filtered_models().len();
        p.selected_idx = total - 1;
        p.select_next();
        assert_eq!(p.selected_idx, 0);
    }

    // 5. select_prev() wraps around to last after idx 0.
    #[test]
    fn select_prev_wraps() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        p.selected_idx = 0;
        p.select_prev();
        let total = p.filtered_models().len();
        assert_eq!(p.selected_idx, total - 1);
    }

    // 6. filter reduces visible entries.
    #[test]
    fn filter_reduces_results() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        // Use a distinctive prefix that only sonnet models carry.
        p.push_filter_char('s');
        p.push_filter_char('o');
        p.push_filter_char('n');
        p.push_filter_char('n');
        p.push_filter_char('e');
        p.push_filter_char('t');
        let all = p.models.len();
        let filtered = p.filtered_models();
        // Must have fewer results than the unfiltered list.
        assert!(filtered.len() < all, "filter should reduce the result count");
        assert!(!filtered.is_empty(), "at least one sonnet model must match");
        // Every returned model must match "sonnet" somewhere.
        for m in &filtered {
            let haystack = format!("{} {} {}", m.id, m.display_name, m.description).to_lowercase();
            assert!(
                haystack.contains("sonnet"),
                "model '{}' does not match filter 'sonnet'",
                m.id
            );
        }
    }

    // 7. pop_filter_char removes last char.
    #[test]
    fn pop_filter_char_removes_last() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        p.push_filter_char('h');
        p.push_filter_char('a');
        p.push_filter_char('i');
        assert_eq!(p.filter, "hai");
        p.pop_filter_char();
        assert_eq!(p.filter, "ha");
    }

    // 8. confirm() returns selected model ID and closes the picker.
    #[test]
    fn confirm_returns_id_and_closes() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        p.selected_idx = 0;
        let first_id = p.filtered_models()[0].id.clone();
        let result = p.confirm();
        assert_eq!(result, Some(first_id));
        assert!(!p.visible, "picker should be closed after confirm");
    }

    // 9. confirm() on empty filter list returns None.
    #[test]
    fn confirm_empty_filter_returns_none() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        // Force an empty filter result with a nonsense string.
        p.filter = "zzznomatch999".to_string();
        p.selected_idx = 0;
        let result = p.confirm();
        assert!(result.is_none());
    }

    // 10. close() clears filter and hides overlay.
    #[test]
    fn close_clears_state() {
        let mut p = make_picker_with_current("claude-opus-4-6");
        p.push_filter_char('x');
        p.close();
        assert!(!p.visible);
        assert!(p.filter.is_empty());
    }

    // 11. render_model_picker does not panic for a default-area call.
    #[test]
    fn render_does_not_panic() {
        let mut p = ModelPickerState::new();
        p.open("claude-sonnet-4-6");
        let area = Rect::new(0, 0, 120, 40);
        let mut buf = Buffer::empty(area);
        render_model_picker(&p, area, &mut buf);
        // No assertion needed — just must not panic.
    }

    // 12. render does nothing when not visible.
    #[test]
    fn render_noop_when_hidden() {
        let p = ModelPickerState::new(); // visible = false
        let area = Rect::new(0, 0, 80, 24);
        let mut buf = Buffer::empty(area);
        render_model_picker(&p, area, &mut buf);
        // Buffer should remain blank.
        for cell in buf.content() {
            assert_eq!(cell.symbol(), " ", "buffer should be empty when picker is hidden");
        }
    }
}
