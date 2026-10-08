# Capstone Architecture Requirements

## 1. Purpose

This document defines the architectural requirements and technical boundaries that must be respected when designing the capstone learning companion.

It is intentionally not the final repository `ARCHITECTURE.md`. It does not prescribe exact frameworks, folder structures, database tables, API routes, classes, or deployment topology. Those implementation decisions should be proposed later by Codex after it has read the product documentation and inspected the repository.

The purpose of this document is to make the important product-level technical constraints explicit so that Codex does not have to guess them.

## 2. Architectural Principle

The system should use the simplest architecture that preserves the important product boundaries, evidence requirements, security guarantees, and coaching rules.

The central separation is:

```text
AI explains and reasons.

Retrieval supplies evidence.

Application state remembers.

Deterministic software enforces important rules.

The UI keeps all of this simple for the student.
```

The application should not become one large AI prompt that attempts to perform every responsibility.

## 3. Clear System Boundaries

The product naturally contains several different responsibilities.

```text
                    STUDENT
                       |
                       v
                WEB APPLICATION
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Learning     Practice     User State
          |            |
          |            |
          v            v
      Retrieval     Coaching
          |          Controls
          |
          v
      AI System
          |
          v
   Generated Response
```

Learning also depends on two different evidence paths:

```text
Learning material
       |
       v
Concept / skill identified
       |
       +---------------+
       |               |
       v               v
Course grounding   Job evidence
       |            retrieval
       +-------+-------+
               |
               v
          AI explanation
               |
               v
        Validation / rules
               |
               v
            Student
```

The architecture must separate these responsibilities rather than asking the model to handle them all implicitly.

The AI should not independently own document storage, evidence truth, practice state, authentication, or enforcement of important product rules.

## 4. Replaceable AI Provider Boundary

The product logic must not depend directly on one model provider.

Conceptually:

```text
Application
     |
     v
AI Provider Boundary
     |
 +---+----------------+
 |                    |
 v                    v
Ollama            Hosted Provider
Local             Online
 |                    |
 v                    v
Local Model       Hosted Model

Future providers can be added behind the same boundary.
```

Model-specific integration should be isolated behind a small provider boundary.

This supports:

- local development with Ollama or another local runtime;
- hosted inference for the deployed prototype;
- changing free or affordable providers without rewriting the product;
- future provider changes if the project grows.

The exact interface and implementation should be proposed by Codex.

## 5. API Credentials Must Stay Server-Side

Provider credentials and other sensitive application secrets must not be shipped to the browser.

Do not use this model:

```text
Browser
   |
   | provider API key
   v
AI Provider
```

Use a trusted server boundary:

```text
Student Browser
       |
       v
Application Backend
       |
       | server-side credential
       v
AI Provider
```

Students should not need to provide their own API key as part of the normal product experience.

## 6. Course Material Requires a Processing Pipeline

Uploaded PDFs and pasted notes require processing before they can reliably support grounded learning.

Conceptually:

```text
PDF / Notes
     |
     v
Extract usable text
     |
     v
Preserve source information
     |
     v
Prepare searchable material
     |
     v
Identify important concepts
     |
     v
Material ready for learning
```

The architecture should not depend on repeatedly sending an entire uploaded PDF to the model for every student question.

The exact extraction, storage, indexing, and retrieval technology is an implementation decision for later technical design.

## 7. Source Location Must Survive Processing

Source metadata must be preserved through document processing.

The UX requires the application to be able to show information such as:

```text
From your course material
Lecture 03, page 5
```

Therefore, processed material must retain enough metadata to connect retrieved content back to the original material and an understandable source location such as page or section.

If source information is lost during ingestion, the application cannot honestly provide the grounding experience defined in the UX specification.

## 8. Grounding Must Use Retrieval Rather Than Model Memory

When a student asks a question about uploaded material, the system should retrieve relevant material before generating a grounded response.

```text
Student Question
       |
       v
Find relevant course material
       |
       v
Relevant passages
+ source metadata
       |
       v
AI receives:
- question
- relevant passages
- source information
- task instructions
       |
       v
Generated explanation
```

