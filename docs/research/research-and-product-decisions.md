# Capstone Research and Product Decisions

## Purpose

This document records the important research findings and product
decisions that shaped the project. It preserves useful research history
while reflecting the current product direction. Where early exploration
differed from later decisions, the current direction is stated
explicitly here. The later Product Specification, User Journeys and MVP
Scope, UX Specification, Architecture Requirements, AI / Retrieval /
Safeguards, and Visual Design System define the authoritative
implementation requirements.

## 1. Project Direction

The product is an AI learning companion for university Computer Science
and Software Engineering students. The first audience is Miva Open
University students.

Early exploration considered a three-part journey of Learn → Practice →
Industry. Subsequent product work refined that model.

**Learn is the center of the product.** Practice and industry evidence
are contextual extensions of learning rather than three equal
destinations.

The current model is:

``` text
Course material / concept
        |
        v
      Learn
        |
        +---- concrete job-relevant skill in course material
        |              |
        |              v
        |      contextual job evidence
        |
        +---- DSA concept
                       |
                       v
                    Practice
```

Not every concept needs either extension. When neither applies, the
companion should simply teach the concept well.

The main product promise is:

**Help a student understand what they are learning, practise relevant
DSA concepts with appropriate guidance, and see credible evidence when
concrete skills from their coursework appear in real software
engineering jobs.**

The product will be web first. The core experience should work across
laptops and mobile devices. We are not planning a desktop application or
Chrome extension as a requirement.

## 2. Inspiration from Lilo Companion

Lilo Companion is an important product reference. The goal is to learn
from its product and engineering ideas, not to copy its branding,
interface, written content, or source code.

The strongest ideas we want to carry forward are:

1.  A continuous journey instead of isolated AI features.
2.  Learning support that does not automatically do the student's work.
3.  Different levels of assistance during programming practice.
4.  Real evidence for claims about industry relevance.
5.  Deterministic software rules around important AI behavior.
6.  Clear separation between what the model reasons about and what the
    software verifies.

Lilo uses a desktop application and a Chrome extension because its
practice experience works alongside LeetCode. Our product does not need
to copy that form. In the MVP, students solve curated problems on
LeetCode itself and return to Miva Buddy for coaching when they need
help. Miva Buddy does not recreate the LeetCode editor or pretend to
observe LeetCode activity that the student has not supplied.

## 3. Product Areas

### Learn

Students should be able to learn from their own university materials and
also ask about a concept directly.

For uploaded material, the system should identify important concepts,
support ongoing conversation, explain difficult ideas, and point back to
the relevant material.

When an answer comes from the student's material, the interface should
make that clear. When the companion provides additional general
knowledge, it should distinguish that from information grounded in the
uploaded material.

Voice can be an interaction method for the same learning conversation
rather than a separate product area.

Students may organize uploaded materials by courses. Courses are user
created organizational spaces. We are not assuming access to Miva's
course registration system or dashboard.

A course can contain several learning materials. DSA concepts discovered
from those materials may connect to Practice. When the material contains
a concrete job-relevant skill or technology and credible job-posting
evidence exists, contextual industry evidence may appear inside Learn.

### Practice

Practice will use validated programming problems from **LeetCode**
rather than AI generated exercises. We are currently focusing on
LeetCode as the external practice source.

The product should not copy or scrape LeetCode problem statements, test
cases, or other protected problem content into our own application.
Instead, our application can maintain curated metadata that connects
concepts to relevant LeetCode problems, such as the concept, problem
title, difficulty, and original LeetCode link.

A student can move from a concept in Learn to a curated set of relevant
LeetCode problems and open the selected problem on LeetCode to solve it
in the original environment.

For the initial product, a Chrome extension is **not required**. Without
an extension, our web application cannot automatically inspect the
student's LeetCode editor, code, or test results. When the student wants
coaching, they can bring their own attempt back to the companion, such
as their code and relevant error or test result. The companion already
knows the concept and selected problem, so the student does not need to
recreate the full learning context.

An optional browser integration can be considered later if automatic
code and test state becomes valuable enough to justify the additional
installation and engineering complexity.

The assistance model follows the Lilo-inspired three-mode policy:

**Hands Off:** volunteers what it sees and a question to think about.

**Coach:** may volunteer the idea by name and, when asked, explain where
the student's own code or reasoning goes wrong.

**Tutor:** may provide the steps and gives the full answer only when the
student explicitly asks for it.

Coach is the default. Progressive help and assistance ceilings are
enforced by application logic rather than relying only on prompts.
Because the MVP has no browser extension, progression can use only state
the student supplies inside Miva Buddy. The application must never claim
to know LeetCode editor state, run verdicts, or submissions it did not
receive.

### Contextual Industry Evidence

Industry relevance is an evidence capability inside course-grounded
Learn, not a standalone product area.

When uploaded learning material contains a concrete job-relevant skill
or technology such as SQL, Python, Docker, Git, AWS, PostgreSQL, Java,
or Kubernetes, the product may show a real job-posting excerpt
demonstrating that the term appears in industry.

The connection must be directly supported by retrieved evidence. A
posting that mentions a broad term such as "data structures and
algorithms" does not prove that it specifically requires hash maps,
arrays, recursion, or another narrower concept.

