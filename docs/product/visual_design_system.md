# Capstone Visual Design System

## 1. Purpose

This document defines the visual direction and interface design rules for the capstone learning companion. It complements the Product Specification, User Journeys and MVP Scope, UX Specification, Architecture Requirements, and AI / Retrieval / Safeguards documents.

The goal is to give Codex enough visual direction to build a coherent product without asking it to invent the product's identity during implementation.

The palette in this document is **Miva-inspired**. The values are product design choices, not claimed official Miva brand colors.

## 2. Visual Direction

The product should feel like:

> A calm, modern academic workspace with deep navy as its visual anchor, restrained red accents, warm light surfaces, and subtle gradients.

The intended personality is:

| Quality | Balance |
| --- | --- |
| Academic | but not institutional |
| Modern | but not futuristic |
| AI-powered | but not AI-gimmicky |
| Professional | but not corporate |
| Friendly | but not childish |
| Miva-inspired | but not Miva-cloned |
| Focused | but not sterile |
| Technical | but not IDE-like |

The interface is **light first**. Dark mode is not an MVP requirement.

## 3. Brand Hierarchy

Dark navy should do most of the visual work.

```text
NAVY
████████████████████████████
Primary visual identity

BLUE
██████████████
Interaction and gradients

RED
█████
Restrained brand accent
```

Navy is appropriate for navigation, primary actions, selected states, strong headings, and branded surfaces.

Red is an accent rather than a second primary color. It can appear in small brand details, active markers, selected decorative details, and occasional gradient accents. It should not dominate learning surfaces.

The main study workspace should remain warm and light rather than becoming an all-navy or all-dark interface.

## 4. Core Color Tokens

| Token | Value | Primary use |
| --- | --- | --- |
| `navy-950` | `#071A33` | Deepest branded surfaces |
| `navy-900` | `#0B2345` | Sidebar and navigation |
| `navy-800` | `#123765` | Strong interaction states |
| `blue-600` | `#2563EB` | Links, focus, interactive blue |
| `blue-500` | `#3B82F6` | Lighter highlights and gradients |
| `red-600` | `#D92D3A` | Miva-inspired accent |
| `red-500` | `#E5484D` | Lighter accent state |

These values are a proposed product palette and may be refined during implementation if accessibility testing requires small adjustments.

## 5. Neutral Tokens

| Token | Value | Primary use |
| --- | --- | --- |
| `warm-50` | `#FAF9F7` | Main application background |
| `surface` | `#FFFFFF` | Cards and primary surfaces |
| `warm-100` | `#F4F2EE` | Secondary surface |
| `slate-200` | `#E2E8F0` | Borders and dividers |
| `slate-500` | `#64748B` | Muted text |
| `slate-700` | `#334155` | Secondary text |
| `ink` | `#172033` | Main body text |

The slight warmth should prevent the application from feeling like a generic blue-and-white SaaS dashboard.

## 6. Semantic Colors

Semantic state colors should be separate from brand meaning.

```text
Success       green
Warning       amber
Error         semantic red
Information   blue
```

Brand red should not be the only error language. State must never be communicated through color alone. Use text, icons, and accessible labels alongside color.

Examples:

```text
✓ Material ready

⚠ Couldn't read some pages

✕ Processing failed
```

## 7. Gradients

Define one primary branded gradient rather than allowing individual screens to invent gradients.

```text
Deep Navy
#071A33
   |
   v
Rich Navy
#123765
   |
   v
Blue
#2563EB
```

Appropriate uses include onboarding, a restrained Home welcome area, the product mark, and occasional branded highlights.

Do not use gradients on every card, button, heading, chat message, or navigation item. The learning workspace should remain visually quiet.

## 8. Typography

Use **Inter** as the preferred UI typeface, with a suitable system sans-serif fallback.

Suggested hierarchy:

| Role | Size | Weight |
| --- | ---: | ---: |
| Display | 36px | 700 |
| Page title | 30px | 700 |
| Section title | 24px | 650-700 |
| Card title | 18px | 600 |
| Body large | 17px | 400 |
| Body | 16px | 400 |
| Supporting | 14px | 400-500 |
| Metadata | 13px | 500 |

Long educational explanations should use comfortable line height, approximately `1.6` for normal body text, and a sensible maximum reading width.

Code should use **JetBrains Mono** where available, with a system monospace fallback.

Use monospace for code blocks, inline code, student attempts, variables, and technical identifiers. Do not use it for ordinary interface labels.

