# Capstone Research and Product Decisions

## Purpose

This document records the important research findings and product decisions made before the detailed product specification. It is a working source of truth for the project and will later become part of the repository knowledge provided to Codex.

## 1. Project Direction

The product is an AI learning companion for university Computer Science and Software Engineering students. The first audience is Miva Open University students.

The core journey is:

**Learn → Practice → Industry**

The product should feel like one connected companion rather than three separate AI tools.

The main product promise is simple:

**Help a student understand what they are learning, practise it with appropriate guidance, and see how it connects to real software engineering work.**

The product will be web first. The core experience should work across laptops and mobile devices. We are not planning a desktop application or Chrome extension as a requirement.

## 2. Inspiration from Lilo Companion

Lilo Companion is an important product reference. The goal is to learn from its product and engineering ideas, not to copy its branding, interface, written content, or source code.

The strongest ideas we want to carry forward are:

1. A continuous journey instead of isolated AI features.
2. Learning support that does not automatically do the student's work.
3. Different levels of assistance during programming practice.
4. Real evidence for claims about industry relevance.
5. Deterministic software rules around important AI behavior.
6. Clear separation between what the model reasons about and what the software verifies.

Lilo uses a desktop application and a Chrome extension because its practice experience works alongside LeetCode. Our product does not need to copy that form. Programming practice can happen inside the web application itself.

## 3. Product Areas

### Learn

Students should be able to learn from their own university materials and also ask about a concept directly.

For uploaded material, the system should identify important concepts, support ongoing conversation, explain difficult ideas, and point back to the relevant material.

When an answer comes from the student's material, the interface should make that clear. When the companion provides additional general knowledge, it should distinguish that from information grounded in the uploaded material.

Voice can be an interaction method for the same learning conversation rather than a separate product area.

Students may organize uploaded materials by courses. Courses are user created organizational spaces. We are not assuming access to Miva's course registration system or dashboard.

A course can contain several learning materials. Concepts discovered from those materials can connect directly to Practice and Industry.

### Practice

Practice will use validated programming problems from **LeetCode** rather than AI generated exercises. We are currently focusing on LeetCode as the external practice source.

The product should not copy or scrape LeetCode problem statements, test cases, or other protected problem content into our own application. Instead, our application can maintain curated metadata that connects concepts to relevant LeetCode problems, such as the concept, problem title, difficulty, and original LeetCode link.

A student can move from a concept in Learn to a curated set of relevant LeetCode problems and open the selected problem on LeetCode to solve it in the original environment.

For the initial product, a Chrome extension is **not required**. Without an extension, our web application cannot automatically inspect the student's LeetCode editor, code, or test results. When the student wants coaching, they can bring their own attempt back to the companion, such as their code and relevant error or test result. The companion already knows the concept and selected problem, so the student does not need to recreate the full learning context.

An optional browser integration can be considered later if automatic code and test state becomes valuable enough to justify the additional installation and engineering complexity.

The current assistance model is inspired by three levels:

**Hands Off:** minimal intervention and reflective prompts.

**Coach:** hints, debugging guidance, and help identifying where the student's reasoning or code is going wrong.

**Tutor:** stronger step by step guidance when the student needs more help.

The exact rules for these levels will be defined during the product specification.

Important assistance limits should be enforced by software where possible, not only by prompts to the model.

### Industry

Industry replaces the earlier Progress concept.

This area shows students how concepts and skills from Learn and Practice appear in real software engineering opportunities.

For example, if a student is learning recursion, databases, APIs, testing, or another concept, the product can show relevant terminology and evidence from real job postings.

The AI should not invent industry connections. Real job posting evidence should support the connection. The interface should expose the evidence to the student.

The exact evidence sources, retrieval method, freshness rules, and verification behavior will be researched and specified before implementation.

## 4. How the Three Areas Connect

The same learning context should move through the product.

A student can learn a concept, move directly into a relevant programming exercise, and then inspect how the concept or related skill appears in industry.

Conceptually:

**Course material → Concept → Learn → Practice → Industry**

The student should not have to repeatedly explain what they are studying as they move between these experiences.

