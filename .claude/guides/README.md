# Claude Code Capability Guides

Reference guides for every Claude Code extension mechanism that you configure in a project. Each guide covers what it is, when to use it, and real-world examples.

## Architecture overview

```mermaid
graph TB
    subgraph EXTERNAL["External systems"]
        APIs["APIs & services<br/><i>GitHub, Slack, Sentry</i>"]
        DBs["Databases<br/><i>Postgres, SQLite</i>"]
        Browser["Browsers<br/><i>Playwright</i>"]
        Cloud["Cloud<br/><i>AWS, GCP</i>"]
    end

    subgraph MCP_LAYER["MCP bridge"]
        MCP["MCP servers"]
    end

    subgraph CLAUDE["Claude Code runtime"]
        direction TB

        subgraph ALWAYS["Always in context"]
            CM["CLAUDE.md"]
            Rules["Rules"]
            Memory["Memory"]
        end

        subgraph ON_DEMAND["Loaded on demand"]
            Skills["Skills"]
            Agents["Custom agents"]
            Teams["Agent teams"]
            Guides["Guides"]
        end

        subgraph AUTOMATION["Event-driven"]
            Hooks["Hooks"]
            Loops["Loops"]
        end

        subgraph TOOLS["Built-in tools"]
            Read["Read / Edit / Write"]
            Search["Glob / Grep"]
            BashTool["Bash"]
            LSP["LSP servers"]
        end

        Scripts["Scripts"]
    end

    subgraph CONFIG["Configuration layer"]
        Settings["Settings"]
        Perms["Permissions"]
        Keys["Keybindings"]
        Sandbox["Sandbox"]
        Styles["Output styles"]
        ManagedSettings["Managed settings"]
    end

    subgraph DISTRIBUTION["Packaging & distribution"]
        Plugins["Plugins"]
    end

    MCP --> APIs
    MCP --> DBs
    MCP --> Browser
    MCP --> Cloud

    Skills --> BashTool
    Skills --> Search
    Skills --> Read
    Agents --> BashTool
    Agents --> Search
    Agents --> Read
    Teams --> Agents
    Hooks --> Scripts
    Hooks --> BashTool
    Loops --> Hooks
    Rules --> Scripts
    BashTool --> Scripts
    LSP -.-> Search
    ManagedSettings -.-> Settings

    MCP -.-> CLAUDE
    CONFIG -.-> CLAUDE
    Plugins -.-> Skills
    Plugins -.-> Agents
    Plugins -.-> Hooks
    Plugins -.-> MCP
    Plugins -.-> LSP

    style EXTERNAL fill:#f9e0e0,stroke:#c44
    style CLAUDE fill:#e0f0e0,stroke:#4a4
    style CONFIG fill:#e0e8f9,stroke:#44c
    style DISTRIBUTION fill:#f5e6d0,stroke:#c84
    style MCP_LAYER fill:#fdf0d5,stroke:#c94
    style ALWAYS fill:#c8e6c9,stroke:#2e7d32
    style ON_DEMAND fill:#fff9c4,stroke:#f9a825
    style AUTOMATION fill:#ffe0b2,stroke:#ef6c00
    style TOOLS fill:#e8f5e9,stroke:#388e3c
```

## How capabilities relate

```mermaid
graph LR
    subgraph LOADING["Loading strategy"]
        direction TB
        L1["Always loaded<br/>CLAUDE.md, Rules, Memory index"]
        L2["On demand<br/>Skills, Agents, Teams,<br/>Memory topics, Guides"]
        L3["Event-triggered<br/>Hooks, Loops"]
        L4["Session start<br/>Settings, MCP, Keys,<br/>Sandbox, Styles"]
    end

    subgraph SCOPE["Configuration scope"]
        direction TB
        S1["Global<br/><i>~/.claude/</i>"]
        S2["Project shared<br/><i>.claude/</i>"]
        S3["Project local<br/><i>.claude/settings.local</i>"]
        S4["Managed / IT<br/><i>/etc/claude-code/</i>"]
    end

    subgraph DIRECTION["Data flow"]
        direction TB
        D1["Inward<br/><i>Context → Claude</i><br/>CLAUDE.md, Rules,<br/>Memory, Guides"]
        D2["Outward<br/><i>Claude → World</i><br/>MCP, Hooks, Bash"]
        D3["Bilateral<br/><i>Claude ↔ Tools</i><br/>Skills, Agents, Teams"]
    end

    style LOADING fill:#e8f5e9,stroke:#388e3c
    style SCOPE fill:#e3f2fd,stroke:#1565c0
    style DIRECTION fill:#fce4ec,stroke:#c62828
```

## Capability matrix

