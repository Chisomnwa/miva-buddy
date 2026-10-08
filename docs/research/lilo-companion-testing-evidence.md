# Lilo Companion Testing Handoff — Empirical Reference Evidence

> **Classification:** Observations from hands-on testing of Lilo Companion, recorded October 7, 2026. This is empirical reference-product evidence, not a Miva Buddy product specification, implementation instruction, provider approval, or authorization to copy Lilo's interface/content/code. Miva Buddy's approved product and architecture documents remain authoritative.

# Lilo Companion Testing Handoff
**Purpose:** This is a handoff document for another project/chat that needs the results of the completed Lilo Companion investigation without repeating the setup and testing from the beginning.
**Status:** Major Lilo behaviors have been tested successfully
**Date:** October 7, 2026
## 1. What was being investigated
Lilo Companion was used as a reference product to understand how a persistent AI learning companion can support:
lecture learning;
industry evidence;
LeetCode/DSA coaching;
voice input;
interview preparation;
model-provider configuration;
deterministic validation around AI output.
The goal of the testing was to understand the actual behavior of the product, not merely read its README or watch its demo.
## 2. Local application setup
The Lilo repository was cloned and run locally on macOS.
Main development commands used:
`npm install
node node_modules/electron/install.js
npm run dev`
For model debugging:
`LILO_DEBUG_LLM=1 npm run dev`
The Electron/Vite application launched successfully.
Observed desktop surfaces included:
a persistent floating Lilo mark/blob;
a macOS menu-bar control;
the main companion panel;
a separate Settings window.
The panel is the main interaction surface and behaves like one continuous companion conversation rather than a conventional multi-page student dashboard.
## 3. Important desktop UX observed
### Floating companion
A small persistent mark sits near the bottom-right of the desktop. It can open the companion panel.
### Menu-bar controls
The macOS menu-bar control exposed actions such as:
Upload a lecture
Open the panel
Click through empty space
Settings
End session and forget transcript
Show saved data
Quit
### Main panel
The panel includes top-level controls for:
Upload a lecture
LeetCode On
Voice On
Settings
The same conversation thread can move between lecture questions, LeetCode coaching, voice input, and interview preparation.
This is an important product lesson: the conversation itself performs much of the navigation.
## 4. Settings behavior observed
The Settings window included areas for:
### Profile
### Model
### LeetCode
### Advanced/storage
### Profile
Profile information included what the student is studying, year, career direction, normalized industry categories, and concepts already encountered.
### Model
The application supports configurable model endpoints, API keys, a Quick model, a Careful model, and a separate voice endpoint/model.
### LeetCode
The user can choose an assistance ceiling such as:
Hands off
Coach
Tutor
The Chrome extension/native bridge is configured here.
### Advanced/storage
The application exposes local storage/security information and a reset/forget-everything path.
## 5. Initial local model setup
Ollama was installed and tested.
Model downloaded:
`ollama pull qwen2.5-coder:7b`
Direct test:
`ollama run qwen2.5-coder:7b`
The model responded normally outside Lilo.
Initial Lilo model configuration:
Endpoint:
http://localhost:11434

Quick:
qwen2.5-coder:7b

Careful:
qwen2.5-coder:7b
Lilo's connection test succeeded.
## 6. Voice setup
Voice was configured locally rather than using a paid transcription API.
Docker Desktop was available, and a Speaches server was started:
`docker run --rm -d   --name speaches   -p 8000:8000   -v speaches-hf-cache:/home/ubuntu/.cache/huggingface/hub   ghcr.io/speaches-ai/speaches:latest-cpu`
The Faster-Whisper model was downloaded:
`curl -X POST   "http://localhost:8000/v1/models/Systran/faster-whisper-small.en"`
The model list confirmed:
`Systran/faster-whisper-small.en`
Lilo voice configuration:
Voice endpoint:
http://localhost:8000