The AI may explain why verified evidence is useful, but it must not
invent the evidence or manufacture the connection. Retrieval supplies
the posting evidence and software verifies it.

Practice does not display industry evidence.

## 4. How the Experiences Connect

The same learning context should move through the product without
forcing every concept through the same path.

``` text
Course material
      |
      v
Important concept
      |
      v
     Learn
      |
      +---- DSA appropriate? --------> Practice
      |
      +---- concrete skill with
            credible job evidence? --> Show evidence inside Learn
```

A student should not have to repeatedly explain what they are studying
as they move from Learn into a relevant Practice session.

This connected context is one of the main reasons the product should
feel like a companion rather than a collection of AI utilities.

## 5. AI and Engineering Principles

The product should not become a collection of prompts wrapped in a user
interface.

For each feature, we will decide:

1.  What the language model should do.
2.  What retrieval should provide.
3.  What claims require real evidence.
4.  What deterministic software should enforce.
5.  What should not use AI at all.

Course material answers should be grounded when the user is asking about
uploaded material.

Industry claims should be grounded in real evidence.

Programming assistance rules should be enforced by software where
practical.

If evidence is unavailable, the product should not present unsupported
claims as facts.

The model layer should be designed so the product is not unnecessarily
tied to one model provider.

## 6. Access and Product Constraints

The capstone theme emphasizes learning access, sustained engagement,
connection to opportunity, quality, low bandwidth, accessibility,
privacy, multilingual access, and local relevance.

These constraints influence the decision to make the product web first
and accessible from more than a high end laptop.

AI inference still has a real cost. The product should not assume that
every student can pay for an API subscription or run a large local
model. The proof of concept can use legitimate available model access
while the architecture keeps model access replaceable. Sustainable
inference is a product and deployment question that must be addressed
honestly rather than hidden.

## 7. Current Scope Decisions

We are currently working with these decisions:

**Included in the product direction**

Learn from uploaded course material.

Ongoing grounded conversation about learning material.

Direct concept learning without requiring an upload.

Course based organization of learning materials.

Curated links from learned concepts to validated LeetCode programming
problems.

Practice coaching that works without requiring a browser extension.

Controlled AI assistance during practice.

Contextual connections between concrete skills or technologies in course
material and real job-posting evidence.

A connected learning journey in which Practice is offered for relevant
DSA concepts and industry evidence appears inside Learn when directly
supported.

Responsive web access.

Voice as a possible interaction method within learning.

**Not currently required**

A desktop application.

A Chrome extension.

Copying or scraping LeetCode problem content into our application.

A required Chrome extension for the initial Practice experience.

An in browser coding editor that duplicates LeetCode's execution
environment.

AI generated programming problems.

Automatic integration with the Miva student dashboard.

A library or Open Library feature.

Interview experience scraping.

A large collection of unrelated student tools.

A requirement for students to supply their own paid API keys.

These decisions can change if later research or product design gives us
a strong reason to change them.

## 8. Repository Knowledge Structure

The current repository knowledge is organized around the finalized
project documents:

``` text
README.md

docs/
├── research/
│   └── research-and-product-decisions.md
├── product/
│   ├── product-spec.md
│   ├── user-journeys-and-mvp.md
│   ├── ux-spec.md
│   └── visual-design-system.md
└── architecture/
    ├── architecture-requirements.md
    └── ai-retrieval-safeguards.md
```

`AGENTS.md`, the code-aware `ARCHITECTURE.md`, and implementation
planning documents should be created only after the technical
architecture and implementation plan have been reviewed. They should
point to deeper repository knowledge rather than duplicate the product
specification.

## 9. Working Process

The project has moved through:

``` text
Research and discussion
        ↓
Product decisions
        ↓
Product specification
        ↓
User journeys and MVP scope
        ↓
UX specification
        ↓
Architecture requirements
        ↓
AI, retrieval, and safeguards
        ↓
Visual design system
        ↓
Codex technical architecture proposal
        ↓
Architecture review
        ↓
Implementation planning
        ↓
Repository operating instructions
        ↓
Implementation by milestones
        ↓
Test, review, document, and iterate
```

Important product decisions should live in durable repository documents
rather than only in chat. Codex should use those documents as the
product knowledge base and should not silently replace locked decisions
with generic AI-app conventions.

## 10. Documentation Principle

Research records how the product direction was discovered, but later
specifications are more authoritative when they refine an earlier idea.

The implementation source-of-truth hierarchy is:

1.  Product Specification and User Journeys / MVP Scope for product
    behavior and scope.
2.  UX Specification and Visual Design System for interaction and
    presentation.
3.  Architecture Requirements and AI / Retrieval / Safeguards for
    technical boundaries, trust rules, and AI behavior.
4.  This research document for background, rationale, and research
    history.

If an older exploratory statement conflicts with a later locked
specification, the later specification governs implementation.

## 11. Current Stage

The product research, product specification, user journeys and MVP
scope, UX specification, architecture requirements, AI / retrieval /
safeguards, and visual design system have been completed.

The current engineering stage is to review the technical architecture
proposed by Codex, resolve genuine open decisions, and then produce a
milestone-based MVP implementation plan before application code is
created.
