# claude-code-for-stream-deck

Stream Deck plugin for managing [Claude Code](https://claude.ai/code) sessions. Monitor session state, approve or deny permission requests, and control agents from hardware buttons.

> Fork of [paultyng/agentsd](https://github.com/paultyng/agentsd) with two changes:
>
> - Permission requests are held open for **24 hours** instead of 120 seconds before auto-denying, so pending requests survive long absences from your desk.
> - Hook registration is documented as an explicit **manual step** (`npm run hooks:install`). Nothing touches `~/.claude/settings.json` unless you run that command yourself.

<p align="center"><img src="docs/preview.png" alt="agentsd buttons on a Stream Deck" width="320"></p>

## Requirements

- **macOS 13+** (Windows support tracked separately; see issue for details)
- **Stream Deck app 6.6+** plus a [Stream Deck](https://www.elgato.com/stream-deck) device
- **Node.js 20+** — pinned exactly via [mise](https://mise.jdx.dev/) (`mise.toml`) if you use it, otherwise install it yourself
- **Claude Code** with [HTTP hooks](https://code.claude.com/docs/en/hooks-guide) support

## How it works

Claude Code HTTP hooks post events to a local server (`127.0.0.1:9200`). The plugin translates those events into session state on Stream Deck buttons and dials.

```
Claude Code hooks → HTTP server (:9200) → SessionManager → Stream Deck UI
```

`PermissionRequest` hooks hold the HTTP response open (up to 24 h) so you can approve or deny directly from a button press.

## Install

```sh
git clone https://github.com/msageha/claude-code-for-stream-deck.git && cd claude-code-for-stream-deck
```

This repo pins its toolchain (Node.js, [prek](https://github.com/j178/prek), actionlint, dprint) via
[mise](https://mise.jdx.dev/). Every `npm run <script>` in `package.json` has a matching `mise run <name>`
task (see `mise tasks` for the full list) — use whichever you prefer.

**With mise:**

```sh
mise install       # provisions Node.js, then runs `npm install` and registers git hooks (postinstall hook)
mise run link      # builds the plugin, then registers it with the Stream Deck app
```

**Without mise:**

```sh
npm install
npm run build
npm run link                 # register plugin with Stream Deck
```

`@elgato/cli` (providing the `streamdeck` CLI that `link`/`dev` shell out to) is a devDependency, so
`npm install` alone makes it available under `node_modules/.bin` — no separate global install needed.

After linking, restart the Stream Deck app. The actions appear under "Claude Code" in the action list.

### Register Claude Code hooks (manual step)

The plugin never modifies `~/.claude/settings.json` on its own. To start receiving
events from Claude Code, register the HTTP hooks explicitly:

```sh
npm run hooks:install        # add Claude Code HTTP hooks to ~/.claude/settings.json
# or: mise run hooks:install
```

Each registered hook is an entry of the form
`{ "type": "http", "url": "http://127.0.0.1:9200/hooks/<EventName>", "timeout": ... }`.
The `PermissionRequest` hook uses `timeout: 86400` (24 hours) so pending requests
survive long absences; all other hooks use short timeouts. Review the result by
opening `~/.claude/settings.json` after running the command.

To stop receiving events, remove the hooks just as explicitly:

```sh
npm run hooks:uninstall      # remove hooks from ~/.claude/settings.json
# or: mise run hooks:uninstall
```

> **Not the same as this repo's git hooks.** `.pre-commit-config.yaml` defines commit-time git hooks
> (formatting/linting), registered into `.git/hooks/pre-commit` by `prek install` — that's a completely
> separate mechanism from the Claude Code HTTP hooks above, despite the shared name. `prek install` runs
> automatically as part of `mise install` (see `mise.toml`'s `postinstall` hook); it's unrelated to
> `npm run hooks:install`/`hooks:uninstall`, which only ever touch `~/.claude/settings.json`.

### Uninstall

```sh
npm run hooks:uninstall      # remove hooks from ~/.claude/settings.json
npm run unlink               # unregister plugin
# or: mise run hooks:uninstall && mise run unlink
```

## Configuration

| Env var         | Default | Effect                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTSD_DEBUG` | unset   | When `1`, the hook server exposes `GET /debug/sessions` returning a JSON snapshot of every tracked session (cwd, pid, model, current tool). Used by the test suite. The endpoint is unauthenticated, so any other process on the same machine can read it while enabled — leave it unset except for local diagnostics. |

## Development

```sh
npm run watch        # rebuild on file changes
npm run dev          # Stream Deck dev mode (hot reload)
npm run debug:hooks  # interactive hook event probe
```

Or the mise equivalents: `mise run watch`, `mise run dev`, `mise run debug:hooks`.

## Testing

`npm test` (or `mise run test`) runs unit, integration, and end-to-end layers. E2E uses [testagent](https://github.com/paultyng/testagent), a deterministic fake of the Claude Code CLI (no model or API key); E2E tests skip when it's not on PATH. `npm run test:coverage` (or `mise run test:coverage`) writes a report under `coverage/`. CI runs everything on Linux, macOS, and Windows.

## Actions

| Action           | Type    | Description                                                                                                               |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Session**      | Button  | Active session name, color-coded by state. Press to cycle sessions. Shows `(N/M)` counter.                                |
| **Session Dial** | Encoder | Rotate to cycle sessions. Same info as Session button in dial feedback.                                                   |
| **Status**       | Button  | Current state (`Working`, `Permission?`, `Question?`, `Idle`, `Error`), tool name, active work count (subagents + tasks). |
| **Mode**         | Button  | Permission mode (`Default`, `Plan`, `Auto`, etc.) and model name.                                                         |
| **Approve**      | Button  | Approve pending permission. Green when active, gray otherwise.                                                            |
| **Always Allow** | Button  | Approve and add session-scoped allow rule for the tool. Gold when active, gray otherwise.                                 |
| **Deny**         | Button  | Deny pending permission. Red when active, gray otherwise.                                                                 |
| **Stop**         | Button  | Send Ctrl+C interrupt to frontmost Ghostty terminal. Red when a session is active.                                        |
| **Focus**        | Button  | Bring Ghostty (or Claude Desktop) to foreground.                                                                          |

## Session states

| State                  | Color  | Meaning                                              |
| ---------------------- | ------ | ---------------------------------------------------- |
| `IDLE`                 | Green  | Session connected, waiting for input                 |
| `PROCESSING`           | Blue   | Tool execution in progress                           |
| `AWAITING_PERMISSION`  | Gold   | Permission prompt — approve or deny from Stream Deck |
| `AWAITING_ELICITATION` | Purple | Claude is asking a question                          |
| `DISCONNECTED`         | Gray   | No active session                                    |

## Key behaviors

- **Auto-foreground**: Permission requests and elicitations automatically bring their session to the active slot.
- **Permission queue**: Multiple sessions can have pending permissions simultaneously. They're foregrounded in arrival order; resolving one auto-advances to the next.
- **Permission timeout**: 24h. Auto-denies if no response.
- **Stale pruning**: Idle or disconnected sessions with no activity for 60s are automatically removed.
- **Auto-create sessions**: If a hook event arrives for an unknown session (e.g., plugin restarted mid-session), the session is created as IDLE.
- **Model backfill**: If the hook payload doesn't include a model, it's extracted from the session transcript.

## Hook events

The plugin registers hooks for all Claude Code lifecycle events:

`SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `StopFailure`, `PermissionRequest`, `Notification`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Elicitation`, `ElicitationResult`

Each event is posted to `http://localhost:9200/hooks/{EventName}`. Registration in `~/.claude/settings.json` is managed only by the manual `npm run hooks:install` / `npm run hooks:uninstall` commands.

## Acknowledgments

Inspired in part by [AgentDeck](https://github.com/puritysb/AgentDeck).