## 9. Spacing and Shape

Use a predictable spacing scale:

```text
4
8
12
16
24
32
48
64
```

Avoid arbitrary one-off spacing values when a design token fits.

Suggested corner radii:

```text
Small controls        6-8px
Inputs                8-10px
Cards                 12px
Large branded areas   16px
```

Not every element should become a pill. The interface should feel contemporary without becoming excessively rounded.

## 10. Borders and Elevation

Prefer whitespace and subtle borders over heavy shadows.

A normal card should generally use:

```text
white surface
+
soft border
+
little or no shadow
```

Menus, temporary source panels, and other truly elevated surfaces may use a subtle shadow.

## 11. Buttons

### Primary

Use a navy filled button for the most important action on the current screen.

```text
┌─────────────────────┐
│   Add material      │
└─────────────────────┘
```

### Secondary

Use a light surface with a subtle border.

```text
┌─────────────────────┐
│   Give an example   │
└─────────────────────┘
```

### Tertiary

Use a text action for low-emphasis navigation or supporting actions.

```text
View source →
```

### Destructive

Use destructive styling only for actual destructive operations such as deleting a course.

Brand red does not make every primary button red. Navy remains the primary action color.

## 12. Inputs and Composer

Inputs should be simple, familiar, and visibly focusable.

```text
Course name

┌────────────────────────────────────────┐
│ Computer Programming II                │
└────────────────────────────────────────┘
```

Use a visible blue or navy focus treatment.

The learning composer can be slightly larger than a standard input without becoming a giant generic AI prompt box.

```text
┌─────────────────────────────────────────────┐
│ Ask about recursion...                      │
│                                             │
│                                      Send ↑ │
└─────────────────────────────────────────────┘
```

## 13. Navigation

### Desktop

Use a deep navy sidebar with stable primary navigation.

```text
┌──────────────────┐
│                  │
│  PRODUCT MARK    │
│                  │
│  Home            │
│  Learn           │
│  Practice        │
│                  │
│                  │
│  ──────────────  │
│  Profile         │
│                  │
└──────────────────┘
```

The selected item can use a lighter navy surface with a restrained red accent marker.

```text
▌ Learn
```

### Mobile

Use bottom navigation for the three core areas.

```text
┌───────────────────────────────────┐
│                                   │
│          Current screen           │
│                                   │
├───────────────────────────────────┤
│   Home       Learn      Practice  │
└───────────────────────────────────┘
```

Profile can live behind the avatar or header rather than taking a permanent fourth bottom-navigation position.

## 14. Cards

Cards should represent actual conceptual objects such as:

- courses;
- materials;
- concepts;
- LeetCode problems;
- source evidence;
- industry evidence.

Do not wrap ordinary explanatory content in cards simply because it exists. Avoid cards nested inside cards without a clear information purpose.

Example concept card:

```text
┌──────────────────────────────────────┐
│ Recursion                            │
│                                      │
│ A function solving a problem by      │
│ calling itself on smaller versions.  │
│                                      │
│ Lecture 03 · pages 4-7               │
│                                      │
│ Learn this →                         │
└──────────────────────────────────────┘
```

## 15. Grounding Visual Language

Grounded course information and additional explanation must be visually distinguishable without making general explanation look unsafe.

### From course material

```text
FROM YOUR COURSE MATERIAL

│ A base case defines when recursion
│ should stop.
│
│ Lecture 03 · page 5
│ View source →
```

Use a subtle navy or blue marker for grounded content.

### Additional explanation

```text
ADDITIONAL EXPLANATION

Imagine a set of nested boxes...
```

This treatment should be visually quieter. The distinction communicates provenance rather than danger.

## 16. Industry Evidence Component

Industry evidence appears inside Learn only when supported by real evidence.

```text
┌──────────────────────────────────────────┐
│ SEEN IN INDUSTRY                         │
│                                          │
│ SQL                                      │
│                                          │
│ Data Engineer · Example Company          │
│                                          │
│ "...experience working with SQL..."      │
│                                          │
│ Verified from job posting                │
│ View source ↗                            │
└──────────────────────────────────────────┘
```

Use a subtle warm or blue-tinted surface. It should communicate evidence, not advertising.

Avoid giant company logos, salary widgets, job-board styling, or prominent Apply buttons. The purpose is to show that something being learned appears in real engineering work, not to turn Learn into a job portal.