The model should not be expected to remember an entire lecture or pretend that general model knowledge came from the student's course material.

The architecture must support the distinction between:

```text
Relevant course evidence exists
             |
             v
     Grounded explanation
```

and:

```text
Course material does not contain enough
             |
             v
     Additional explanation
             |
             v
Clearly identified as going beyond
the uploaded material
```

The detailed grounding rules belong in the AI, Retrieval, and Safeguards specification.

## 9. Industry Evidence Must Be Retrieval-Backed

Industry relevance must be supported by real job-posting evidence.

The model must not invent job evidence from its own memory.

Correct flow:

```text
Course material
      |
      v
Concrete skill / technology
      |
      v
Evidence retrieval
      |
      v
Real job posting
      |
      v
Relevant supported excerpt
      |
      v
AI may explain the connection
```

Incorrect flow:

```text
Course concept
      |
      v
LLM guesses about industry
      |
      v
Unsupported career claim
```

Evidence should be represented independently from model-generated prose and should preserve structured information such as:

- skill or technology;
- role;
- company;
- relevant excerpt;
- source URL;
- evidence status.

If no credible evidence exists, the application must not manufacture a connection.

```text
No evidence
    |
    v
Do not claim one
```

## 10. Retrieved Evidence Must Survive the Model

Correctly retrieved evidence should not become dependent on the model accurately repeating it.

Conceptually:

```text
Retrieved Evidence
       |
       +-----------------> UI Evidence Card
       |
       v
      AI
       |
       v
Optional explanation
```

The source card should be built from retrieved structured evidence rather than reconstructed from generated text.

This reduces the risk that a model changes a role, company, requirement, quotation, or source while explaining its significance.

## 11. Practice State Must Exist Outside the LLM

The application must explicitly maintain Practice session state.

Conceptually, a Practice session may need to know:

```text
Practice Session

Problem
Concept
Assistance mode
Current assistance level
Previous help
Student attempts
Completion status
```

The model should not independently decide how much help it has already provided.

A Practice request should conceptually work like:

```text
Student asks for help
        |
        v
Application reads session state
        |
        v
Determine allowed assistance
        |
        v
AI receives bounded task
        |
        v
Candidate response
        |
        v
Validation
        |
        v
Update session state
```

The exact assistance rules and validation mechanism belong in the AI, Retrieval, and Safeguards specification.

## 12. Important Rules Must Not Exist Only as Prompts

Prompt instructions can guide the model, but important product rules require application-level enforcement where practical.

Examples include:

- assistance ceilings for Hands Off, Coach, and Tutor;
- trusted evidence requirements;
- source-grounding boundaries;
- authorization and user ownership;
- important state transitions;
- provider credentials and other secrets.

The architecture should assume that model instructions can fail and should place important guarantees outside the model when feasible.

## 13. Machine-Consumed AI Output Should Be Structured

Natural language is appropriate for student-facing explanations.

When an AI output affects application behavior, it should use a predictable structured format that can be validated.

For example, concept extraction should conceptually return:

```text
concepts:
  - name
  - description
  - source references
```

rather than relying on arbitrary prose that the application later attempts to interpret.

The general rule is:

```text
Human-facing explanation
        |
        v
Natural language is appropriate


Machine-consumed decision
        |
        v
Structured output + validation
```

The exact schemas and validation technology should be proposed during technical design.

## 14. Persistent State Must Be Explicit

The product should not depend on unlimited AI conversation memory.

Important student and application state must be stored explicitly.

Conceptually:

```text
USER
|
+-- profile
|   +-- programme
|   +-- level
|   +-- career interests
|
+-- courses
|   +-- materials
|       +-- concepts
|
+-- learning
|   +-- conversations / progress
|
+-- practice
    +-- problems
    +-- sessions
    +-- assistance state
    +-- completion state
```

Each AI request should receive only the context needed for the current task rather than the student's entire history.

## 15. The Browser Is Not a Trusted Enforcement Boundary

