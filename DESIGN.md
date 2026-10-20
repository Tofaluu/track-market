---
name: TrackMarket
description: Live US and Canadian stock watchlist, charts, AI research and paper trading
colors:
  canvas: "#0b0d10"
  surface: "#12151a"
  raised: "#1a1e24"
  raised-hover: "#242932"
  line: "#22262d"
  line-strong: "#323840"
  ink: "#eef0f3"
  ink-soft: "#cbcfd6"
  ink-muted: "#a5abb4"
  ink-subtle: "#8d939d"
  ink-faint: "#5c626c"
  up: "#38c785"
  down: "#f2606f"
typography:
  display:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.06em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-secondary-hover:
    backgroundColor: "{colors.raised-hover}"
    textColor: "{colors.ink}"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    height: "32px"
  button-danger:
    textColor: "{colors.down}"
    rounded: "{rounded.md}"
    height: "32px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  watchlist-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  watchlist-row-selected:
    backgroundColor: "{colors.raised-hover}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
---

# Design System: TrackMarket

## Overview

**Creative North Star: "The Trading Desk"**

TrackMarket is a tool people sit inside while markets move, so the interface behaves like a well-run trading desk: dense, quiet and precise. Data is the hero. The chrome is a set of cool, near-black neutrals that recede until a number changes, and colour is spent only where it carries meaning.

Density is a feature. Rows are tight, labels are small and uppercase, and numerals are tabular so columns of prices line up. Hierarchy comes from weight, size and space rather than from colour or decoration: no gradients, glows, coloured side stripes or icon tiles.

The look is dark by design, from the use scene: watching a screen for hours, often next to other trading tools.

**Key Characteristics:**
- Neutral surfaces with one tonal step per layer (canvas, surface, raised)
- Green and red reserved for price direction, always paired with ↑/↓ or a sign
- One family (IBM Plex Sans) for everything, tabular numerals for every figure
- Hairline borders and tonal layering instead of shadows
- Fast, functional motion; nothing loops except loading skeletons

## Colors

A cool, near-black neutral ramp carries the whole interface. Two semantic hues mark direction.

