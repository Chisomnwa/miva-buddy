# Capstone User Journeys and MVP Scope

## 1. Purpose

This document defines how students move through the product and draws the boundary around the first coherent version.

It complements the Product Specification. The Product Specification explains what the product is. This document explains the main journeys, what the MVP includes, and what is intentionally outside the MVP.

## 2. First Time Student Journey

The first time a student opens the application, onboarding should remain short.

The student provides:

- Programme or field of study
- Current level
- Career interests such as Software Engineering, Data Engineering, Backend Engineering, or Machine Learning

The student then reaches Home.

```text
First visit
    │
    ▼
Short onboarding
    │
    ├── Programme
    ├── Current level
    └── Career interests
    │
    ▼
Home
    │
    └── Start or continue learning
```

The product should not require a long questionnaire before the student can begin.

## 3. Main User Journey

The primary material based journey is:

```text
Student creates a course
          │
          ▼
Adds learning material
          │
          ▼
System identifies important concepts
          │
          ▼
Student chooses a concept
          │
          ▼
Learns through grounded conversation
          │
          ├── If a concrete job relevant skill is mentioned
          │      and credible evidence exists:
          │      show a small real job posting evidence card
          │      inside the learning experience
          │
          └── If the concept maps naturally to DSA:
                 offer Practice
                       │
                       ▼
                Curated LeetCode
                    problems
                       │
                       ▼
                Controlled coaching
                  when needed
```

Learn is the center of the journey. Practice is an optional extension for relevant DSA concepts. Industry relevance is contextual evidence inside Learn, not a separate destination or a required step in the journey.

## 4. Course and Material Journey

Courses are created manually by students and serve as organizational spaces.

```text
Your Courses
     │
     ▼
Create course
     │
     ▼
Add PDF or pasted notes
     │
     ▼
Process material
     │
     ▼
Identify a small set of concepts
     │
     ▼
Choose a concept
     │
     ▼
Start Learn
```

The initial version does not depend on Miva dashboard integration.

## 5. Direct Learning Journey

Students do not have to upload a document before learning.

```text
Learn
  │
  ▼
Enter a concept
"Teach me binary trees"
  │
  ▼
General explanation
  │
  ├── Ask follow up questions
  └── Practice this, if it is a relevant DSA concept
```

The experience must clearly distinguish general explanation from information grounded in an uploaded source.

## 6. Practice Journey

Practice is DSA specific.

```text
DSA concept
    │
    ▼
Curated LeetCode problems
    │
    ▼
Choose problem
    │
    ▼
Open original problem on LeetCode
    │
    ▼
Attempt problem there
    │
    ▼
Need help?
    │
    ▼
Return with own code / attempt / error
    │
    ▼
Hands Off / Coach / Tutor
    │
    ▼
Assistance within selected ceiling
```

The application does not need an embedded code editor or required Chrome extension.

Because the application cannot automatically inspect LeetCode submission state without an integration, practice completion is based on information the student explicitly provides in the initial version.

## 7. Contextual Industry Evidence Journey

Industry evidence appears while the student is learning from course material. It is not a separate top level journey and it does not appear inside Practice.

```text
Uploaded course material
          │
          ▼
Companion explains the material
          │
          ▼
Concrete job relevant skill or technology appears
for example SQL, Python, Docker, Git, AWS, PostgreSQL
          │
          ▼
Search job evidence
          │
       ┌──┴──┐
       │     │
Evidence   No credible
found      evidence
       │     │
       ▼     └── Continue learning normally
Show a small evidence card
inside Learn
       │
       ├── Role and company
       ├── Relevant posting excerpt
       └── Original source link
```

The system should not infer that a generic job requirement proves use of a specific DSA concept. Arrays, hash maps, linked lists, recursion, sliding window, and similar practice topics should not be connected to job postings unless the posting itself genuinely supports the exact claimed connection.

Career interests may affect which valid evidence is ranked first, but not whether a connection is true.

## 8. Returning Student Journey

A returning student should not land in an empty chatbot.

```text
Return to application
        │
        ▼
Home
        │
        ├── Continue recent concept
        ├── Continue course
        ├── Resume DSA practice
        └── Revisit recent learning
```

This continuity supports the idea of a persistent learning companion.

## 9. MVP at a Glance

```text
                         MVP
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
            LEARN                  PRACTICE
              │                       │
 Courses + materials              DSA only
 Concept extraction               Curated LeetCode links
 Grounded conversation            3 help modes
 Source references                Simple history
 General learning
 Contextual job evidence
 for supported skills
              │                       │
              └───────────┬───────────┘
                          ▼
                  SHARED FOUNDATION
                          │
             Student profile + accounts
             Persistent product state
             Responsive web experience
             Hosted AI layer
```

## 10. MVP Includes

The first coherent version includes:

- Short student onboarding and profile
- Basic authentication and persistent student state
- User created courses
- PDF learning materials
- Pasted text or notes
- Concept identification from learning materials
- Learn conversations grounded in uploaded material
- General concept learning without an upload
- Source references for grounded learning
- Clear distinction between source grounded and general explanation
- DSA focused Practice
- Curated LeetCode problem metadata and original links
- Hands Off, Coach, and Tutor assistance modes
- Deterministically constrained coaching behavior where possible
- Simple Practice history
- Contextual industry evidence inside Learn when uploaded material mentions a concrete job relevant skill or technology and credible job posting evidence exists
- Traceable job evidence with role, company, relevant excerpt, and original source
- Career interest based ranking of valid evidence
- Returning student continuity
- Responsive web experience for desktop, tablet, and mobile browsers
- A hosted AI layer that does not require students to provide their own API key as the normal experience

The exact model provider is an architecture and deployment decision rather than an MVP product decision.

## 11. Explicitly Out of Scope

The initial version does not require:

- Desktop application
- Required Chrome extension
- Built in coding environment or code execution
- AI generated DSA problems
- Practice for every programming concept
- General job search
- Job application management
- Interview preparation
- Open Library integration
- Miva dashboard integration
- Large gamification system
- Support for every document format
- Separate native mobile application
- Automatic inspection of a student's LeetCode editor, code, or submission results

These may become future opportunities, but Codex should not treat them as initial implementation requirements.

## 12. Scope Boundary Summary

```text
                 BUILD NOW
                     │
     Learn + DSA Practice
     + contextual job evidence
                     │
                     ▼
             Coherent companion
                     │
        ─────────────┼─────────────
                     │
                 NOT NOW
                     │
 Extensions, job search, interview
 prep, native apps, built in coding,
 broad gamification, external LMS
 integrations, and unrelated AI tools
```

The purpose of the boundary is not to prevent future expansion. It keeps the first version centered on one useful journey: understanding course material, practising relevant DSA, and seeing real job evidence at the moment a genuinely job relevant skill appears in learning.