Voice model:
Systran/faster-whisper-small.en
### Voice test result
Voice worked.
The user could:
click the microphone;
speak;
stop recording;
see the transcription appear in Lilo's composer.
Therefore microphone -> transcription -> composer was successfully verified.
## 7. Chrome/LeetCode integration setup and result
The Lilo Chrome extension/native bridge was configured through the LeetCode settings.
The working behavior confirmed that Lilo could automatically detect:
the open LeetCode problem;
difficulty;
programming language;
editor/code state;
recent code changes;
selected coaching level.
After restarting Lilo, it could reconnect and pick up the already-open LeetCode problem without the user re-entering the problem manually.
This integration was successfully verified.
## 8. The Qwen structured-output failure
Although Qwen worked as a raw chatbot, Lilo's structured flows repeatedly failed.
Observed validation errors included:
expected: "number"
path: ["rung"]
expected: "array"
path: ["lines"]
expected: "string"
path: ["say"]
Running:
`LILO_DEBUG_LLM=1 npm run dev`
showed that Qwen was receiving prompts and generating meaningful natural-language responses. The failure occurred because the generated response did not reliably match Lilo's required structured schema.
### What this ruled out
The problem was not:
the microphone;
voice transcription;
the Chrome extension;
failure to detect LeetCode;
inability of Qwen to understand the programming question;
incorrect use of the Walk me through it button.
The main issue was model/application structured-output compatibility.
## 9. Hosted-model research
To avoid being blocked by the local model, free hosted API options were researched.
Discovery sources:
`https://github.com/mnfst/awesome-free-llm-apis`
`https://www.reddit.com/r/FluentMac/comments/1s43g39/best_10_free_ai_model_providers_with_api_key/`
Providers considered included Groq, Gemini, Mistral, OpenRouter, Cloudflare Workers AI, and Hugging Face.
Groq was initially selected as a promising OpenAI-compatible provider, but account sign-in was hanging during this testing session.
A Gemini API key was then created successfully.
## 10. Final working reasoning-model setup
Gemini was connected through its OpenAI-compatible endpoint:
`https://generativelanguage.googleapis.com/v1beta/openai/`
The earlier Gemini 2.5 model choices did not work in this environment.
The exact models that ultimately worked were:
Quick model:
models/gemini-3.5-flash-lite
Careful model:
models/gemini-3.1-flash-lite
The voice setup remained local:
Voice endpoint:
http://localhost:8000

Voice model:
Systran/faster-whisper-small.en
Do not replace these exact IDs with remembered model display names when documenting the tested configuration.
## 11. Successful lecture test
An Advanced Object-Oriented Programming PDF was uploaded.
Observed behavior:
Lilo read the lecture.
It identified relevant material/concepts.
It connected the lecture material to industry terminology.
It surfaced real job-posting evidence.
The UI displayed evidence associated with companies/postings.
It also tracked concepts the student had encountered.
This verified the core lecture -> concept -> industry evidence experience.
## 12. Successful LeetCode test
The open problem was Longest Repeating Character Replacement.
With Gemini configured, Lilo successfully produced the structured coaching UI that had failed under Qwen.
Observed behavior included:
automatic problem/editor awareness;
Coach mode;
comments about where the student's current work goes wrong;
Walk me through it;
an interactive dry-run visualization/table;
step controls;
variables such as i, j, current_length, max_freq, and replacements_needed;
references to the student's actual code/line context.
This reproduced the important behavior seen in the creators' demo.
## 13. Successful voice + reasoning test
After Gemini was configured, voice was tested again.
The user spoke a question asking how to explain object-oriented programming in one sentence.
The complete flow worked:
Microphone
  -> local Speaches/Faster-Whisper
  -> transcript
  -> Lilo
  -> Gemini
  -> validated response
  -> panel UI
