<!-- markdownlint-disable MD013 MD028 MD033 MD041 MD060 -->
<a name="readme-top"></a>
<br />

<div align="center">
  <a href="https://github.com/decide-as/invoice-generator">
    <img src="assets/logo.png" alt="Logo" height="150">
  </a>

<h3 align="center">Invoice-Generator</h3>

  <p align="center">
    Drafts professional invoices from project summaries with multi-currency and VAT support
    <br />
    <a href="https://github.com/decide-as/invoice-generator"><strong>Explore »</strong></a>
  </p>

![Category](https://img.shields.io/badge/category-tool-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Phase](https://img.shields.io/badge/phase-discovery-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Stage](https://img.shields.io/badge/stage-ideation-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Version](https://img.shields.io/badge/version-0.1.0-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Python](https://img.shields.io/badge/python-3.11+-d4bc9a?style=flat-square&labelColor=2a2a2a) ![License](https://img.shields.io/badge/license-proprietary-d4bc9a?style=flat-square&labelColor=2a2a2a)

</div>

> **Discovery** — Exploring the problem space — not yet building.


<details>
  <summary>Table of Contents</summary>
  <ul>
    <li><a href="#about">About</a></li>
    <li><a href="#demo">Demo</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#testing">Testing</a></li>
    <li><a href="#software-quality">Software Quality</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#project-structure">Project Structure</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#security">Security</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
    <li><a href="#contact">Contact</a></li>
  </ul>
</details>

## About

Drafts professional invoices from project summaries with multi-currency and VAT support

<!-- Why does this project exist? What problem does it solve? What motivated you to build it? -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Demo

<!-- Add a screenshot, GIF, or terminal recording (e.g. asciinema) showing the project in action -->
<!-- Example: -->
<!-- ![Demo](assets/demo.gif) -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Python >=3.11

### Installation

```bash
git clone https://github.com/decide-as/invoice-generator
cd invoice-generator
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,test]"
```


<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

<!-- Describe how to use this project -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Testing

![Coverage](https://img.shields.io/badge/coverage-0%25-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Test Quality](https://img.shields.io/badge/test_quality-0%25-d4bc9a?style=flat-square&labelColor=2a2a2a)

```bash
pytest tests/
```

### Linting

```bash
ruff check .
ruff format --check .
```

### Quality metrics

<!-- STATS:quality-metrics-table -->
| Metric | Target | Current | Tool | Quality dimension |
| ------ | ------ | ------- | ---- | ----------------- |
| All tests pass | Yes | — | pytest | Reliability |
| Test coverage | >= 60% | — | pytest-cov | Functional suitability |
| TQS | — | — | test_analytics_stats | Test depth |
<!-- /STATS:quality-metrics-table -->

### Test Quality Score

<!-- STATS:tqs-gate-status -->
_No TQS data available._
<!-- /STATS:tqs-gate-status -->
<!-- PLOT:tqs-freq-dist source:tests/.analytics/**/*.json hash:c56bb9b84b2214dc -->
![Score Frequency Distribution](docs/plots/tqs_freq_dist.png)
<!-- /PLOT:tqs-freq-dist -->
<!-- PLOT:tqs-signal-quality source:tests/.analytics/**/*.json hash:c56bb9b84b2214dc -->
![Test Signal vs Test Craft](docs/plots/tqs_signal_quality.png)
<!-- /PLOT:tqs-signal-quality -->
<!-- PLOT:tqs-cdf source:tests/.analytics/**/*.json hash:c56bb9b84b2214dc -->
![Score CDF](docs/plots/tqs_cdf.png)
<!-- /PLOT:tqs-cdf -->

### Scope x intent matrix

<!-- STATS:scope-intent-matrix -->
_Run `make refresh-stats` to populate._
<!-- /STATS:scope-intent-matrix -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Software Quality

![Quality Gate](https://img.shields.io/badge/quality_gate-basic-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Tiers](https://img.shields.io/badge/tiers-PASS-d4bc9a?style=flat-square&labelColor=2a2a2a) ![mypy](https://img.shields.io/badge/mypy-checked-d4bc9a?style=flat-square&labelColor=2a2a2a) ![Ruff](https://img.shields.io/badge/code_style-ruff-d4bc9a?style=flat-square&labelColor=2a2a2a)

This project enforces a **basic** quality gate (discovery phase), informed by [ISO/IEC 25010](https://www.iso.org/standard/35733.html) (SQuaRE) software quality characteristics mapped to practical engineering checks.

### Quality metrics

| Metric | Target | Tool | ISO 25010 |
|---|---|---|---|
| Test coverage | >= 60% | pytest-cov | Functional suitability |
| All tests pass | Yes | pytest | Reliability |
| Linting clean | Yes | ruff | Maintainability |

### Gate levels

Quality gates auto-derive from the project [phase](.claude/rules/phase-maturity.md) unless explicitly overridden in `project-meta.yaml`:

| Gate | Phases | What it enforces |
|---|---|---|
| `none` | discovery, poc, prototype | No automated enforcement |
| `basic` | mvp, alpha | Lint + tests + coverage >= 60% |
| `strict` | beta, pilot, validation, production | Basic + coverage >= 80% + security scanning |

<details>
<summary>ISO/IEC 25010 quality model mapping</summary>

The quality gates operationalize key characteristics from the ISO/IEC 25010 (SQuaRE) software quality model:

| Characteristic | Engineering practice | Gate |
|---|---|---|
| **Functional suitability** | Test coverage, test pass rate | basic |
| **Reliability** | Error handling tests, edge case coverage | basic |
| **Security** | Dependency scanning (`pip-audit`), static analysis (`bandit`) | strict |
| **Maintainability** | Lint compliance, consistent style, test coverage | basic |
| **Performance efficiency** | Benchmark tests *(planned)* | — |
| **Usability** | CLI help text, error message quality, output consistency | basic |
| **Compatibility** | API stability, schema backward-compat, integration contracts | basic |
| **Portability** | Portable paths, platform guards, min-version constraints | basic |

This mapping is informational — the gates enforce the engineering practices; the ISO model provides the conceptual framework for why each check matters.
</details>

### Running quality checks locally

```bash
make test          # Run tests
make coverage      # Run tests with coverage
make lint          # Lint check
make quality        # All of the above
```

### Coverage tiers

Per-module coverage is enforced by importance tier. Critical modules require higher coverage than peripheral ones.

<!-- TIER-TABLE-START -->
<!-- TIER-TABLE-END -->

Update the table after running tests:

```bash
make update-tier-badge
```


<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How It Works

<!-- Replace this example with your actual architecture -->

```mermaid
flowchart LR
    Input --> Processing --> Output
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

- [Python](https://python.org) — Core language
<!-- Add other key dependencies here -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Structure

```
invoice-generator/
├── src/invoice_generator/         # Source code
├── tests/                  # Test suite
├── assets/                 # Project assets (logo, images)
├── .claude/                # Claude Code rules and scripts
├── .github/                # CI workflows
├── project-meta.yaml         # Project metadata
├── CLAUDE.md               # Claude Code instructions
├── ARCHITECTURE.md         # System architecture
├── CHANGELOG.md            # Version history
└── README.md               # This file
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

See the [open issues](https://github.com/decide-as/invoice-generator/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are welcome! If you have a suggestion, please fork the repo and create a pull request, or open an issue with the tag "enhancement".

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See `.claude/rules/` for project conventions.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security

To report a security vulnerability, please open a private issue or contact the maintainer directly. Do not disclose vulnerabilities publicly until they have been addressed.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

All Rights Reserved. This software may not be used, copied, modified, or distributed without explicit permission from the author.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

<!-- Add acknowledgments, credits, and references here -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

 — [github.com/decide-as](https://github.com/decide-as)

Project Link: [https://github.com/decide-as/invoice-generator](https://github.com/decide-as/invoice-generator)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