```mermaid
block-beta
    columns 7

    block:header:7
        H1["Capability"] H2["Loading"] H3["Scope"] H4["Direction"] H5["Edits code"] H6["Calls external"] H7["Shareable"]
    end

    block:row1:7
        A1["CLAUDE.md"] A2["Always"] A3["All"] A4["Inward"] A5["No"] A6["No"] A7["Git"]
    end

    block:row2:7
        B1["Rules"] B2["Always"] B3["All"] B4["Inward"] B5["No"] B6["No"] B7["Git"]
    end

    block:row3:7
        R1["Memory"] R2["Always+demand"] R3["Project"] R4["Inward"] R5["No"] R6["No"] R7["No"]
    end

    block:row4:7
        GU1["Guides"] GU2["On demand"] GU3["Project"] GU4["Inward"] GU5["No"] GU6["No"] GU7["Git"]
    end

    block:row5:7
        C1["Skills"] C2["On demand"] C3["All"] C4["Bilateral"] C5["Yes"] C6["Optional"] C7["Git"]
    end

    block:row6:7
        D1["Hooks"] D2["Event"] D3["All"] D4["Outward"] D5["No"] D6["Yes"] D7["Git"]
    end

    block:row7:7
        LP1["Loops"] LP2["On demand"] LP3["Session"] LP4["Bilateral"] LP5["Indirect"] LP6["Optional"] LP7["No"]
    end

    block:row8:7
        E1["MCP"] E2["Session"] E3["All"] E4["Outward"] E5["No"] E6["Yes"] E7["Git/.json"]
    end

    block:row9:7
        LS1["LSP servers"] LS2["Session"] LS3["All"] LS4["Bilateral"] LS5["No"] LS6["No"] LS7["Plugin"]
    end

    block:row10:7
        F1["Agents"] F2["On demand"] F3["All"] F4["Bilateral"] F5["Yes"] F6["Optional"] F7["Git"]
    end

    block:row11:7
        T1["Teams"] T2["On demand"] T3["Session"] T4["Bilateral"] T5["Yes"] T6["Optional"] T7["No"]
    end

    block:row12:7
        G1["Settings"] G2["Session"] G3["All"] G4["Inward"] G5["No"] G6["No"] G7["Git"]
    end

    block:row13:7
        MS1["Managed settings"] MS2["Session"] MS3["Machine"] MS4["Inward"] MS5["No"] MS6["No"] MS7["MDM"]
    end

    block:row14:7
        S1["Sandbox"] S2["Session"] S3["All"] S4["Inward"] S5["No"] S6["No"] S7["Git"]
    end

    block:row15:7
        I1["Scripts"] I2["Called"] I3["Project"] I4["Outward"] I5["No"] I6["Optional"] I7["Git"]
    end

    block:row16:7
        J1["Keys"] J2["Session"] J3["Global"] J4["Inward"] J5["No"] J6["No"] J7["No"]
    end

    block:row17:7
        O1["Output styles"] O2["Session"] O3["All"] O4["Inward"] O5["No"] O6["No"] O7["Git"]
    end

    block:row18:7
        CP1["Checkpoints"] CP2["Automatic"] CP3["Session"] CP4["Internal"] CP5["No"] CP6["No"] CP7["No"]
    end

    block:row19:7
        CC1["Compaction"] CC2["Automatic"] CC3["Session"] CC4["Internal"] CC5["No"] CC6["No"] CC7["No"]
    end

    block:row20:7
        K1["Plugins"] K2["Session"] K3["All"] K4["All"] K5["Yes"] K6["Yes"] K7["Marketplace"]
    end

    style header fill:#37474f,color:#fff
```

## Decision flowchart

