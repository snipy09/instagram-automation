# Instagram AutoPilot

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Engine](https://img.shields.io/badge/Engine-Playwright-green.svg)](https://playwright.dev/)
[![Server](https://img.shields.io/badge/Server-Express-black.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

Headless, stealth Instagram automation daemon with AI-driven engagement, strict niche filtering, anti-ban safety limits, and a real-time local monitoring dashboard.

---

## Overview

Instagram AutoPilot automates interaction workflows on Instagram using a persistent, stealth Chromium browser session. It explores target hashtags, evaluates post relevance against custom business context using LLMs, drafts contextual non-generic comments and direct message responses, and enforces strict rate quotas and sleep intervals to emulate natural human browsing patterns.

---

## Features

| Category | Capability |
| --- | --- |
| Browser Engine | Persistent session storage, headless execution, anti-detection flags (`navigator.webdriver` removal, spoofed Chrome fingerprints). |
| AI Engagement | Multi-provider LLM integration (OpenClaw, OpenAI, Google Gemini, OpenRouter, Ollama) generating short, contextual comments and direct message replies. |
| Strict Relevance Filter | Contextual analysis that checks post captions and profiles against business domain descriptions before initiating engagement. |
| Anti-Ban Safeguards | Configurable safety profiles (`safe`, `balanced`, `active`), hourly and daily action caps, randomized action jitter, and sleep-cycle scheduling. |
| Interaction Tracking | Deduplication engine tracking post IDs to prevent repeated interactions on previously engaged media. |
| Live Dashboard | Web-based telemetry interface (Express + Tailwind CSS) providing live quota progress, system configuration, and streaming logs. |
| Cross-Platform Control | Dedicated Windows batch runners (`.bat`) and standardized `npm` CLI commands for Linux and macOS environments. |

---

## Architecture

```
[Target Hashtag Feed] / [Direct Messages]
          │
          ▼
┌────────────────────────────────────────────────────────┐
│               Stealth Browser Engine                   │
│        (Playwright Extra + Stealth Plugin)             │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│            Strict Relevance Filter (AI)                │
│    Compares post context against account persona       │
└─────────────────────────┬──────────────────────────────┘
             │ YES                                │ NO
             ▼                                    ▼
┌─────────────────────────┐               ┌──────────────┐
│ Contextual Generation   │               │ Skip & Next  │
│ (OpenClaw/OpenAI/Gemini)│               └──────────────┘
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│               Anti-Ban Safety Controller               │
│   - Action Quota Verification (Likes / Comments / DMs) │
│   - Humanized Keystrokes & Random Delays               │
│   - Sleep Schedule Enforcement                         │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│          Telemetry & Storage (data/stats.json)         │
│          Live Web Dashboard (http://localhost:3456)    │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
instagram-automation/
├── 1-Install.bat              # Windows dependency and browser setup
├── 2-Login.bat                # Interactive browser window for initial authentication
├── 3-Start-Bot.bat            # Launches daemon in background mode
├── 4-Stop-Bot.bat             # Process termination script for Node instances
├── 5-Dashboard.bat            # Serves telemetry web dashboard
├── .env.example               # Configuration template
├── package.json               # Package manifests and script definitions
├── tsconfig.json              # TypeScript compilation specifications
├── LICENSE                    # MIT License
├── src/
│   ├── index.ts               # Main daemon entrypoint and engagement loop
│   ├── login-helper.ts        # One-time interactive session initializer
│   ├── config.ts              # Configuration loader and profile limits
│   ├── ai/
│   │   └── brain.ts           # LLM connector and prompt pipelines
│   ├── engine/
│   │   ├── browser.ts         # Playwright Chromium launcher with stealth layers
│   │   └── humanizer.ts       # Jitter delays, humanized typing, and scroll simulation
│   ├── dashboard/
│   │   ├── standalone.ts      # Express backend for metrics and log streaming
│   │   └── public/
│   │       └── index.html     # Telemetry web UI
│   └── utils/
│       ├── logger.ts          # Formatted stdout and file persistence logger
│       └── storage.ts         # Quota tracking, post history, and daily rollover
└── data/                      # Generated runtime assets (gitignored)
    ├── browser_profile/       # Persistent Chromium cache and cookie store
    ├── app.log                # Rolling execution log file
    └── stats.json             # Daily action counters and history
```

---

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm (bundled with Node.js)
- Supported OS: Windows 10/11, macOS, or Linux

### 1. Installation

Clone the repository and install all dependencies including the Chromium browser binary:

```bash
git clone https://github.com/snipy09/instagram-automation.git
cd instagram-automation
npm install
npx playwright install chromium
```

*Windows one-click alternative: Double-click `1-Install.bat`.*

### 2. Configuration

Copy the example environment configuration file and adjust variables according to your requirements:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
AI_PROVIDER=openclaw
AI_API_KEY=your_api_key_here
AI_MODEL_NAME=gpt-4o-mini
TARGET_HASHTAGS=tech,coding,software,developer,startups
SAFETY_PROFILE=balanced
```

### 3. Session Initialization (One-Time Login)

Launch the interactive login browser to authenticate your Instagram account:

```bash
npm run login
```

*Windows one-click alternative: Double-click `2-Login.bat`.*

1. An interactive Chromium browser window will open to `https://www.instagram.com/`.
2. Enter your credentials and complete any two-factor verification steps.
3. Once the main home feed is visible, close the browser window.
4. Your authenticated session will be saved to `data/browser_profile/` for subsequent automated runs.

### 4. Build and Run the Automation Daemon

Compile TypeScript assets and start the background automation daemon:

```bash
npm run build
npm start
```

*Windows one-click alternative: Double-click `3-Start-Bot.bat`.*

To terminate running background processes:
- Press `Ctrl + C` in the running terminal, or run `4-Stop-Bot.bat` on Windows.

### 5. Launch Live Dashboard

Start the telemetry server to monitor active metrics, quotas, and logs:

```bash
npm run dashboard
```

*Windows one-click alternative: Double-click `5-Dashboard.bat`.*

Open your web browser and navigate to:
```
http://localhost:3456
```

---

## Configuration Reference

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `AI_PROVIDER` | string | `openclaw` | AI backend provider: `openclaw`, `openai`, `gemini`, `openrouter`, `ollama`, or `none`. |
| `AI_API_KEY` | string | `""` | API authentication key for the selected AI provider (not required for `none` or local `ollama`). |
| `AI_MODEL_NAME` | string | `gpt-4o-mini` | LLM model identifier (e.g. `gpt-4o-mini`, `gemini-2.0-flash`, `llama3.1`). |
| `AI_TONE_INSTRUCTION` | string | `Act as a friendly...` | Persona instruction guiding the tone and constraints of generated comments and messages. |
| `SAFETY_PROFILE` | string | `balanced` | Safety limit preset: `safe`, `balanced`, or `active`. |
| `SLEEP_START_HOUR` | number | `23` | Hour in 24h format (0-23) when daemon enters sleep mode. |
| `SLEEP_END_HOUR` | number | `8` | Hour in 24h format (0-23) when daemon resumes activity. |
| `TARGET_HASHTAGS` | string | `tech,coding,software...` | Comma-separated list of hashtag strings without the `#` symbol. |
| `ENABLE_AUTO_LIKE_FEED` | boolean | `true` | Enables liking posts within the main feed. |
| `ENABLE_AUTO_COMMENT_FEED` | boolean | `true` | Enables commenting on posts within the main feed. |
| `ENABLE_AUTO_LIKE_HASHTAGS` | boolean | `true` | Enables liking posts discovered through target hashtag exploration. |
| `ENABLE_AUTO_COMMENT_HASHTAGS` | boolean | `true` | Enables generating and publishing comments on hashtag posts. |
| `ENABLE_DM_AUTO_REPLY` | boolean | `true` | Enables automated responses to incoming direct messages. |
| `ACCOUNT_CONTEXT` | string | `""` | Text description of the business, brand, or account domain for relevance scoring. |
| `STRICT_RELEVANCE_CHECK` | boolean | `false` | When true, skips posts deemed unrelated to `ACCOUNT_CONTEXT` by the LLM. |
| `DASHBOARD_PORT` | number | `3456` | Local HTTP port used by the dashboard server. |

---

## Safety Profiles & Anti-Ban Specifications

The system applies safety controls to prevent account restrictions:

| Profile | Daily Likes | Hourly Likes | Daily Comments | Hourly Comments | Daily DMs | Hourly DMs | Action Cooldown (Jitter) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `safe` | 30 | 8 | 10 | 3 | 15 | 4 | 45 – 120 sec |
| `balanced` | 70 | 15 | 25 | 6 | 30 | 8 | 30 – 90 sec |
| `active` | 150 | 25 | 50 | 12 | 60 | 15 | 15 – 45 sec |

### Safety Engine Behaviors

- Randomized Delays: Every interaction step executes with non-deterministic gaussian delays.
- Humanized Input: Comment text is entered character-by-character with variable keystroke timings rather than instant DOM value assignment.
- Sleep Interval Simulation: Automated pausing during configured nighttime hours to mirror natural usage.
- Duplicate Filtering: Interacted post IDs are recorded in `data/stats.json` (bounded to the last 500 records) to prevent duplicate actions.

---

## Tech Stack

| Library / Tool | Role |
| --- | --- |
| TypeScript | Type-safe application development |
| Playwright | Headless browser automation framework |
| Playwright Extra | Plugin framework extending Playwright |
| Puppeteer Extra Stealth | Evasion techniques for automated browser fingerprint detection |
| Express | HTTP API server for dashboard metrics and log streaming |
| Axios | HTTP client for REST-based AI API providers |
| Chalk & Ora | Terminal styling and logging utilities |
| Tailwind CSS | Dashboard UI styling |

---

## Available Scripts

| Command | Action |
| --- | --- |
| `npm run build` | Compiles TypeScript source files into `dist/` and copies dashboard static assets. |
| `npm start` | Runs the compiled production daemon (`dist/index.js`). |
| `npm run dev` | Runs the daemon directly from source via `ts-node`. |
| `npm run login` | Opens an interactive Chromium browser for session authentication. |
| `npm run dashboard` | Starts the Express telemetry server on the configured port. |
| `npm run clean` | Removes the compiled `dist/` output directory. |

---

## Troubleshooting

| Symptom | Cause | Resolution |
| --- | --- | --- |
| `Account is NOT logged in` | No valid session data in `data/browser_profile/`. | Run `npm run login` (or `2-Login.bat`), sign in manually, and verify the feed before closing. |
| `AI request failed` | Invalid or missing API key, or insufficient credits. | Verify `AI_API_KEY` and `AI_PROVIDER` values in `.env`. Set `AI_PROVIDER=none` to test with fallback templates. |
| Playwright browser missing | Chromium binary was not downloaded during installation. | Run `npx playwright install chromium`. |
| Dashboard shows 0 stats | Bot daemon has not executed any operations or `data/stats.json` is uninitialized. | Start the bot daemon (`npm start` or `3-Start-Bot.bat`) alongside the dashboard. |
| Port in use error (`EADDRINUSE`) | Another process is listening on the default dashboard port. | Update `DASHBOARD_PORT` in `.env` to an alternate port (e.g. `3457`). |

---

## License

This project is licensed under the [MIT License](LICENSE).
