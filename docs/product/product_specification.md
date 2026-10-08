# Capstone Product Specification

## 1. Product Direction

The project is a web first AI learning companion for university Computer Science and Software Engineering students, initially designed around Miva Open University students.

It helps students understand course material and practise Data Structures and Algorithms with controlled AI guidance. While a student is learning from course material, the companion can also surface real job posting evidence when an explicitly mentioned skill or technology, such as SQL, Python, Docker, Git, AWS, or PostgreSQL, genuinely appears in industry evidence.

The core product journey is:

**Learn, with contextual industry evidence → Practice when relevant**

The product promise is:

> Help a student understand what they are learning, practise relevant DSA with appropriate guidance, and notice when skills from their coursework genuinely appear in real software engineering work.

## Student identity and persistence

The MVP must have no user-facing account or sign-in ceremony. On first use, a student completes one lightweight profile screen and enters the application. Do not request an email address or password, require email verification, provide password reset, or require SMTP/email infrastructure. Supabase anonymous authentication establishes a stable internal user ID without exposing an authentication step. Persist the profile and application data in Supabase/PostgreSQL and isolate each browser identity with server-verified sessions and row-level security.

The MVP guarantees continuity only in the same browser while its session data remains available. Clearing browser data or changing devices may make an anonymous profile inaccessible; cross-device restoration and account recovery are deferred beyond the MVP. Proper user-facing account authentication may be considered after the MVP.

The product is inspired by the community first approach of Lilo Companion, adapted around the learning journey of Miva Computer Science and Software Engineering students. It should not become a generic collection of AI tools with Miva branding.

## 2. Target User

The initial target user is a Miva Open University Computer Science or Software Engineering student.

The first version should be useful to students who are studying university courses, learning programming and DSA, and trying to understand how academic concepts relate to software engineering careers.

The product may later generalize to students at other universities, but the first version should be coherent and useful for the initial Miva audience.

## 3. Product at a Glance

```text
                         STUDENT
                            │
                            ▼
                          LEARN
                            │
                  Understand course ideas
                  with source grounding
                            │
              ┌─────────────┴─────────────┐
              │                           │
     Job relevant skill?             DSA concept?
     Evidence available?                  │
              │                           ▼
              ▼                        PRACTICE
     Show real job evidence          Curated LeetCode
     inside learning                 + controlled coaching
```

Learn is the center of the product. Practice is available when a concept maps naturally to DSA. Industry relevance is not a separate destination that every concept must reach. It appears contextually inside Learn when the student's material mentions a concrete skill or technology and credible job posting evidence supports it.

## 4. Core Product Areas

### Learn

Learn helps the student understand a concept through a focused conversation.

When learning material has been uploaded, the companion grounds relevant claims in that material and provides source references. It clearly distinguishes information drawn from the student's material from additional explanation based on broader model knowledge.

A student can also learn without uploading material by entering a concept directly, such as "Teach me binary trees." This is labelled as general explanation rather than material grounded learning.

While explaining uploaded course material, the companion may encounter a concrete job relevant skill or technology such as SQL, Python, Docker, Git, AWS, or PostgreSQL. When credible job posting evidence exists for that skill, the learning experience can show a small industry evidence card with the role, company, relevant excerpt, and original posting link. This is contextual evidence inside Learn, not a separate job search flow.

The product must not manufacture indirect mappings from DSA concepts such as arrays, hash maps, linked lists, sliding window, or recursion to generic job requirements. If a posting does not actually support the claimed skill connection, no industry evidence is shown.

Useful contextual actions may include Explain simply, Give an example, Check my understanding, and Practice this when the concept has a relevant DSA path.

Voice may later be supported as another interaction method, but the complete experience must remain available through text.

### Practice

Practice is initially focused on Data Structures and Algorithms.

The application maps relevant DSA concepts to curated, validated LeetCode problems. It stores only useful metadata such as concept, problem title, difficulty, original LeetCode link, and relevant tags where appropriate. Students solve on LeetCode rather than in a duplicated coding environment.

When students need help, they can bring their own attempt, code, error, or failed test information back to the companion.

Practice has three assistance modes:

- Hands Off
- Coach
- Tutor

These represent real assistance ceilings. Important limits should be enforced through deterministic software and structured validation where possible, rather than relying only on prompts.

The initial product does not require a browser extension and therefore does not claim to know automatically whether a LeetCode submission passed.

### Contextual Industry Evidence

Industry relevance supports Learn rather than operating as a separate product area.

Its purpose is simple: when the student's course material explicitly mentions a job relevant skill or technology, the companion can show that the same skill appears in real software engineering or data job postings.

Connections must be supported by real job posting evidence from legitimate public sources. Retrieval supplies the evidence. AI may explain what the evidence means in the learning context. Software verifies that the displayed evidence supports the claimed term.

The student may see the skill, a short explanation, the company and role, a relevant posting excerpt, and the original source. If sufficient evidence does not exist, nothing is forced.

Career interests may help rank which evidence is most relevant, but personalization must never manufacture a connection.

This capability is not a general job search engine and does not belong inside the DSA Practice experience.

## 5. How the Areas Connect

```text
                    LEARNING MATERIAL
                           │
                           ▼
                         LEARN
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
      Learn normally   DSA concept   Job relevant skill
                           │             │
                           ▼             ▼
                       PRACTICE      Evidence exists?
                                         │
                                      ┌──┴──┐
                                     YES    NO
                                      │      │
                                      ▼      └─ Continue learning
                               Show evidence
                               inside Learn
```

Not every concept needs another destination. A DSA concept may lead to Practice. A concrete job relevant skill may receive contextual job evidence. Many concepts may simply remain in Learn, which is completely valid.

The student should experience one companion whose behavior changes with context. In Learn it teaches and explains, using course material or clearly labelled general knowledge. In Practice it coaches within the selected assistance ceiling. When industry evidence appears inside Learn, it is grounded in real job postings and kept secondary to the lesson.

## 6. Product State and Continuity

The product remembers explicit state rather than relying on vague unlimited AI memory.

Student state includes programme, current level, and career interests.

Learning state includes courses, materials, identified concepts, and learning conversations.

Practice state includes DSA concepts, selected LeetCode problems, practice status, assistance mode, and relevant coaching state.

Industry evidence state may include evidence previously shown and career interests used for ranking. It does not require a separate Industry workspace.

Each model request should receive only context relevant to the current task.

## 7. Trust and Failure Behavior

Failure behavior is part of the product.

If a document cannot be processed, the product explains that it could not read the material and lets the student try another PDF or paste text.

If useful concepts cannot be identified confidently, the product says so.

If a concept does not have a relevant DSA practice path, Practice is not forced.

If a job relevant skill does not have enough credible posting evidence, no industry connection is shown.

If contextual industry evidence contains an unsupported claim, deterministic validation should reject it rather than display it.

If a Practice response exceeds the selected assistance mode, the system should reject or constrain it.

## 8. Product Principles

### Community first

The product should fit the real learning journey of its initial Miva CS and Software Engineering audience rather than becoming a generic AI education product.

### One coherent journey

Learn is the primary learning surface. Practice extends relevant DSA concepts, while job posting evidence appears contextually inside Learn when it is genuinely supported.

### Ground claims in evidence

Course claims should be traceable to learning materials when presented as grounded information. Any industry relevance shown during Learn should be traceable to real job evidence.

### Use AI where reasoning helps

AI should explain, translate, coach, and connect information. It should not be used simply because a feature can contain an LLM call.

### Enforce important rules in software

Practice assistance ceilings and contextual industry evidence requirements should use deterministic checks and structured validation where possible.

### Do not force unsupported behavior

No DSA mapping is better than an irrelevant problem. No industry connection is better than an invented one.

### Accessible by default

The application should be a responsive web experience and should not depend on a desktop application, browser extension, local model installation, or student supplied API key for its core experience.

## 9. Product Definition Status

This document defines the product itself. Detailed user flows and the MVP boundary are maintained separately in the User Journeys and MVP Scope document.

The next major design stage is the UX Specification, where these product behaviors are translated into navigation, screens, information hierarchy, interaction flows, and interface states.