This connected context is one of the main reasons the product should feel like a companion rather than a collection of AI utilities.

## 5. AI and Engineering Principles

The product should not become a collection of prompts wrapped in a user interface.

For each feature, we will decide:

1. What the language model should do.
2. What retrieval should provide.
3. What claims require real evidence.
4. What deterministic software should enforce.
5. What should not use AI at all.

Course material answers should be grounded when the user is asking about uploaded material.

Industry claims should be grounded in real evidence.

Programming assistance rules should be enforced by software where practical.

If evidence is unavailable, the product should not present unsupported claims as facts.

The model layer should be designed so the product is not unnecessarily tied to one model provider.

## 6. Access and Product Constraints

The capstone theme emphasizes learning access, sustained engagement, connection to opportunity, quality, low bandwidth, accessibility, privacy, multilingual access, and local relevance.

These constraints influence the decision to make the product web first and accessible from more than a high end laptop.

AI inference still has a real cost. The product should not assume that every student can pay for an API subscription or run a large local model. The proof of concept can use legitimate available model access while the architecture keeps model access replaceable. Sustainable inference is a product and deployment question that must be addressed honestly rather than hidden.

## 7. Current Scope Decisions

We are currently working with these decisions:

**Included in the product direction**

Learn from uploaded course material.

Ongoing grounded conversation about learning material.

Direct concept learning without requiring an upload.

Course based organization of learning materials.

Curated links from learned concepts to validated LeetCode programming problems.

Practice coaching that works without requiring a browser extension.

Controlled AI assistance during practice.

Connections between academic concepts and real job posting evidence.

A connected Learn, Practice, Industry journey.

Responsive web access.

Voice as a possible interaction method within learning.

**Not currently required**

A desktop application.

A Chrome extension.

Copying or scraping LeetCode problem content into our application.

A required Chrome extension for the initial Practice experience.

An in browser coding editor that duplicates LeetCode's execution environment.

AI generated programming problems.

Automatic integration with the Miva student dashboard.

A library or Open Library feature.

Interview experience scraping.

A large collection of unrelated student tools.

A requirement for students to supply their own paid API keys.

These decisions can change if later research or product design gives us a strong reason to change them.

## 8. Repository Knowledge Structure

The planned repository knowledge structure is:

```text
AGENTS.md
ARCHITECTURE.md

docs/
├── product/
│   ├── product-spec.md
│   ├── user-journeys.md
│   └── mvp-scope.md
│
├── research/
│   ├── lilo-companion.md
│   ├── target-users.md
│   └── evidence-sources.md
│
├── design/
│   └── ui-ux-spec.md
│
├── architecture/
│   ├── ai-system.md
│   ├── retrieval-grounding.md
│   └── coaching-guards.md
│
└── plans/
    └── implementation-plan.md
```

This structure may be refined as the project develops. The goal is not to create unnecessary documentation. Each file should contain information that helps Codex understand or build the product.

## 9. Working Process

The project will move through the following sequence:

```text
Research and discussion
        ↓
Product decisions
        ↓
Product specification
        ↓
User journeys and scope
        ↓
UX specification
        ↓
Architecture
        ↓
AI, grounding, and safeguard specification
        ↓
AGENTS.md
        ↓
Codex implementation plan
        ↓
Codex builds
        ↓
Test, review, and iterate
```

Each major completed stage should be captured in a readable document and a Markdown file. The Markdown versions will later become repository knowledge for Codex.

Codex should not be asked to invent the fundamental product from a single large prompt. We will provide the important decisions as structured repository knowledge. Codex can then plan implementation from that context, and we will review its plan before substantial implementation.

## 10. Documentation Principle

Chat discussion is useful for exploration, but important decisions should not remain only in chat.

As each stage is completed, its conclusions should move into durable project documents. These documents become the project's source of truth and reduce the need to reconstruct decisions later.

## 11. Next Stage

The next stage is the detailed Product Specification.

We have started defining Learn, but it is not yet complete. We still need to finish Learn, then define Practice, Industry, the connections between them, user journeys, important behaviors, and MVP boundaries.

Once those decisions are complete, they will be captured separately in the Product Specification documents.
