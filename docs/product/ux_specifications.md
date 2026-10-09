# Capstone UX Specification

## 1. Purpose

This document defines the user experience for the capstone learning
companion. It translates the product specification and user journeys
into a simple set of screens, interactions, states, and navigation
rules.

The product is a web-first AI learning companion for university Computer
Science and Software Engineering students, initially designed around
Miva Open University students.

Its UX should make it easy for a student to:

-   learn from course materials or ask about a concept directly;
-   receive explanations that clearly distinguish course-grounded
    information from additional explanation;
-   see real job-posting evidence when a concrete skill or technology in
    their learning material is genuinely used in industry;
-   practise relevant Data Structures and Algorithms concepts through
    curated LeetCode problems;
-   receive controlled AI coaching without unnecessary setup or
    navigation;
-   return later and continue from where they stopped.

## 2. Core UX Principles

### 2.1 Minimize interaction cost

Every screen should minimize the number of decisions, clicks, and
repeated inputs required to complete the student's task.

Do not ask the student to reselect or reenter information the
application already knows.

Examples:

``` text
Currently learning Trees
        |
        v
Practice this
        |
        v
Trees problems
```

Not:

``` text
Currently learning Trees
        |
        v
Practice
        |
        v
Choose topic
        |
        v
Trees
        |
        v
Problems
```

### 2.2 Keep screens focused

Each screen should have one clear purpose. Avoid dashboards filled with
statistics, excessive controls, unrelated actions, or feature menus.

### 2.3 Context should follow the student

Relevant context should move with the student through the journey. This
includes course, material, concept, selected problem, assistance mode,
career interests, and recent activity.

### 2.4 Do not force connections

Not every concept needs Practice. Not every concept needs industry
evidence.

A concept should simply be taught well when neither additional path is
relevant.

### 2.5 Trust should be visible

The interface should clearly communicate:

-   when an explanation is grounded in uploaded course material;
-   when an explanation uses general model knowledge;
-   what source supports a grounded answer;
-   what real job posting supports an industry claim;
-   when evidence could not be found;
-   when the system failed to retrieve evidence.

### 2.6 Infrastructure should stay invisible

Students should not need to understand AI providers, API keys,
embeddings, retrieval systems, prompts, or model configuration in order
to use the product.

## 3. Information Architecture

V1 interface refinement update: Courses is now a first-class primary navigation item on desktop and mobile. The earlier three-item navigation diagrams and the navigation bullet in Section 30 document the pre-refinement baseline; use Home, Learn, Courses, Practice, with Profile/Settings separate. This change does not add an Industry destination or change the course/learning flows. See `docs/plans/v1-interface-refinement-plan.md`.

The primary navigation is deliberately small:

``` text
Home
Learn
Practice
----------------
Profile / Settings
```

There is no separate Industry destination.

Industry relevance is an evidence capability inside Learn. When a course
or learning material contains a concrete job-relevant skill or
technology and reliable job-posting evidence exists, that evidence can
appear naturally during learning.

The overall structure is:

``` text
                         APP
                          |
          +---------------+---------------+
          |               |               |
         HOME            LEARN         PRACTICE
          |               |               |
       Continue       +---+----+       DSA topics
       Courses        |        |           |
       Recent       Course   Direct      Problems
                   material  concept        |
                      |        |          LeetCode
                      +---+----+             |
                          |                Coaching
                          v             Hands Off
                       CONCEPT             Coach
                          |                Tutor
                 +--------+--------+
                 |                 |
          DSA appropriate     Job-relevant skill
                 |                 |
                 v                 v
          Offer Practice       Real posting
                              evidence appears
                              inside learning
```

## 4. Onboarding

Onboarding should be a single lightweight screen rather than a
multi-step wizard.

Collect:

-   programme or study area;
-   current level;
-   career interests.

Career interests may be multi-select and can be edited later.

Do not include learning-style quizzes, AI personality choices, long
questionnaires, or university-selection flows in the initial experience.