Important security and behavioral rules should not exist only in frontend code.

For example, the browser should not be able to bypass a server-known Practice mode or assistance ceiling by changing local state.

The trusted backend should be responsible for appropriate enforcement of:

- authentication and authorization;
- sensitive credentials;
- evidence validation;
- important state transitions;
- Practice constraints;
- other server-side invariants.

The frontend is responsible for presenting the experience, not for being the sole source of truth for trusted rules.

## 16. Failure States Must Be Distinguishable

The architecture must preserve enough state to allow the UX to communicate failures truthfully.

For job evidence:

```text
        Evidence Request
               |
        +------+------+
        |             |
        v             v
   Request works   Request fails
        |
   +----+----+
   |         |
   v         v
Evidence   No credible
found      evidence
```

These states must not all collapse into the same `null` or empty response.

The UI needs to distinguish:

- evidence found;
- valid result with no credible evidence;
- retrieval or provider failure.

Likewise, document processing should distinguish states such as:

```text
processing
ready
failed
```

AI requests should distinguish states such as:

```text
pending
success
failed
```

This allows the UX to offer the correct recovery behavior.

## 17. Keep the Architecture Appropriate for the Capstone

The system should not introduce infrastructure merely because it is technically sophisticated.

The project does not require an unnecessary collection of microservices, message brokers, orchestration platforms, databases, or custom model-hosting systems.

A simpler architecture may be entirely appropriate:

```text
             WEB APPLICATION
             /             \
        frontend          backend
                            |
              +-------------+-------------+
              |             |             |
             data       retrieval        AI
              |             |             |
              +-------------+-------------+
```

The requirement is:

> Prefer the simplest architecture that preserves the important product boundaries, trust guarantees, evidence requirements, and future maintainability.

Codex should be asked to justify complexity when it proposes the final technical design.

## 18. Architecture Requirements Summary

The architectural requirements can be summarized as:

```text
                        STUDENT
                           |
                           v
                    RESPONSIVE WEB UI
                           |
                           v
                    TRUSTED BACKEND
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
   Persistent State    Retrieval         AI Boundary
        |                  |                  |
        |          +-------+--------+         |
        |          |                |         |
        |     Course Material   Job Evidence |
        |          |                |         |
        |          +-------+--------+         |
        |                  |                  |
        +------------------+------------------+
                           |
                           v
                    Rules / Validation
                           |
                           v
                       RESPONSE
```

The architecture must preserve the following core separation:

```text
AI explains and reasons.

Retrieval supplies evidence.

Application state remembers.

Deterministic software enforces important rules.

The UI keeps all of this simple for the student.
```

## 19. What This Document Does Not Decide

This document intentionally does not lock:

- frontend framework;
- backend framework;
- database vendor;
- vector database or retrieval implementation;
- embedding model;
- AI model or hosted provider;
- exact local Ollama model;
- PDF parsing library;
- hosting provider;
- deployment topology;
- repository directory structure;
- exact API routes;
- database schema;
- class or module names.

Those choices were intentionally left for the later technical design. The approved planned choices are now recorded in the repository-level `ARCHITECTURE.md` and implementation plan; they must be updated as implementation makes them concrete.

## 20. Relationship to ARCHITECTURE.md

This document is a pre-implementation requirements document.

The repository-level `ARCHITECTURE.md` serves a different purpose. Its pre-implementation version records the approved planned architecture and must clearly distinguish that plan from implemented reality. As the repository gains a meaningful structure, it should evolve into a concise map of the actual system, including:

- major repository components;
- where those components live;
- what each component owns;
- how major components communicate;
- important boundaries and invariants future changes must preserve.

Therefore:

```text
Architecture Requirements
        |
        | defines what must be true
        v
Approved Technical Design
        |
        | records planned architecture
        v
Pre-implementation ARCHITECTURE.md
        |
        | guides and evolves with implementation
        v
Implementation
        |
        v
Updated ARCHITECTURE.md
        |
        | maps the actual codebase
        v
Future Codex work
```
