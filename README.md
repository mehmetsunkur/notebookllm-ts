# notebooklm-ts

> **TypeScript port of [notebooklm-py](https://github.com/teng-lin/notebooklm-py) by [teng-lin](https://github.com/teng-lin).**
> All credit for the original reverse-engineering of the Google NotebookLM API, protocol research, and feature design belongs to the original author.
> If you use Python, use the original project: **https://github.com/teng-lin/notebooklm-py**

---

**Comprehensive TypeScript CLI and API for Google NotebookLM.**
Full programmatic access to NotebookLM's features—including capabilities the web UI doesn't expose—from TypeScript/JavaScript or the command line.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/runtime-Bun-black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

> **⚠️ Unofficial Library — Use at Your Own Risk**
>
> This library uses **undocumented Google APIs** that can change without notice.
>
> - **Not affiliated with Google** — This is a community project
> - **APIs may break** — Google can change internal endpoints at any time
> - **Rate limits apply** — Heavy usage may be throttled

---

## What You Can Build

**AI Agent Tools** — Integrate NotebookLM into LLM agents and automation pipelines using the TypeScript API.

**Research Automation** — Bulk-import sources (URLs, PDFs, YouTube, Google Drive), run web research queries with auto-import, and extract insights programmatically.

**Content Generation** — Generate Audio Overviews (podcasts), videos, slide decks, quizzes, flashcards, infographics, data tables, mind maps, and reports.

**Downloads & Export** — Download all generated artifacts locally (MP3, MP4, PDF, PNG, CSV, JSON, Markdown). Features the web UI doesn't offer: batch downloads, quiz/flashcard export in multiple formats, mind map JSON extraction.

---

## Three Ways to Use

| Method | Best For |
|--------|----------|
| **TypeScript API** | Application integration, async workflows, custom pipelines |
| **CLI** | Shell scripts, quick tasks, CI/CD automation |
| **Bun binary** | Standalone binary with no runtime dependency |

---

## Features

### Complete NotebookLM Coverage

| Category | Capabilities |
|----------|--------------|
| **Notebooks** | Create, list, rename, delete, summary |
| **Sources** | URLs, files (PDF, text, Markdown, Word, audio, video), Google Drive, pasted text, research queries; refresh, fulltext, guide |
| **Chat** | Questions, conversation history, custom personas, save to notes |
| **Research** | Web research agents with auto-import, status polling |
| **Sharing** | Public/private links, user permissions (viewer/commenter/editor), view-level control |

### Content Generation (All NotebookLM Studio Types)

| Type | Options | Download Format |
|------|---------|-----------------|
| **Audio Overview** | Format, length, language | MP3 |
| **Video Overview** | Format, style | MP4 |
| **Slide Deck** | Format, length; individual slide revision | PDF, PPTX |
| **Infographic** | Orientation, detail level | PNG |
| **Quiz** | Quantity, difficulty | JSON, Markdown, HTML |
| **Flashcards** | Quantity, difficulty | JSON, Markdown, HTML |
| **Report** | Format, append mode | Markdown, PDF |
| **Data Table** | Custom structure via natural language | CSV |
| **Mind Map** | Interactive hierarchical visualization | JSON |

### Beyond the Web UI

- **Batch downloads** — Download all artifacts of a type at once
- **Quiz/Flashcard export** — Structured JSON, Markdown, or HTML
- **Mind map data extraction** — Export hierarchical JSON
- **Data table CSV export** — Download structured tables as spreadsheets
- **Slide deck as PPTX** — Editable PowerPoint (web UI offers PDF only)
- **Slide revision** — Modify individual slides with natural-language prompts
- **Source fulltext access** — Retrieve indexed text content of any source
- **Programmatic sharing** — Manage permissions without the UI
- **Save chat to notes** — Save Q&A answers as notebook notes

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.0

```bash
curl -fsSL https://bun.sh/install | bash
```

### From Source

```bash
git clone https://github.com/mehmetsunkur/notebookllm-ts.git
cd notebookllm-ts
bun install
```

Run directly with Bun:

```bash
bun run src/cli/index.ts --help
```

### Standalone Binary

Build a single executable with no runtime dependency:

```bash
bun build --compile src/cli/index.ts --outfile notebooklm
./notebooklm --help
```

### Browser Login Support

Playwright is included in dependencies. Install the browser:

```bash
bunx playwright install chromium
```

---

## Quick Start

### 1. Authenticate

```bash
notebooklm login
# Opens a Chromium browser — sign in with your Google account
# Session is saved to ~/.notebookllm-ts/storage_state.json
```

### 2. Create a Notebook and Add Sources

```bash
notebooklm create "My Research"
notebooklm use <notebook_id>

notebooklm source add "https://en.wikipedia.org/wiki/Artificial_intelligence"
notebooklm source add "./paper.pdf"
notebooklm source add "https://www.youtube.com/watch?v=..."
```

### 3. Chat with Your Sources

```bash
notebooklm ask "What are the key themes?"
notebooklm history
```

### 4. Generate Content

```bash
notebooklm generate audio "make it engaging" --wait
notebooklm generate video --style whiteboard --wait
notebooklm generate quiz --difficulty hard --wait
notebooklm generate flashcards --quantity 20 --wait
notebooklm generate slide-deck --wait
notebooklm generate infographic --orientation portrait --wait
notebooklm generate mind-map --wait
notebooklm generate data-table "compare key concepts" --wait
notebooklm generate report --wait
```

### 5. Download Artifacts

```bash
notebooklm download audio ./podcast.mp3
notebooklm download video ./overview.mp4
notebooklm download quiz --format markdown ./quiz.md
notebooklm download flashcards --format json ./cards.json
notebooklm download slide-deck ./slides.pdf
notebooklm download mind-map ./mindmap.json
notebooklm download data-table ./data.csv
```

---

## TypeScript API

```typescript
import { NotebookLMClient } from "notebooklm-ts";

const client = new NotebookLMClient();

// Create notebook and add sources
const notebook = await client.notebooks.create("My Research");
await client.sources.addUrl(notebook.id, "https://example.com");
await client.sources.addFile(notebook.id, "./paper.pdf");

// Chat with your sources
const response = await client.chat.ask(notebook.id, "Summarize this");
console.log(response.answer);

// Generate an audio overview and wait for it
const task = await client.generate.generateAudio(notebook.id, {
  description: "make it engaging",
  wait: true,
});

// Download
const audio = await client.artifacts.download(notebook.id, task.artifactId!);
await Bun.write("podcast.mp3", audio);

// Generate quiz and export as JSON
await client.generate.generateQuiz(notebook.id, {
  difficulty: "hard",
  quantity: 20,
  wait: true,
});
```

### Client Options

```typescript
const client = new NotebookLMClient({
  // Override auth storage location
  storagePath: "/path/to/storage_state.json",
  // Override home directory
  homeDir: "/path/to/.notebookllm-ts",
  // Language for generated content
  language: "en",
  // Enable verbose RPC logging
  verbose: true,
});
```

---

## CLI Reference

### Session

```bash
notebooklm login                     # Browser login
notebooklm use <id>                  # Set active notebook (partial ID match)
notebooklm status [--paths] [--json] # Show current context
notebooklm clear                     # Clear active notebook
notebooklm auth check [--test]       # Validate auth setup
```

### Notebooks

```bash
notebooklm list                      # List all notebooks
notebooklm create <title>            # Create notebook
notebooklm delete <id>               # Delete notebook
notebooklm rename <title>            # Rename active notebook
notebooklm summary                   # AI summary of active notebook
```

### Sources

```bash
notebooklm source list
notebooklm source add <url|file|text>
notebooklm source add-drive <id> <title>
notebooklm source add-research <query> [--mode] [--import-all]
notebooklm source get <id>
notebooklm source fulltext <id>
notebooklm source guide <id>
notebooklm source rename <id> <title>
notebooklm source refresh <id>
notebooklm source delete <id>
notebooklm source wait <id>
```

### Chat

```bash
notebooklm ask <question> [-s <source>] [--save-as-note]
notebooklm history [--clear] [--save]
notebooklm configure --mode <mode>
```

### Generate

All generate commands support: `-s/--source`, `--language`, `--wait`, `--retry`, `--json`

```bash
notebooklm generate audio [desc] [--format] [--length]
notebooklm generate video [desc] [--format] [--style]
notebooklm generate slide-deck [desc] [--format] [--length]
notebooklm generate revise-slide <desc> --artifact <id> --slide <n>
notebooklm generate quiz [desc] [--difficulty] [--quantity]
notebooklm generate flashcards [desc] [--difficulty] [--quantity]
notebooklm generate infographic [desc] [--orientation] [--detail]
notebooklm generate data-table <desc>
notebooklm generate mind-map
notebooklm generate report [desc] [--format] [--append]
```

### Download

```bash
notebooklm download audio|video|slide-deck|infographic|report|mind-map|data-table [path]
  [--all] [--latest] [--earliest] [--name <pattern>] [-a <artifact-id>]
  [--dry-run] [--force] [--format <ext>]

notebooklm download quiz|flashcards [path] [--format json|markdown|html]
```

### Artifacts

```bash
notebooklm artifact list [--type]
notebooklm artifact get <id>
notebooklm artifact rename <id> <title>
notebooklm artifact delete <id>
notebooklm artifact export <id> [--type] [--title]
notebooklm artifact poll <task_id>
notebooklm artifact wait <id> [--timeout] [--interval]
notebooklm artifact suggestions [-s <source>]
```

### Notes

```bash
notebooklm note list
notebooklm note create <content>
notebooklm note get <id>
notebooklm note rename <id> <title>
notebooklm note delete <id>
notebooklm note save <id> <content>
```

### Research

```bash
notebooklm research status
notebooklm research wait [--timeout] [--import-all]
```

### Language

```bash
notebooklm language list
notebooklm language get [--local]
notebooklm language set <code> [--local]
```

### Sharing

```bash
notebooklm share status
notebooklm share public [--enable|--disable]
notebooklm share view-level <view|comment|edit>
notebooklm share add <email> [--permission] [--no-notify]
notebooklm share update <email> --permission <level>
notebooklm share remove <email>
```

---

## Configuration

| Item | Default | Override |
|------|---------|---------|
| Home directory | `~/.notebookllm-ts/` | `NOTEBOOKLLM_TS_HOME` env var or `--storage` flag |
| Auth storage | `~/.notebookllm-ts/storage_state.json` | `NOTEBOOKLLM_TS_AUTH_JSON` (inline JSON for CI/CD) |
| Active context | `~/.notebookllm-ts/context.json` | — |
| Local config | `~/.notebookllm-ts/config.json` | — |

### CI/CD Usage

Pass your Playwright storage state as an environment variable:

```bash
export NOTEBOOKLLM_TS_AUTH_JSON='{"cookies":[...]}'
notebooklm list
```

### Reusing Python Session

If you already use `notebooklm-py`, you can copy the session file:

```bash
cp ~/.notebooklm/storage_state.json ~/.notebookllm-ts/storage_state.json
```

---

## Platform Support

| Platform | Status |
|----------|--------|
| **macOS** | ✅ Supported |
| **Linux** | ✅ Supported |
| **Windows** | Should work (untested) |

---

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Run CLI in dev mode (no compile step)
bun run src/cli/index.ts --help

# Build standalone binary
bun build --compile src/cli/index.ts --outfile notebooklm
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