``` text
+------------------------------------------------------+
|                 Welcome to Companion                 |
| A little about you helps us make your learning      |
| experience more relevant.                            |
|                                                      |
| What are you studying?                               |
| [ Computer Science v ]                               |
|                                                      |
| What level are you currently in?                     |
| [ 200 Level v ]                                      |
|                                                      |
| What are you interested in?                          |
| [x Software Engineering] [ Data Engineering ]        |
| [ Backend Engineering ]  [ Machine Learning ]        |
|                                      [ Continue ]     |
+------------------------------------------------------+
```

After Continue, the student goes directly to Home.

## 5. Home

Home is a continuation surface, not an analytics dashboard.

### 5.1 New student

A new student should immediately see two ways to begin:

``` text
What would you like to learn today?

[ Enter a concept... ]

Get started
[ + Add a course ]

Explore
[ Practice DSA ]
```

The student should not be forced to upload material before they can use
Learn.

Two supported routes are:

``` text
COURSE ROUTE
Create course
    |
Add material
    |
Discover concepts
    |
Learn
```

``` text
DIRECT ROUTE
Enter concept
    |
Learn immediately
```

### 5.2 Returning student

A returning student's Home should prioritize continuation:

``` text
Good morning, Chisom

Continue learning
[ Recursion / Computer Programming II / Continue ]

Recent concepts
[ Recursion ] [ Binary Trees ] [ Hash Maps ]

Your courses
Computer Programming II
Computer Architecture
[ + Add ]

Continue practising
Maximum Depth of Binary Tree
Binary Trees - In progress
[ Continue ]
```

Avoid streaks, XP, charts, meaningless statistics, or job feeds.

## 6. Learn

Learn supports both course-material learning and direct concept
learning.

``` text
                    LEARN
                      |
          +-----------+-----------+
          |                       |
      Course route            Direct route
          |                       |
     Add material             Enter concept
          |                       |
     Find concepts                 |
          +-----------+-----------+
                      |
                      v
                  CONCEPT
                      |
               Learn conversation
```

## 7. Courses

Courses are organizational spaces created by the student. They are not
imported from the Miva dashboard.

A course page should remain simple:

``` text
<- Courses

Computer Programming II

Materials

[ Lecture 03: Recursion.pdf
  4 concepts
  Open ]

[ Lecture 02: Functions.pdf
  3 concepts
  Open ]

[ + Add material ]
```

The course page is primarily for organization. It should not become
another AI chat screen.

## 8. Add Material

Initial supported material types are PDF and pasted notes/text.

``` text
Add material

[ Drop PDF here or choose file ]

or

[ Paste notes or text ]

[ Add material ]
```

After upload, show meaningful processing progress:

``` text
Lecture 03.pdf

[x] Uploaded
[o] Reading material...
[ ] Identifying important concepts
```

When complete:

``` text
Lecture 03.pdf

[x] Uploaded
[x] Material processed
[x] 4 important concepts identified

[ Start learning ]
```

Do not expose implementation language such as embeddings, chunking,
vector retrieval, or model pipelines.

## 9. Concept Discovery

After processing a material, do not automatically generate a large
summary. Surface a small set of important concepts.

``` text
Lecture 03: Recursion

We've identified 4 important concepts
from this material.

[ Recursion
  Functions that solve problems by calling themselves...
  Learn this -> ]

[ Base Cases
  The condition that stops recursive execution.
  Learn this -> ]

[ Call Stack
  How recursive calls are stored...
  Learn this -> ]

[ Recursive Trees
  Learn this -> ]
```

Descriptions should be grounded in the uploaded material.

## 10. Learn Conversation

The Learn conversation is the central learning interface.

It should communicate:

-   the current concept;
-   the material being used, when applicable;
-   a concise explanation;
-   source references;
-   natural follow-up conversation;
-   a few useful contextual actions.

Example:

``` text
+-------------------------------------------------------------+
| <- Computer Programming II                                  |
|                                                             |
| Recursion                                                   |
| Grounded in: Lecture 03: Recursion.pdf                      |
|                                                             |
| ----------------------------------------------------------- |
|                                                             |
| COMPANION                                                   |
|                                                             |
| Recursion is a technique where a function solves a          |
| problem by calling itself on a smaller version of the       |
| same problem.                                               |
|                                                             |
| Your lecture introduces two important parts:                |
|                                                             |
| * Recursive case                                            |
| * Base case                                                 |
|                                                             |
| Source: Lecture 03, page 4                                  |
|                                                             |
| [ Explain simply ]  [ Give an example ]                     |
| [ Check my understanding ]                                  |
|                                                             |
| ----------------------------------------------------------- |
|                                                             |
| You                                                         |
| Why do we need a base case?                                 |
|                                                             |
| COMPANION                                                   |
| Without a base case, the recursive calls would continue...  |
|                                                             |
| Source: Lecture 03, page 5                                  |
|                                                             |
| [ Ask a question...                                ] [Send] |
+-------------------------------------------------------------+
```