## 17. Practice Visual Language

Practice can be slightly more technical and structured than Learn while remaining a coaching workspace rather than an IDE.

```text
Two Sum                                      Easy

Arrays · Hash Maps

Open on LeetCode ↗


Assistance

┌────────────┬────────────┬────────────┐
│ Hands Off  │   Coach    │   Tutor    │
└────────────┴────────────┴────────────┘
                   ↑
                selected


What are you stuck on?

[ I'm stuck ]  [ Code error ]  [ Test failed ]


Your attempt

┌──────────────────────────────────────────┐
│ def twoSum(nums, target):                │
│     ...                                  │
└──────────────────────────────────────────┘
```

Hands Off, Coach, and Tutor are preferences, not severity levels. Do not use green, amber, and red to imply that one is better or worse.

The selected mode should use the normal navy or blue selection language.

## 18. Loading, Empty, and Error States

Loading states should use meaningful language.

```text
Reading Computer Programming II.pdf

Identifying important concepts...
```

An empty course should offer the next useful action rather than displaying a blank dashboard.

```text
No materials yet.

Add a lecture or paste your notes to start learning.

[ Add material ]
```

A retrieval failure should explain recovery clearly.

```text
We couldn't search this material right now.

Your upload is still saved.

[ Try again ]
```

A valid no-evidence result does not require an error card. If no credible industry evidence exists, the evidence card simply does not appear.

## 19. Global Desktop Shell

Authenticated screens should share a stable shell.

```text
┌───────────────────────────────────────────────────────────────┐
│ NAVY SIDEBAR │                                               │
│              │                                               │
│ Product      │              PAGE CONTENT                     │
│              │                                               │
│ Home         │                                               │
│ Learn        │                                               │
│ Practice     │                                               │
│              │                                               │
│              │                                               │
│ Profile      │                                               │
└───────────────────────────────────────────────────────────────┘
```

The sidebar remains stable while the workspace changes.

The main workspace should use a maximum content width. Large screens should add breathing room rather than stretching educational paragraphs across the full display.

## 20. Home Composition

Home is a continuation surface, not an analytics dashboard.

A returning student's Home can prioritize:

```text
Good evening

What would you like to learn?

[ Ask about a concept... ]


Continue learning

[ Recursion · Programming II · Continue ]
[ Binary Trees · Programming II · Continue ]


Your courses

Computer Programming II                 View →
Computer Architecture                   View →


Continue practising

Arrays & Hash Maps · Two Sum            Continue →
```

Do not make streaks, XP, productivity percentages, hours studied, or similar gamification the visual focus.

Home should answer:

> What was I doing, and what can I do next?

For a new student, reduce the screen to a few useful starting actions: ask about a concept, add the first course, or practise DSA.

## 21. Learn Landing Composition

Learn should expose the two core learning routes directly.

```text
LEARN

Understand something

[ What would you like to understand? ]


Learn from your courses

[ Programming II ]   [ Computer Architecture ]

+ Add course
```

These represent direct concept learning and course-grounded learning. They do not need separate product areas.

## 22. Course Composition

A course is a simple organizational layer.

```text
← Learn

Computer Programming II
CSC 202

Materials                                      + Add material

┌────────────────────────────────────────────────────────┐
│ Lecture 03 · Recursion                                 │
│ PDF · 18 pages                                         │
│ 3 concepts identified                         Open →   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Week 4 Notes                                           │
│ Pasted notes                                           │
│ 2 concepts identified                         Open →   │
└────────────────────────────────────────────────────────┘
```

Avoid unnecessary tabs such as Overview, Materials, Concepts, Progress, and Analytics when one straightforward page can serve the task.

## 23. Material and Concept Discovery

After processing, show a small number of important concepts rather than generating a feature-heavy study dashboard.

```text
← Computer Programming II

Lecture 03 · Recursion

Important concepts

┌─────────────────────────────────────────────────────┐
│ Recursion                                           │
│ A technique where a function solves a problem      │
│ using smaller instances of the same problem.       │
│ Pages 4-7                              Learn this → │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Base Cases                                          │
│ The condition that stops recursive calls.           │
│ Pages 5-6                              Learn this → │
└─────────────────────────────────────────────────────┘
```

Do not automatically turn every upload into summaries, quizzes, flashcards, mind maps, and study plans.

## 24. Concept Learning Composition

Concept Learning is the visual heart of the product.

