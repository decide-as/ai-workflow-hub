# Product Maturity Stages & Phases (reference for PR evaluation)

Every project tracks its maturity in `project-meta.yaml` under the `stage` and `phase` fields. Before every PR, evaluate whether the project has moved to a new phase (and consequently a new stage). If unsure, ask the user.

## Phase one-liners (for README status callouts)

| Phase | Callout |
|---|---|
| discovery | Exploring the problem space — not yet building. |
| poc | Testing feasibility — this is an experiment. |
| prototype | Early interactive model — not production-ready. |
| mvp | Minimum viable product — usable but minimal. |
| alpha | Internal testing — expect bugs and breaking changes. |
| beta | External testing — gathering feedback from real users. |
| pilot | Limited live deployment — refining operations. |
| validation | Feature-complete — focused on stability and security. |
| production | Stable and production-ready. |

## Stage and phase mapping

| Stage | Phase | Description |
|-------|-------|-------------|
| ideation | discovery | Research & requirements |
| ideation | poc | Feasibility test |
| ideation | prototype | Early interactive model |
| build | mvp | Minimum viable product |
| build | alpha | Internal testing |
| build | beta | External testing |
| launch | pilot | Small-scale live deployment |
| launch | validation | Stability & final sign-off |
| launch | production | Full-scale production |

---

## Stage 1: Ideation

The project is being explored, scoped, and proven feasible. No production users.

### discovery — Discovery

Research and requirement gathering to define the problem, the target audience, and the project scope.

*Kartlegging og kravspesifisering for å definere problemstilling, målgruppe og prosjektets omfang.*

**Decision maker goal:** What are we building and why?

### poc — Proof of Concept

A simple test to verify an idea or hypothesis. This can be anything from a sketch to a basic script, focusing solely on feasibility.

*En enkel test for å verifisere en idé eller hypotese. Dette kan være alt fra en skisse til et enkelt script, med fokus kun på gjennomførbarhet.*

**Decision maker goal:** Is the core idea even possible?

### prototype — Prototype

An early interactive model that helps visualize the product and test its functionality, though it may not be fully functional behind the scenes.

*En tidlig interaktiv modell som hjelper med å visualisere produktet og teste funksjonalitet, selv om den kanskje ikke er fullt fungerende "under panseret".*

**Decision maker goal:** How will it look and feel?

---

## Stage 2: Build

The product is being built, tested internally, and refined with early users.

### mvp — MVP (Minimum Viable Product)

The version with the fewest features necessary to be usable by early adopters, used to validate the core product concept with real data.

*Den enkleste versjonen av produktet som er funksjonell nok til at tidlige brukere kan ta det i bruk, for å validere kjerneideen med reelle data.*

**Decision maker goal:** Will people actually use the basic version?

### alpha — Alpha

An internal release meant for developers and testers. It is more complete than an MVP but is used to find bugs before anyone outside the company sees it.

*En intern utgivelse ment for utviklere og testere. Den er mer komplett enn en MVP, men brukes til å finne feil før noen utenfor selskapet ser den.*

**Decision maker goal:** Can we find the flaws internally?

### beta — Beta

An external release for a limited group of users to test in real-world environments. The focus is on gathering feedback and finding edge-case bugs.

*En ekstern utgivelse til en begrenset gruppe brukere for testing i reelle omgivelser. Målet er å samle tilbakemeldinger og finne feil i faktisk bruk.*

**Decision maker goal:** What do real users think?

---

## Stage 3: Launch

The product is being validated in real environments and prepared for full release.

### pilot — Pilot

A small-scale launch in a live environment (e.g., one department or one city) to refine operations and support before a full rollout.

*En lansering i liten skala i et live-miljø (f.eks. én avdeling eller én by) for å justere drift og støtte før full utrulling.*

**Decision maker goal:** Does it work in a real business setting?

### validation — Final Validation

A version that is potentially ready for release. No new features are added; the focus is entirely on stability, security, and final sign-off.

*En versjon som er potensielt klar for lansering. Ingen nye funksjoner legges til; fokuset er utelukkende på stabilitet, sikkerhet og endelig godkjenning.*

**Decision maker goal:** Is it stable and bug-free?

### production — Production Ready

The final version that is stable, secure, and ready for full-scale production or deployment to the entire market.

*Den endelige versjonen som er stabil, sikker og klar for fullskala produksjon eller utrulling til hele markedet.*

**Decision maker goal:** Are we ready for everyone?
