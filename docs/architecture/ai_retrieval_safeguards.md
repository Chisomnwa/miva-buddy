# Capstone AI, Retrieval, and Safeguards

## 1. Purpose

This document defines how AI, retrieval, evidence, grounding, Practice coaching, validation, persistence, and failure handling should behave in the capstone learning companion.

It complements the Architecture Requirements. The Architecture Requirements define the system-level boundaries. This document defines the product-specific rules that must operate inside those boundaries.

It intentionally does not choose exact AI providers, embedding models, vector databases, PDF libraries, schemas, frameworks, or repository structure. Codex should propose those implementation details later.

## 2. Core Trust Model

The product should follow this separation:

```text
AI
Explains, teaches, and reasons.

Retrieval
Supplies course and industry evidence.

Application state
Remembers explicit student and session state.

Deterministic software
Enforces important rules and validates machine-consumed outputs.

UI
Presents all of this simply and truthfully to the student.
```

The model is useful, but it is not the authority for evidence, state, or important behavioral limits.

## 3. AI Tasks Must Have Separate Contexts

The application should not use one universal prompt containing everything known about the student.

Each AI operation receives only the context required for that task.

### Learning

A learning request may receive:

- the student's current question;
- the current concept;
- relevant retrieved course passages;
- source metadata;
- relevant conversation context;
- learning instructions.

### Concept extraction

A concept extraction request may receive:

- processed learning material;
- source metadata;
- concept extraction instructions;
- a required structured output shape.

### Practice

A Practice request may receive:

- selected problem metadata;
- the relevant DSA concept;
- student-supplied code or attempt context;
- relevant previous help;
- the current assistance mode and permitted behavior;
- Practice coaching instructions.

Unrelated course materials, Practice history, and conversations should not be included automatically.

## 4. Provider Independence

The application should access models through a small provider boundary rather than spreading provider-specific assumptions through the product.

```text
Application
     |
     v
AI Provider Boundary
     |
 +---+------------------+
 |                      |
 v                      v
Local Runtime       Hosted Provider
e.g. Ollama         deployed prototype
```

Provider replacement should be possible without rewriting product behavior.

Automatic multi-provider failover is not required for the MVP.

## 5. Course Material Processing

Uploaded PDFs and pasted notes must be processed before grounded learning.

```text
PDF / Notes
     |
     v
Extract usable text
     |
     v
Preserve source locations
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

Concept extraction and question-time retrieval are separate operations.

Concept extraction answers:

> What important concepts does this material teach?

Retrieval answers:

> Which parts of this material are relevant to the student's current question?

## 6. Source Metadata Must Survive Processing

Every retrievable piece of course material should retain enough metadata to trace it back to an understandable source location.

Conceptually:

```text
Retrieved passage
        |
        +-- text
        +-- course
        +-- material
        +-- page or section
```

This allows the UI to render trustworthy references such as:

```text
From your course material
Lecture 03, page 5
```

The model should not invent page numbers or source names.

## 7. Retrieval Happens at Question Time

The application should retrieve relevant passages rather than repeatedly sending an entire document or course to the model.

```text
Student question
       |
       v
Search relevant material
       |
       v
Relevant passages
+ source metadata
       |
       v
AI explanation
```

This reduces unnecessary context and improves grounding.

## 8. Retrieval Should Respect Learning Context

Retrieval should use the student's current learning context.

When the student is already inside a particular concept or material, retrieval should prioritize that context before unnecessarily searching broader material.

Conceptually:

```text
Current concept / material
          |
          v
Enough relevant evidence?
      /         \
    yes          no
     |            |
     v            v
Use it       Current course
                  |
                  v
             broader help
             if appropriate
```

The exact retrieval algorithm is an implementation decision, but the product should behave as a context-aware companion rather than forgetting where the student is.

## 9. Grounding Requires Actual Support

Retrieving a passage does not automatically make every generated claim grounded.

A claim labeled as coming from course material must actually be supported by the retrieved material.

```text
Retrieved evidence
       |
       v
Does it support the claim?
       |
   +---+---+
   |       |
  yes      no
   |       |
   v       v
Grounded   Do not attribute
           it to the material
```

## 10. General Knowledge Is Allowed

The companion should remain useful when the student's material does not contain everything needed for a good explanation.

A response may contain both grounded material and additional explanation.

```text
FROM YOUR COURSE MATERIAL

A base case stops the recursive process.
Lecture 03, page 5


ADDITIONAL EXPLANATION

A simple countdown example can show how the
recursive calls eventually reach the stopping condition.
```

The distinction must be clear. General knowledge must not be presented as though it came from the student's upload.

Student intent also matters. If a student asks what a lecturer or material specifically says, the companion must not substitute general knowledge and attribute it to the material.

## 11. Source References Should Be Machine-Backed

Source references should originate from stored retrieval metadata.

Conceptually:

```text
Retrieved source
      |
      +-- source ID
      +-- material name
      +-- page / section
      +-- passage
             |
             v
            AI
             |
             v
