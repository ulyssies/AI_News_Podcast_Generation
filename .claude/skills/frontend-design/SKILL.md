# Skill: Frontend Design

## Role

Produce intentional, distinctive UI. Not generic. Not AI-looking. Not default Tailwind.

## Activation

This skill activates whenever touching UI: components, layouts, styles, colors, typography, spacing, animations.

## First Step — Always

**Read `~/claude-shared/design-system.md` before writing a single line of UI code.**

Then check `CLAUDE.md` for any project-specific overrides under the Design System section.

Do not guess at colors, fonts, or spacing. The design system defines them.

---

## Anti-Patterns to Avoid

These are the signatures of AI-generated UI. Avoid every one of them.

### Color
- Default Tailwind blue (`blue-500`, `blue-600`) as a primary accent
- Gradients that weren't in the design system
- Purple/teal/cyan combinations as a default palette
- White backgrounds with gray cards as the only visual hierarchy tool

### Typography
- System font stack without intentional font choice
- All-caps headers as a substitute for visual weight
- Font sizes that don't follow a defined scale
- Line heights that make text feel cramped

### Layout
- Cookie-cutter hero → features → CTA page structure without a reason
- Centered everything with no asymmetry or visual tension
- Card grids as the default answer to any list of things
- Modals as the default answer to any secondary action

### Spacing
- Inconsistent spacing that doesn't follow the 8px grid
- Padding that feels "about right" rather than intentional
- Empty whitespace that wasn't designed — whitespace should be *generous and deliberate*

### Interaction
- Hover states that are just opacity changes
- Animations that serve no purpose (spinning loaders on instant actions)
- Buttons that look the same regardless of priority

---

## What Good Looks Like

- Colors come from the design system. No freelancing.
- Fonts are set per the type scale. No exceptions.
- Spacing follows the 8px grid. Every margin and padding is a multiple of 8 (or 4 for micro-spacing).
- Layout has a reason. Every visual decision reflects a hierarchy.
- The UI feels like it was made by a designer who cares, not a framework with defaults.

---

## Process

1. Read `~/claude-shared/design-system.md`
2. Read `CLAUDE.md` for project-specific overrides
3. Identify what hierarchy or interaction you're designing for
4. Apply tokens from the design system (colors, fonts, spacing)
5. Build the component
6. Check: does this look like it belongs in this project, or does it look like it came from a template?

---

## Do Not

- Ship a component with `text-blue-500` unless blue is defined in the design system
- Add a gradient because it looks "modern"
- Use a card grid because it's easy
- Leave placeholder styles like `bg-gray-100` in production components
- Skip reading the design system because "it's just a small component"