### Primary
- **Desk White** (#eef0f3): primary text, and the fill of the single primary action on a screen (Sign in, Trade, Save). On dark, a light button is the most decisive call to action without adding a brand hue.

### Secondary
- **Advance Green** (#38c785): a price, change or return that is up; the open-market dot; Buy in the trade history.
- **Decline Red** (#f2606f): a price, change or return that is down; destructive actions; errors.

### Neutral
- **Canvas** (#0b0d10): the app background and input fields.
- **Surface** (#12151a): toolbar, footer and dialogs.
- **Raised** (#1a1e24) and **Raised Hover** (#242932): secondary buttons, hovered rows, and the selected row.
- **Line** (#22262d) and **Line Strong** (#323840): hairline dividers, then borders on controls and dialogs.
- **Ink Soft** (#cbcfd6), **Ink Muted** (#a5abb4), **Ink Subtle** (#8d939d): secondary text, descending. All three pass 4.5:1 on Canvas and Surface.
- **Ink Faint** (#5c626c): disabled controls and decorative separators only, never text that must be read.

### Named Rules
**The Meaning-Only Rule.** Green and red appear only when they say up or down (or destroy). A button, badge or heading is never coloured for emphasis.

**The No-Gray-On-Color Rule.** Text on a tinted surface uses Ink or the surface's own hue, never a mid-gray.

## Typography

**Display Font:** IBM Plex Sans (with system-ui fallback)
**Body Font:** IBM Plex Sans
**Label/Mono Font:** IBM Plex Sans for labels; the platform monospace only inside AI-report code blocks.

**Character:** Plex has a quietly technical, engineered feel that suits a terminal without resorting to monospace, and its tabular figures keep prices aligned.

### Hierarchy
- **Display** (600, 1.875rem, tracking -0.02em, tabular): the live price in the stock header.
- **Headline** (600, 1.25rem, tracking -0.01em): the company name and empty-state headings.
- **Title** (600, 0.875rem): symbols in rows, section headings, report titles.
- **Body** (400, 0.875rem, line-height 1.5): descriptions and help text; AI reports at 0.875rem/1.65 with a 72ch measure.
- **Label** (500, 0.6875rem, tracking 0.06em, uppercase): stat names and section labels. 11px is the floor; nothing renders smaller.

### Named Rules
**The Tabular Rule.** Every number that can change (prices, changes, volumes, totals, times) is set with `tabular-nums`.

## Layout

A fixed app frame: a 56px toolbar, a 300px watchlist rail on the left, the detail pane filling the rest, and a 32px footer. Below the `md` breakpoint the rail and the detail pane become separate screens, and the toolbar drops undo/redo and the view switch. Spacing follows a 4px rhythm; groups sit 8–12px apart and sections 24px apart. The research view caps its two-column layout at 72rem.

## Elevation & Depth

Flat by default. Depth is tonal: each layer steps one shade lighter (Canvas, then Surface, then Raised). Shadows appear only on things that float above the frame.

### Shadow Vocabulary
- **Dialog** (`box-shadow: 0 24px 64px -16px rgb(0 0 0 / 0.7)`): dialogs over the dimmed app.
- **Popover** (`box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.6)`): the chart tooltip and toasts.

### Named Rules
**The Hairline Rule.** Structure comes from 1px lines and tonal steps. A coloured border thicker than 1px never marks a card, row or callout.

## Shapes

Gently rounded and consistent: 4px for small marks (keys, skeleton bars), 6px for every control and row, 8px for containers like the chart frame and tables, and 12px for dialogs. Status dots are the only circles.

## Components

### Buttons
- **Shape:** gently rounded (6px), 32px tall by default, 28px in dense rows, 40px for full-width form actions.
- **Primary:** Desk White fill with Canvas text. One per screen.
- **Secondary:** Raised fill, Line Strong border, Ink Soft text, brightening to Ink on hover.
- **Ghost:** no fill; Ink Muted text gaining a Raised fill on hover. Used for icon buttons.
- **Danger:** Decline Red text and a 40% red border, tinting on hover.
- **Disabled:** 40% opacity and a not-allowed cursor.
- **Focus:** a 2px Desk White outline, offset 2px, for keyboard focus only.

### Segmented controls
- **Style:** a Canvas track with a Line border holding 28px segments; the active segment takes Raised Hover with Ink text. Used for Watchlist/Portfolio, Chart/Research, timeframes, Buy/Sell and CAD/USD.

### Inputs / Fields
- **Style:** Canvas fill, Line Strong border, 6px radius, 36px tall, with persistent labels (visually hidden only for single search fields).
- **Focus:** the border lightens and a 1px Ink Muted outline appears.
- **Error:** the message sits below in Decline Red with `role="alert"`.

### Watchlist rows
- **Style:** full-width rows rather than cards: symbol and currency over the company name, price over the change. Hover takes Raised; selection takes Raised Hover. Rows waiting for their first live quote show a skeleton instead of a stale price.

### Dialogs
- **Style:** Surface panel, Line Strong border, 12px radius and the Dialog shadow over a 70% black scrim. Every dialog traps focus, closes on Escape and returns focus to where it was opened.

### Price chart (signature)
- **Style:** a hand-built SVG in an 8px Line frame. The line is 1.75px in Advance Green or Decline Red, over a 16%-to-transparent fill of the same hue. Gridlines are Line hairlines, and the previous close is a dashed Ink Faint line. The hover marker is a Canvas dot ringed in the direction colour, and the pinned point is a solid Desk White dot. Arrow keys scrub and Enter pins.

## Do's and Don'ts

### Do:
- **Do** keep green and red for direction and destructive actions, and pair them with ↑/↓ or a sign.
- **Do** use the shared classes in `src/components/ui.ts` for buttons, inputs and segmented controls.
- **Do** set every changing number with `tabular-nums`.
- **Do** show a skeleton, not a placeholder price, until a real quote arrives.

### Don't:
- **Don't** add a brand accent colour, gradient, or glow; the previous violet gradient accents were removed deliberately.
- **Don't** use coloured left stripes, icon tiles above headings, or grids of identical icon cards.
- **Don't** render text below 11px or use Ink Faint for readable text.
- **Don't** use emoji or Unicode glyphs as icons.