Do not turn every possible learning action into a separate page. Explain
simply, Give an example, and Check my understanding should remain within
the same conversation.

## 11. Grounded vs General Explanation

The interface must distinguish information derived from the student's
material from additional model knowledge.

When the answer is grounded:

``` text
From your course material
Lecture 03, page 5
```

When the companion goes beyond the material:

``` text
Additional explanation

Your course material explains how recursion works but
does not discuss many practical examples.

Recursion is also useful when a problem naturally
contains smaller versions of itself, such as traversing
trees or exploring directories.

This explanation goes beyond your uploaded material.
```

For direct learning without an upload:

``` text
Binary Trees

General explanation
No course material attached
```

The student should still receive a useful learning experience.

## 12. Source Inspection

Students must be able to inspect the material supporting a grounded
explanation.

``` text
Source: Lecture 03, page 5
                |
                v
+-----------------------------------------+
| From your material                      |
|                                         |
| Lecture 03: Recursion                   |
| Page 5                                  |
|                                         |
| [relevant extracted passage]            |
|                                         |
| [ Open material ]                       |
+-----------------------------------------+
```

The exact implementation may be a panel, modal, or compact detail view.
It should not require navigating through several screens.

## 13. Industry Evidence Inside Learn

Industry relevance is not a separate product area and is not part of the
Practice journey.

It appears during Learn when the student's material contains a concrete
job-relevant skill or technology and credible job-posting evidence
exists.

Examples may include SQL, Python, Docker, Git, AWS, PostgreSQL, Java, or
similar technologies, provided the evidence actually supports the term.

Example:

``` text
LEARN - Database Systems

Your lecture introduces relational databases and SQL.

SQL is used to query and manipulate data stored in
relational databases.

From your course material
Page 8

------------------------------------------------

Seen in industry

SQL also appears as a required skill in real
software engineering and data roles.

Data Engineer - Company A
"...experience with Python and SQL..."

[ View job posting -> ]

------------------------------------------------

Next, your lecture introduces normalization...
```

The job title, company, excerpt, and link shown above are illustrative
placeholders. Actual product content must come from retrieved evidence.

### 13.1 Do not manufacture industry mappings

Do not create unsupported chains such as:

``` text
Hash Maps
   |
Data Structures & Algorithms
   |
Generic software job
   |
Therefore this job uses Hash Maps
```

A posting that mentions "data structures and algorithms" supports that
exact phrase. It does not prove that the employer specifically requires
hash maps, arrays, recursion, or another narrower concept.

### 13.2 Evidence behavior

``` text
Course / learning material
          |
          v
Concepts and technologies identified
          |
          v
Does a concrete term have credible matches
in real job postings?
          |
       +--+--+
       |     |
      YES    NO
       |     |
       v     +----> Continue learning normally
Show evidence
inside Learn
```

Career interests may influence which valid evidence is ranked first.
They must never manufacture relevance.

### 13.3 No evidence vs retrieval failure

These are different states.

For an automatic contextual evidence check during Learn, a valid
no-evidence result should normally be silent: simply continue the
learning experience without showing an evidence card.

If the student explicitly initiates or retries an evidence check, the
interface may communicate the valid no-evidence result:

``` text
We didn't find enough evidence in the current
job postings to connect this skill reliably.
```

A technical retrieval failure is different and may offer recovery:

``` text
We couldn't check job evidence right now.

[ Try again ]
```

The interface must never present a retrieval failure as proof that no
evidence exists.

## 14. Contextual Transition to Practice

Practice should only be offered when the concept is appropriate for the
DSA practice system.

For example:

``` text
Binary Trees

[ learning conversation ]

-------------------------

Ready to practise?

Try problems that use Binary Trees.

[ Practice Binary Trees -> ]
```

A concept such as SQL should not receive a DSA Practice action merely
because it is a programming-related topic.

A concept where neither Practice nor industry evidence applies should
simply remain a learning conversation.

## 15. Practice

Practice is initially focused on Data Structures and Algorithms and uses
curated LeetCode problems.

It does not provide exercises for every programming concept.

There are two entry routes:

``` text
From Learn
Trees
   |
Practice this
   |
Trees problems
```

``` text
Directly
Practice
   |
Choose DSA topic
   |
Problems
```

When entering from Learn, the student should not have to select the
topic again.

## 16. Practice Landing Page

``` text
+------------------------------------------------------+
| Practice                                             |
|                                                      |
| Continue                                             |
|                                                      |
| Maximum Depth of Binary Tree                         |
| Trees - In progress                  [ Continue -> ]  |
|                                                      |
| Choose a DSA topic                                   |
|                                                      |
| [ Arrays ]       [ Hash Maps ]      [ Linked Lists ] |
| [ Stacks ]       [ Trees ]          [ Graphs ]       |
| [ Binary Search ][ Recursion ]      [ Sliding Window]|
| [ Two Pointers ] [ Dynamic Programming ]             |
+------------------------------------------------------+
```

A new student with no Practice history should see a short explanation
and topic choices rather than a blank state.

## 17. DSA Topic and Problem List

Selecting a topic should immediately show curated problems.

``` text
<- Practice

Trees

Curated LeetCode problems

Easy
o Maximum Depth of Binary Tree            [ Open -> ]
o Invert Binary Tree                      [ Open -> ]

Medium
o Binary Tree Level Order Traversal       [ Open -> ]
o Validate Binary Search Tree             [ Open -> ]
```

The product should store curated metadata such as concept, title,
difficulty, and original LeetCode link. It should not copy protected
LeetCode problem statements or test cases.

Selecting a problem should also create the Practice session so the
student does not need to configure it again after returning from
LeetCode.

## 18. Practice Coaching Session

The Practice session should remain one focused screen.

``` text
+------------------------------------------------------+
| <- Trees                                             |
|                                                      |
| Maximum Depth of Binary Tree                         |
| Easy - LeetCode                         [ Open -> ]   |
|                                                      |
| Assistance: [ Hands Off ] [ Coach x ] [ Tutor ]     |
|                                                      |
| ---------------------------------------------------  |
|                                                      |
| How can I help?                                      |
|                                                      |
| [ I'm stuck ]        [ My code has an error ]        |
| [ My test failed ]   [ Explain my approach ]         |
|                                                      |
| Or describe what you're struggling with:             |
|                                                      |
| [ Paste your code or ask a question...             ] |
|                                             [ Send ] |
+------------------------------------------------------+
```

The shortcuts save typing. They should not lead to separate tools or
pages.

Coach is the default assistance mode.

## 19. Coaching Assistance

Practice uses three assistance modes: **Hands Off**, **Coach**, and
**Tutor**. These are behavioral ceilings, not labels for a hidden
numerical hint ladder.

Coach is the default.

The authoritative behavior is:

  -----------------------------------------------------------------------
  Mode                    Volunteers up to        Answers up to
  ----------------------- ----------------------- -----------------------
  Hands Off               what it sees            a question to think
                                                  about

  Coach                   the idea by name        where the student's own
                                                  code or reasoning goes
                                                  wrong

  Tutor                   the steps               the answer, and only
                                                  when asked outright
  -----------------------------------------------------------------------

The selected mode controls the maximum help the companion may provide.
Changing the presentation format, such as asking for a walkthrough or
dry run, must not bypass the selected ceiling.

### 19.1 Progressive help

Within the selected mode, help may become more useful as the student
continues working, but the application must never exceed that mode's
ceiling.

Lilo can use automatic editor and run telemetry to determine when code
has changed. Miva Buddy does not have that telemetry in the MVP. It may
use only information available inside its own Practice session, such as:

-   code or reasoning the student pastes or edits;
-   a student-reported error or failed test;
-   an updated attempt supplied by the student;
-   the student's explicit question or request.