No previous schema error occurred.
## 14. Successful interview test
The user typed:
I have an onsite interview with JP Morgan Chase.
Lilo recognized the intent without requiring a separate Interview page.
It responded that it was reading what people had written about interviewing at JP Morgan, then produced an evidence-grounded summary of the process.
Observed behavior included:
recruiter/process information;
coding/online-assessment information;
technical-round information;
system-design/interview themes;
multiple source/evidence chips;
freshness information about the newest retrieved account.
This verified the major interview-retrieval experience.
## 15. Major product behaviors now verified
The investigation has successfully observed or tested:
desktop floating companion;
menu-bar controls;
companion panel;
Settings window;
profile/personalization;
model-provider configuration;
local Ollama integration;
hosted Gemini integration;
local voice transcription;
PDF lecture upload;
lecture concept processing;
industry/job-posting evidence;
Chrome/LeetCode connection;
automatic problem/editor awareness;
assistance ceiling/Coach mode;
structured LeetCode coaching;
interactive dry-run tables;
typed questions;
voice questions;
interview-intent detection;
interview evidence retrieval/presentation;
schema rejection when a model returns an incompatible structure.
This is enough to avoid repeating the entire Lilo investigation in another project/chat unless a specific untested behavior becomes necessary.
## 16. Key product lessons
### One companion, not many disconnected tools
Lecture, LeetCode, voice, industry evidence, and interview preparation can all occur through the same persistent conversation.
### AI reasoning and deterministic software have different jobs
The model can explain and reason, but important application rules should be validated/enforced by software.
### Evidence should remain visible
Industry and interview claims are more trustworthy when the application exposes the supporting sources rather than presenting unsupported AI claims.
### Assistance levels matter
Programming help should have explicit ceilings so the system can coach without automatically doing the student's work.
### Model compatibility is an architectural concern
A provider/model should not be labeled supported merely because the endpoint responds. It must be tested against the product's real structured-output contracts.
### Local and hosted providers can coexist
Local models are useful for privacy/offline/cost goals. Hosted models can provide stronger reliability for demanding structured workflows. A provider boundary allows both.
## 17. Current known-good configuration
Lilo application:
Electron desktop app

Reasoning endpoint:
https://generativelanguage.googleapis.com/v1beta/openai/

Quick model:
models/gemini-3.5-flash-lite

Careful model:
models/gemini-3.1-flash-lite

Voice endpoint:
http://localhost:8000

Voice model:
Systran/faster-whisper-small.en

LeetCode:
Chrome extension/native bridge connected

Observed successful workflows:
Lecture + industry evidence
LeetCode structured walkthrough
Voice Q&A
Interview evidence retrieval
## 18. What should not be repeated unnecessarily
For a web version or another implementation inspired by Lilo, there is no need to restart by asking whether the basic Lilo behaviors work. They have already been tested.
Instead, use these results as evidence and move directly to architecture/product decisions such as:
which Lilo behaviors should be preserved;
how a web version changes the persistent-companion experience;
how LeetCode context will be obtained on the web;
which deterministic safeguards must remain;
how provider/model configuration will work;
how evidence and citations will be stored and displayed;
which features belong in the MVP.
A web implementation may require different technical mechanisms, but it should not erase the behavioral lessons already verified here.
## 19. Security and reproducibility notes
Never paste API keys into chat.
Never commit API keys to Git.
Do not include keys in screenshots or documentation.
Record exact model IDs and endpoint formats.
When debugging, change one variable at a time.
Keep debug logs for schema/provider failures.
Recheck hosted-model availability and free-tier rules because they can change.
## 20. Reference links
### Discovery sources used during model research
`https://github.com/mnfst/awesome-free-llm-apis`
`https://www.reddit.com/r/FluentMac/comments/1s43g39/best_10_free_ai_model_providers_with_api_key/`
### Useful provider documentation
Gemini API: https://ai.google.dev/gemini-api/docs
Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
Groq docs: https://console.groq.com/docs
───────────────────────────────────────────────────────
### Handoff summary
Do not restart the Lilo testing process.
The important result is:
Lilo's major learning, LeetCode, voice, industry-evidence, and interview behaviors were successfully tested. The local Qwen 2.5 Coder 7B setup failed Lilo's structured-output contracts, while the tested Gemini configuration succeeded. Use the verified behavior above as the starting point for the next product/architecture discussion.