```text
← Lecture 03

Computer Programming II
Lecture 03 · pages 4-7

Recursion

Recursion is a technique where a function solves a
problem by calling itself with a smaller version of
that problem.

FROM YOUR COURSE MATERIAL

│ The lecture introduces the base case as the
│ condition that stops the recursive process.
│
│ Lecture 03 · page 5                    View source

ADDITIONAL EXPLANATION

Think of opening a series of nested boxes...

[ Explain simply ] [ Give example ]
[ Check my understanding ]

[ Ask about recursion... ]
```

As the student continues, this becomes a natural conversation, but the educational context remains visible.

The student should be able to understand at a glance:

- the current course;
- the current material;
- the current concept;
- whether information is grounded in course material;
- where a source came from.

The product should not degrade into an anonymous generic chatbot.

## 25. Contextual Industry Evidence

Industry evidence should appear naturally inside learning when relevant.

```text
Companion explanation...


┌──────────────────────────────────────────────────────────┐
│ SEEN IN INDUSTRY                                        │
│                                                        │
│ SQL                                                    │
│ Software Engineer · Example Company                    │
│                                                        │
│ "...experience with SQL..."                            │
│                                                        │
│ Retrieved from a real job posting                      │
│ View original source ↗                                 │
└──────────────────────────────────────────────────────────┘


Ask a follow-up...
```

The student should not have to leave Learn, open an Industry area, and select the same concept again. The application already knows the learning context.

## 26. Contextual Transition to Practice

When a learning concept has a genuine DSA Practice connection, offer a contextual action.

```text
Ready to practise this?

Binary Trees has related DSA problems.

[ Practice Binary Trees ]
```

The transition should preserve the topic automatically rather than forcing the student to select Binary Trees again.

## 27. Practice Landing Composition

Direct Practice remains available.

```text
PRACTICE

Continue

┌──────────────────────────────────────────────────────┐
│ Arrays & Hash Maps                                   │
│ Two Sum                                              │
│ Coach                                    Continue →  │
└──────────────────────────────────────────────────────┘


Choose a DSA topic

Arrays & Hash Maps
Two Pointers
Sliding Window
Stack
Binary Search
Linked Lists
Trees
Graphs
Dynamic Programming
...
```

Practice contains no industry evidence.

## 28. DSA Topic Composition

A topic page should provide curated LeetCode metadata without reproducing protected problem content.

```text
← Practice

Arrays & Hash Maps

Curated problems

EASY
Two Sum                                      Start →
Valid Anagram                                Start →

MEDIUM
Group Anagrams                               Start →
Top K Frequent Elements                      Start →
```

## 29. Practice Coaching Session Composition

The Practice session is the second major workspace.

```text
← Arrays & Hash Maps

Two Sum                                      Easy
LeetCode                                      Open ↗


Assistance

┌──────────────┬──────────────┬──────────────┐
│  Hands Off   │    Coach     │    Tutor     │
└──────────────┴──────────────┴──────────────┘
                      ↑

Coach
I'll help identify where your own approach is going
wrong without giving you the answer.


What do you need help with?

[ I'm stuck ] [ Code error ] [ Test failed ]


Your attempt

┌─────────────────────────────────────────────────────────┐
│ def twoSum(nums, target):                              │
│     seen = {}                                          │
│     ...                                                │
└─────────────────────────────────────────────────────────┘

[ Ask for help ]
```

Once a session knows the problem, topic, and assistance mode, do not repeatedly ask the student to select them.

## 30. Assistance Mode Changes

Mode changes should be deliberate but lightweight.

If a student in Coach asks for a full solution:

```text
Coach mode won't give the full solution.

I can help identify what's going wrong with your
current approach, or you can switch to Tutor.

[ Keep coaching ]       [ Switch to Tutor ]
```

Do not automatically change modes. Avoid a large warning modal or judgmental language.

## 31. Source Inspection

Selecting a course source should preserve the learning context.

On desktop, a temporary side panel is appropriate.

```text
┌──────────────────────────────┬──────────────────────┐
│                              │ SOURCE               │
│ Learning conversation        │                      │
│                              │ Lecture 03           │
│                              │ Page 5               │
│                              │                      │
│                              │ Relevant passage...  │
│                              │                      │
│                              │ Open material        │
└──────────────────────────────┴──────────────────────┘
```

Closing it returns the student to the same position.

On mobile, use a temporary full-height surface or bottom sheet rather than squeezing the document beside the conversation.