Explanation references source ID
             |
             v
Application renders source details
```

This reduces fabricated citations and preserves source truth outside generated prose.

## 12. Concept Extraction Must Be Grounded

Important concepts identified from uploaded material should be supported by that material.

Concept extraction should return structured information such as:

```text
Concept
  name
  short description
  supporting source reference(s)
```

The UI does not have to show all supporting references immediately, but the system should know why each extracted concept was identified.

## 13. Industry Evidence Is Retrieval-Backed

Industry relevance is evidence shown inside Learn when the student's material contains a genuine job-relevant skill or technology.

The model must not invent industry evidence.

```text
Course material
      |
      v
Concrete skill / technology
      |
      v
Job evidence retrieval
      |
      v
Real posting
      |
      v
Verified relevant excerpt
      |
      v
Evidence card
```

Typical candidate terms may include technologies such as SQL, Python, Docker, Git, AWS, PostgreSQL, Java, or Kubernetes when they genuinely appear in the learning material and are supported by retrieved evidence.

The system must not manufacture chains such as:

```text
Hash Maps
   -> DSA
   -> generic software job
   -> therefore this job uses hash maps
```

## 14. Industry Evidence Requires Direct Support

A claimed match should be directly supported by the posting.

Correct:

```text
Course says: SQL
Posting says: SQL
        |
        v
Supported evidence
```

Incorrect:

```text
Course says: SQL
Posting says: databases
Model infers SQL
        |
        v
Not acceptable as direct evidence
```

If there is no credible evidence, the application simply does not claim a connection.

## 15. Evidence Records Are Independent of AI Prose

Industry evidence should be stored and rendered from structured retrieved data rather than reconstructed from the model's wording.

An evidence record should preserve information such as:

- skill or technology;
- role;
- company;
- exact supporting excerpt;
- source URL;
- retrieval time;
- verification status.

Conceptually:

```text
Retrieved Evidence
       |
       +------------------> UI Evidence Card
       |
       v
      AI
       |
       v
Optional explanation
```

The model may explain why the evidence is relevant, but it does not own the evidence itself.

## 16. Evidence Freshness and Disappearing Postings

A real posting may later close or disappear.

The application should preserve provenance and retrieval time and must not imply that an old posting is currently active when its current availability has not been established.

A previously verified posting can remain historical evidence if represented honestly.

The application must distinguish:

- evidence found;
- valid result with no credible evidence;
- evidence retrieval failure.

Retrieval failure does not mean that no evidence exists.

An elaborate scheduled job-monitoring system is not required for the MVP.

## 17. Practice Coaching Uses the Lilo Reference Behavior

The Practice coaching policy should adopt the behavior documented by Lilo Companion rather than an invented numerical hint ladder.

The modes are:

| Mode | Volunteers up to | Answers up to |
| --- | --- | --- |
| Hands Off | what it sees | a question to think about |
| Coach | the idea by name | where the student's own code goes wrong |
| Tutor | the steps | the answer, and only when asked outright |

Tutor may therefore provide the answer only when the student explicitly asks for it.

The application should preserve the principle that the student chooses the assistance ceiling and the system does not silently exceed it.

## 18. Progressive and Earned Assistance

Following the Lilo reference behavior, proactively offered help should be earned progressively rather than jumping directly to stronger assistance.

In Lilo, an offered hint progresses one grade at a time, no more than once a minute, and only after the student's code changes.

Our web-first MVP does not have Lilo's Chrome extension and therefore cannot automatically observe the student's LeetCode editor or run verdicts.

The product should preserve the coaching policy while adapting the observation mechanism honestly.

The student can provide signals such as:

- pasted code;
- an updated attempt;
- a reported error;
- a reported failed test;
- a description of their approach;
- an explicit request for a hint or explanation.

The application must not claim to know what happened on LeetCode unless the student supplies that information or a future legitimate integration provides it.

## 19. Practice State Exists Outside the Model

A Practice session should maintain explicit state such as:

```text
Problem
Concept
Assistance mode
Previous help
Student-supplied attempts
Relevant code state
Completion status
```

The model does not independently decide what assistance has already been given or what mode is active.

## 20. Practice Responses Must Be Checked

The coaching ceiling must not exist only as prompt wording.

Conceptually:

```text
Student request
      |
      v
Determine permitted help
      |
      v
Model generates candidate hint
      |
      v
Gate evaluates actual hint
      |
  +---+---+
  |       |
 pass    fail
  |       |
  v       v
Show     Reject
           |
           v
      Retry once with
      stricter instruction
           |
           v
      Still invalid?
           |
           v
          Drop
