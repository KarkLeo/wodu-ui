# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive character sheet for the tabletop RPG **Dungeon World**. The goal is a mobile-friendly, user-friendly web application with three distinct interface modes.

## Tech Stack

- **Framework**: Vue 3 + TypeScript
- **State / Persistence**: Pinia store, data persisted to `localStorage`
- **UI Components**: [Reka UI](https://reka-ui.com/) for complex controls (dropdowns, dialogs, tabs, etc.)
- **Mobile-first**: all layouts must be responsive

## Design References

- `ref/` — reference scans of the official Dungeon World character sheet. Every field, section, and label from these pages must be represented. Nothing may be omitted or distorted.
- `mood/` — mood board images that define the visual atmosphere. The final design should evoke the same dark, handcrafted aesthetic seen there.

## Interface Modes

The app has three distinct views; switching between them should feel seamless:

1. **Character Creation** — all choices that are one-time setup (class, race, name, background, bonds, alignment, starting moves). After character is created these sections are hidden from the in-game view.
2. **In-Game** — the active play sheet: stats, HP, XP, armor, damage dice, current moves, inventory, holds/debilities, bonds.
3. **Level Up** — triggered when XP threshold is reached; presents available advancement choices.

## Architecture Guidelines

- Feature-based folder structure (`src/features/character-creation/`, `src/features/in-game/`, `src/features/level-up/`) with each feature owning its components, composables, and store slice.
- A single root Pinia store module per feature; the character object shape should be defined as a TypeScript interface in `src/types/character.ts`.
- Keep Reka UI primitives wrapped in thin project-specific components (`src/components/ui/`) so the design system is swappable.
- The move list is rendered as a scrollable list; players browse and select from available moves rather than seeing a static block of text.

## Key UX Rules

- Creation-only fields are hidden after character creation is complete.
- No decorative UI chrome — every element must serve a functional purpose.
- All user data survives page refresh via `localStorage` (Pinia plugin or manual watcher).