```mermaid
flowchart TD
    Start{"What do you need?"}

    Start -->|"Give Claude<br/>knowledge"| Knowledge{"What kind?"}
    Start -->|"Extend what<br/>Claude can do"| Extend{"How?"}
    Start -->|"Control how<br/>Claude works"| Control{"What aspect?"}

    %% === Knowledge branch ===
    Knowledge -->|"Project instructions"| Frequency{"Needed every<br/>conversation?"}
    Knowledge -->|"Cross-session<br/>learnings"| MEM["Use Memory"]
    Knowledge -->|"Reference docs"| GD["Use Guides"]

    Frequency -->|"Yes, concise"| CM["Use CLAUDE.md"]
    Frequency -->|"Yes, detailed"| RU["Use Rules"]
    Frequency -->|"No, on demand"| SK["Use Skills"]

    %% === Extend branch ===
    Extend -->|"React to events"| Events{"Once or<br/>recurring?"}
    Extend -->|"Connect to<br/>external systems"| External{"What kind<br/>of system?"}
    Extend -->|"Delegate to<br/>another agent"| Delegate{"How many<br/>agents?"}
    Extend -->|"Reusable shell<br/>commands"| SC["Use Scripts"]
    Extend -->|"Bundle & share<br/>everything"| PL["Use Plugin"]

    Events -->|"One-off trigger"| HK["Use Hooks"]
    Events -->|"Repeating interval"| LP["Use Loops"]

    External -->|"APIs, databases,<br/>tools"| MC["Use MCP Server"]
    External -->|"Code navigation<br/>(go-to-def, refs)"| LS["Use LSP Servers"]

    Delegate -->|"One specialist"| AG["Use Custom Agent"]
    Delegate -->|"Parallel team"| TM["Use Agent Teams"]

    %% === Control branch ===
    Control -->|"Permissions &<br/>tool access"| Permissions{"Who sets<br/>the policy?"}
    Control -->|"Restrict file /<br/>network access"| SB["Use Sandbox"]
    Control -->|"Keyboard shortcuts"| KB["Use Keybindings"]
    Control -->|"Response formatting<br/>only"| OS["Use Output Styles"]

    Permissions -->|"Project team"| ST["Use Settings"]
    Permissions -->|"IT / organization"| MS["Use Managed Settings"]

    %% === Styles ===
    style CM fill:#c8e6c9,stroke:#2e7d32
    style RU fill:#c8e6c9,stroke:#2e7d32
    style MEM fill:#c8e6c9,stroke:#2e7d32
    style GD fill:#c8e6c9,stroke:#2e7d32
    style SK fill:#fff9c4,stroke:#f9a825
    style HK fill:#ffe0b2,stroke:#ef6c00
    style LP fill:#ffe0b2,stroke:#ef6c00
    style MC fill:#fdf0d5,stroke:#c94
    style LS fill:#e8f5e9,stroke:#388e3c
    style ST fill:#e3f2fd,stroke:#1565c0
    style MS fill:#ef5350,color:#fff
    style SB fill:#e3f2fd,stroke:#1565c0
    style AG fill:#fff9c4,stroke:#f9a825
    style TM fill:#fff9c4,stroke:#f9a825
    style PL fill:#f5e6d0,stroke:#c84
    style SC fill:#e8f5e9,stroke:#388e3c
    style KB fill:#e3f2fd,stroke:#1565c0
    style OS fill:#e3f2fd,stroke:#1565c0
```

## Precedence hierarchy

```mermaid
graph TD
    Managed["Managed (IT policy)<br/><i>Cannot be overridden</i>"]
    CLI["CLI flags<br/><i>--allowedTools etc.</i>"]
    Local["Project local<br/><i>.claude/settings.local.json</i>"]
    Shared["Project shared<br/><i>.claude/settings.json</i>"]
    User["User global<br/><i>~/.claude/settings.json</i>"]

    Managed --> CLI --> Local --> Shared --> User

    style Managed fill:#ef5350,color:#fff
    style CLI fill:#ff7043
    style Local fill:#ffa726
    style Shared fill:#ffca28
    style User fill:#66bb6a
```

## Guides

### Authoring — teach Claude what to do

| Guide | Mechanism | Loading |
|-------|-----------|---------|
| [claude-md.md](authoring/claude-md.md) | CLAUDE.md project instructions | Always in context |
| [rules.md](authoring/rules.md) | `.claude/rules/` topic files | Always in context |
| [skills.md](authoring/skills.md) | `.claude/skills/` task templates | On-demand |
| [memory.md](authoring/memory.md) | Persistent notes across sessions | Index always, topics on-demand |
| [guides.md](authoring/guides.md) | Reference documentation in `.claude/guides/` | On-demand |

### Execution — extend what Claude can do

| Guide | Mechanism | Loading |
|-------|-----------|---------|
| [hooks.md](execution/hooks.md) | Event-driven shell automation | Triggered by events |
| [loops.md](execution/loops.md) | Recurring scheduled tasks | On-demand interval |
| [mcp-servers.md](execution/mcp-servers.md) | External tool integration | At session start |
| [lsp-servers.md](execution/lsp-servers.md) | Code intelligence (go-to-def, refs) | At session start |
| [custom-agents.md](execution/custom-agents.md) | Specialized subagents | On-demand |
| [agent-teams.md](execution/agent-teams.md) | Coordinated parallel agents | On-demand |
| [scripts.md](execution/scripts.md) | Reusable shell helpers | Called from rules/hooks |
| [plugins.md](execution/plugins.md) | Packaged extension bundles | At session start |

### Configuration — control how Claude works

| Guide | Mechanism | Loading |
|-------|-----------|---------|
| [settings.md](config/settings.md) | Permissions, config, modes | At session start |
| [managed-settings.md](config/managed-settings.md) | Organization-wide policy enforcement | At session start |
| [sandbox.md](config/sandbox.md) | Filesystem/network isolation | At session start |
| [keybindings.md](config/keybindings.md) | Keyboard shortcuts | At session start |
| [output-styles.md](config/output-styles.md) | Response formatting | At session start |

### Session — automatic behavior

| Guide | Mechanism | Loading |
|-------|-----------|---------|
| [checkpoints.md](session/checkpoints.md) | Session snapshots and rewind | Automatic |
| [context-compaction.md](session/context-compaction.md) | Conversation summarization | Automatic at ~95% capacity |