```

The gate should reject assistance that exceeds the selected mode.

Following the Lilo reference behavior, it should also reject a hint that claims to reference a line or variable that does not exist in the student's supplied code.

A rejected hint may be retried once under a stricter instruction. If it still fails, it should be dropped rather than shown.

## 21. Walkthroughs and Dry Runs Obey the Same Ceiling

Changing the presentation format must not bypass the assistance policy.

If the product provides a dry run, visualization, or step-by-step walkthrough, the same assistance ceiling that applies to text should apply to that representation.

A student in a restrictive mode should not receive a full solution merely by asking for a visualization.

## 22. No Fake LeetCode Awareness

Without a browser extension or another legitimate integration, the web application cannot truthfully know:

- whether the student ran their code on LeetCode;
- the actual LeetCode verdict;
- how long the student has been working;
- whether the code in the companion exactly matches the code currently in LeetCode.

The product should rely on explicit student input for these signals in the MVP.

## 23. Machine-Consumed AI Outputs Must Be Structured and Validated

When AI output changes application behavior or stored state, the output should use a predictable structure and be validated before use.

Examples include:

- concept extraction;
- source attribution references;
- evidence-related classifications;
- Practice hint metadata or assistance classification;
- other model outputs that alter state.

Conceptually:

```text
AI structured output
        |
        v
Schema validation
        |
    +---+---+
    |       |
 valid    invalid
    |       |
    v       v
  use     retry once
             |
             v
        still invalid
             |
             v
            fail
```

One controlled retry is sufficient for the MVP. The application should prefer a recoverable failure over accepting malformed state.

Free-form student-facing explanations do not need to be converted entirely into structured data.

## 24. Learning Conversation Persistence

Learning conversations should persist so the student can return to a concept and continue.

Persistence does not mean sending every previous conversation back to the model.

```text
Stored learning history
          |
          v
Select relevant context
          |
          v
Current AI request
```

The current course, material, concept, and relevant conversation should guide context selection.

Unrelated conversations should not be included.

## 25. Minimum Necessary Context

The system should send an AI provider only the information required for the current operation.

Examples:

```text
Concept extraction
-> relevant learning material

Grounded learning question
-> question + relevant passages + source context

Practice help
-> problem metadata + student-supplied attempt/code
   + permitted assistance state

Industry explanation
-> relevant concept + verified evidence
```

The application should not automatically attach the student's entire profile, course library, Practice history, and conversation history to every model call.

This supports privacy, efficiency, and clearer model behavior.

## 26. Provider and Retrieval Failures Must Be Explicit

Different failures should remain distinguishable.

Examples include:

```text
Retrieval succeeded
AI provider failed
```

```text
Retrieval failed
```

```text
Retrieval succeeded
but no supporting material exists
```

These are different conditions and should not all collapse into the same empty result.

A temporary AI failure should not destroy the student's material, conversation, or progress.

Automatic multi-provider failover is not required for the MVP.

## 27. Grounding Failure Must Not Masquerade as Grounding

If generated text is not supported by retrieved course evidence, it must not be presented under the stronger claim:

```text
From your course material
```

Unsupported but useful educational information may instead be provided as clearly identified additional explanation when appropriate.

The course-grounded label carries a stronger trust contract than ordinary educational explanation.

## 28. Industry Evidence Uses the Strictest Evidence Rule

Claims displayed as job evidence must be directly supported by retrieved posting data.

The system must not use model plausibility as a substitute for evidence.

```text
Claim about posting
        |
        v
Directly supported by retrieved posting?
        |
    +---+---+
    |       |
   yes      no
    |       |
    v       v
  show     reject
```

## 29. Final AI and Safeguard Model

```text
                    STUDENT REQUEST
                          |
                          v
                    APPLICATION STATE
                          |
             +------------+------------+
             |            |            |
             v            v            v
          LEARN         PRACTICE     INDUSTRY
             |            |            |
             v            v            v
          Course       Assistance     Job
         Retrieval       Policy     Retrieval
             |            |            |
             v            |            v
         Evidence         |      Verified Evidence
             |            |            |
             +------------+------------+
                          |
                          v
                     AI Boundary
                          |
                          v
                  Candidate Response
                          |
                          v
                 Rules / Validation
                          |
                          v
                       STUDENT
```

The trust boundary can be summarized as:

```text
                    MODEL
                      |
                proposes output
                      |
                      v
               TRUST BOUNDARY
                      |
       +--------------+--------------+
       |              |              |
       v              v              v
    Sources         Schema         Policy
       |              |              |
       v              v              v
 Is evidence      Is output      Is behavior
   real?           valid?         allowed?
       |              |              |
       +--------------+--------------+
                      |
                      v
                 Student sees it
```

## 30. Core Rule

The final rule for this stage is:

> AI explains and reasons. Retrieval supplies evidence. Application state remembers. Deterministic software enforces important rules. The student sees only results that satisfy the relevant trust boundary.

## 31. What This Document Leaves for Codex

Codex should later propose implementation details for these requirements, including suitable approaches for:

- document extraction;
- chunking or other retrieval preparation;
- source metadata representation;
- retrieval and ranking;
- embeddings if appropriate;
- persistence;
- structured-output schemas;
- provider adapters;
- coaching policy representation;
- validation and retry behavior;
- evidence storage;
- backend enforcement.

Those decisions should be proposed after Codex reads the complete product documentation and should be reviewed before implementation begins.