## 32. Job Evidence Detail

Selecting evidence can open a lightweight detail view.

```text
SQL in industry

Software Engineer
Example Company

Supporting excerpt
"...experience with SQL..."

Source
Original posting ↗

Retrieved
October 2026
```

This is an evidence detail view, not an internal job portal.

## 33. Mobile Composition

Mobile should not be the desktop interface squeezed narrower.

```text
┌─────────────────────────────┐
│ Product              Avatar│
├─────────────────────────────┤
│                             │
│        PAGE CONTENT         │
│                             │
│                             │
├─────────────────────────────┤
│   Home    Learn   Practice  │
└─────────────────────────────┘
```

Cards become a single column. Actions wrap naturally. Learning conversations use full available width with comfortable padding.

Code may scroll inside the code block, but the whole page should not require horizontal scrolling.

Avoid hover-only interactions. Touch targets must be comfortably tappable.

## 34. Responsive Principle

The core responsive rule is:

> Preserve the task, not the desktop arrangement.

Desktop may use extra horizontal space for context. Mobile should preserve the current concept, explanation, source access, conversation, and contextual actions without attempting to preserve every desktop column.

## 35. Accessibility

Accessibility is part of the design system from the beginning.

Requirements include:

- readable contrast between text and surfaces;
- visible keyboard focus;
- semantic labels for controls;
- keyboard navigation;
- sufficiently large touch targets;
- no meaning communicated by color alone;
- appropriate heading hierarchy;
- readable body sizes and line heights;
- code areas that remain usable when zoomed;
- loading states understandable without animation;
- reduced-motion preferences respected where motion exists.

Color tokens should be tested in implementation for WCAG-appropriate contrast in their actual combinations.

## 36. Motion

Motion should explain state rather than advertise that the product uses AI.

Appropriate examples:

- opening a source panel;
- a material processing indicator;
- a subtle transition when assistance mode changes;
- a generation/loading indicator.

Avoid:

- floating decorative blobs;
- constantly pulsating gradients;
- cards flying into place;
- persistent animated AI icons;
- unnecessary typing theatrics.

The intended experience is a calm study workspace.

## 37. Design System Layers

The visual system has four layers:

```text
FOUNDATION
Colors
Typography
Spacing
Shape
Elevation


COMPONENTS
Buttons
Inputs
Navigation
Cards
Controls


PRODUCT-SPECIFIC COMPONENTS
Course grounding
Source references
Industry evidence
Assistance selector
Practice coaching


STATES AND COMPOSITION
Loading
Empty
Success
Error
Desktop layouts
Mobile layouts
Accessibility
Motion
```

## 38. Final Visual Hierarchy

```text
                    PRODUCT IDENTITY
                         |
              Navy + restrained red
                         |
                         v
                 GLOBAL APPLICATION
                         |
            Warm, quiet light surfaces
                         |
             +-----------+-----------+
             |                       |
             v                       v
           LEARN                  PRACTICE
             |                       |
      reading-focused          task-focused
             |                       |
      course grounding        coaching state
      source language         assistance modes
      evidence cards          student attempts
             |                       |
             +-----------+-----------+
                         |
                         v
                SHARED DESIGN SYSTEM
                         |
          typography / spacing / controls
          states / accessibility / motion
```

Learn and Practice should feel like two modes of one companion, not unrelated applications.

## 39. Rules Codex Should Preserve

During implementation, Codex should preserve these visual rules:

1. Use the documented design tokens rather than inventing new colors and spacing values casually.
2. Keep navy dominant and red restrained.
3. Keep the main learning workspace light, warm, and reading-friendly.
4. Do not turn the product into a generic AI chat interface.
5. Keep grounding and source provenance visually understandable.
6. Treat industry evidence as evidence, not advertising.
7. Keep Practice focused on coaching rather than recreating an IDE.
8. Do not introduce unnecessary dashboards, analytics, gamification, tabs, modals, or repeated selectors.
9. Preserve task context during navigation.
10. Build mobile layouts around the task rather than squeezing desktop layouts.
11. Respect accessibility and reduced-motion requirements.
12. If implementation constraints require a visual deviation, document the reason rather than silently creating a new pattern.

## 40. What This Document Does Not Decide

This document does not require a particular frontend framework, component library, CSS system, icon library, or implementation architecture.

Codex may propose suitable implementation choices after reading the full project documentation.

Those technical choices should implement this design system rather than redefine it.