The application must never claim to know whether the student changed
code on LeetCode, ran a test, passed a submission, or spent a particular
amount of time unless the student explicitly supplied that information.

``` text
Student supplies an attempt or question
              |
              v
Application reads selected assistance mode
and existing Practice session state
              |
              v
Software determines the maximum allowed help
              |
              v
Companion generates a candidate response
              |
              v
Response is checked against the allowed ceiling
              |
              v
Accepted response is shown and state is updated
```

Important coaching limits should be enforced by application logic and
validation rather than relying only on the model prompt.

### 19.2 Hands Off

Hands Off provides the least intervention.

It may volunteer what it observes from the student's supplied attempt
and respond with a question that helps the student think.

It should not name the solution idea merely to move the student forward,
provide implementation steps, pseudocode, or reveal the complete
solution.

### 19.3 Coach

Coach is the default middle ground.

It may volunteer the relevant idea by name. When the student asks for
help with their own supplied code or reasoning, it may explain where
that attempt goes wrong.

It should not provide the complete answer or cross into Tutor behavior.

If a student in Coach explicitly asks for the full solution, the
interface may offer a simple way to switch to Tutor rather than silently
violating the selected mode.

### 19.4 Tutor

Tutor provides the strongest teaching support.

It may volunteer the steps needed to solve the problem. A complete
answer is permitted only when the student explicitly asks for it.

Selecting Tutor by itself does not mean the companion should immediately
reveal the answer.

### 19.5 Walkthroughs and dry runs

A walkthrough, trace, diagram, or dry run is another presentation form
of assistance, not a way around the coaching policy.

The same Hands Off, Coach, or Tutor ceiling applies to what the
walkthrough is allowed to reveal.

### 19.6 Validation behavior

The companion's generated coaching response is a candidate response
until it passes the relevant checks.

If a candidate exceeds the selected mode or refers to code details that
the student did not provide, it should not be shown as-is. The system
may retry once under a stricter instruction. If the retry still violates
the policy, the response should be dropped and the student should
receive a recoverable failure rather than stronger help than they
selected.

The detailed enforcement mechanism belongs in the AI / Retrieval /
Safeguards specification and technical architecture.

## 20. Errors and Failed Tests in Practice

Debugging remains inside the same Practice conversation.

If essential information is missing, ask only for what is needed.

Do not require a long form containing programming language, expected
result, actual result, error, code, assistance level, and problem when
the system already knows most of that context.

## 21. Completing Practice

Without a browser extension, the product cannot truthfully know whether
LeetCode accepted the student's solution.

Use a simple manual action:

``` text
[ Mark as completed ]
```

After completion:

``` text
Nice work.

[ Next Trees problem ]     [ Back to Trees ]
```

The student should not have to navigate back through Home and Practice
to reach the next problem.

## 22. Profile and Settings

Profile and Settings should remain small.

``` text
+------------------------------------------------------+
| Profile                                              |
|                                                      |
| Study                                                |
| Programme        Computer Science          [ Edit ]  |
| Level            200 Level                 [ Edit ]  |
|                                                      |
| Career interests                                     |
| Software Engineering                                 |
| Data Engineering                           [ Edit ]  |
|                                                      |
| Saved profile                                        |
| Saved privately in this browser                     |
| Clearing browser data may remove access to this      |
| profile. Cross-device recovery is not available yet. |
+------------------------------------------------------+
```

Do not show email/password fields, sign-in/sign-up links, verification prompts, password recovery, or a sign-out control in the MVP. Supabase anonymous identity is established behind the scenes when the student saves onboarding; it is not an authentication screen or a user-facing ceremony.

Do not expose model provider, API key, temperature, prompt, retrieval,
or infrastructure settings to students.

## 23. Responsive and Mobile Behavior

The application is web-first and must remain usable on desktop, tablet,
and mobile.

Desktop can use a sidebar:

``` text
+--------------+--------------------------------------+
|              |                                      |
| Home         |                                      |
| Learn        |          Current screen              |
| Practice     |                                      |
|              |                                      |
|              |                                      |
| Profile      |                                      |
+--------------+--------------------------------------+
```

Mobile can use compact bottom navigation:

``` text
+--------------------------+
|                          |
|      Current screen      |
|                          |
|                          |
|                          |
+--------------------------+
| Home   Learn   Practice  |
+--------------------------+
```

Profile can be accessed through a profile/avatar control.

Mobile requirements:

-   readable text;
-   touch-friendly controls;
-   no hover-only actions;
-   no required horizontal scrolling;
-   learning and Practice flows fully usable on a phone;
-   source inspection should not require a complex split-screen PDF
    interface.

## 24. Loading States

Loading states should describe what the student needs to know without
exposing technical implementation.

Examples:

``` text
Companion is thinking...
```

and:

``` text
Lecture 03.pdf

[x] Uploaded
[o] Reading material...
[ ] Identifying important concepts
```

## 25. Empty States

Empty screens should always provide an obvious next action.

Learn:

``` text
Learn

What would you like to learn?

[ Enter a concept... ]

or

Learn from your course material

[ + Create a course ]
```

Practice:

``` text
Practice

Practise Data Structures and Algorithms
with guidance that adapts to how much
help you want.

Choose a topic to get started.

[ Arrays ] [ Hash Maps ] [ Trees ]
[ Graphs ] [ Recursion ] [...]
```

## 26. Error and Recovery States

Errors should explain what happened in simple language and offer a
direct recovery action.

Unreadable material:

``` text
We couldn't read this material.

You can try uploading the PDF again or
paste the relevant notes instead.

[ Try again ]    [ Paste notes ]
```

AI generation failure:

``` text
I couldn't generate a response just now.

[ Try again ]
```

The product should not expose raw stack traces, provider errors, or
infrastructure details to the student.

## 27. Navigation and Back Behavior

Back behavior should respect how the student arrived.

Course route:

``` text
Home
  |
Computer Programming II
  |
Lecture 03
  |
Recursion
```

Back returns through the same context.

Direct route:

``` text
Learn
  |
Teach me recursion
  |
Recursion
```

Back returns to Learn.

Avoid routing students through Home unnecessarily.

## 28. Screen Inventory

The core interface consists of:

1.  Onboarding
2.  Home
3.  Learn
4.  Course
5.  Add Material
6.  Material / Concept Discovery
7.  Concept Learning Conversation
8.  Practice
9.  DSA Topic / Problem List
10. Practice Coaching Session
11. Profile / Settings

Supporting lightweight views include:

-   source inspection;
-   job-posting evidence detail;
-   loading and processing states;
-   empty states;
-   error and recovery states.

These supporting views should not become major navigation destinations.

## 29. Complete Student Experience

The student should experience the product as something much simpler than
its internal architecture:

``` text
I want to learn something.
        |
        v
Companion helps me understand it.
        |
        v
If useful:
* I see that a concrete skill appears in real jobs.
* I can practise a relevant DSA concept.
```

The product should feel like a continuous companion rather than a
collection of disconnected AI tools.

## 30. UX Decisions Locked by This Specification

-   Web-first, responsive experience.
-   Primary navigation: Home, Learn, Courses, Practice, with Profile/Settings separate (V1 refinement).
-   No standalone Industry navigation or Industry journey.
-   Industry evidence appears inside Learn only when supported by real
    job-posting evidence.
-   Practice is DSA-specific and remains focused on problem solving and
    coaching.
-   No required Chrome extension.
-   No built-in LeetCode replacement or code editor in the initial
    product.
-   Course spaces are created by students and organize their learning
    materials.
-   Learn works both with uploaded material and without an upload.
-   Grounded information and additional explanation are visibly
    distinguished.
-   Students can inspect supporting source material.
-   Contextual actions stay within the current experience where
    possible.
-   Coach is the default Practice assistance mode.
-   Hands Off, Coach, and Tutor are behavioral ceilings; there is no
    numerical assistance ladder.
-   Assistance ceilings and progressive-help rules are enforced
    underneath the conversation rather than through repeated hint
    buttons.
-   Practice completion is manually confirmed unless a future legitimate
    integration can verify it.
-   Career interests rank valid job evidence but do not create industry
    relevance.
-   The interface should never ask students to repeat context the
    application already knows.
-   Simplicity and low interaction cost take priority over adding extra
    screens or controls.
