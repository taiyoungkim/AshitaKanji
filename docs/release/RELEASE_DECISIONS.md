# Release Decisions

Last updated: 2026-05-29 (synced with PLAN v0.7.3)

## Confirmed

| Item | Decision |
|---|---|
| Support email | **datin0214@gmail.com** |
| GitHub account | **taiyoungkim** |
| GitHub repository | **https://github.com/taiyoungkim/AshitaKanji** |
| Privacy Policy hosting | GitHub Pages: **https://taiyoungkim.github.io/AshitaKanji/privacy/** |
| Support URL hosting | GitHub Pages: **https://taiyoungkim.github.io/AshitaKanji/support/** |
| Developer registration | Individual |
| Company name | None |
| Domain | None |
| AI cost model | User-facing AI features will use subscription entitlement, not BYO API keys |
| QA pace | Full-time |
| **OpenAI internal budget (data prep)** | **$50 hard cap** for GPT-4o draft generation (6,200 Korean meanings) |
| **Curation framing** | "Editor-curated 6,200" — "top-frequency" / "all JLPT" wording banned |
| **JSON export** | **MVP** (promoted from V1.1, long-term learners need data safety) |
| **OTA policy (MVP)** | **Disabled** (`expo.updates.enabled=false`) — zero outbound traffic |
| **Hotfix channel (MVP)** | Store rebuild only; expedited Apple review for P0 |
| **OTA reconsideration** | V1.1 trade-off review |
| **Example attribution** | Tatoeba and owner-cleared NAVER examples show per-card/source attribution on reveal/detail screens |
| **AI content framing** | "Released content is human-reviewed data" (no "disclosure avoidance" wording) |
| **Placeholder release blocker** | CI gate scans `site/ docs/release/PRIVACY_POLICY.md docs/release/SUPPORT.md app/ store-assets/` (excludes PLAN/RELEASE_DECISIONS to avoid self-reference). Must be 0 hits. |
| **GitHub Pages deploy method** | `gh-pages` branch, root folder, via `deploy-pages.sh` |

## URL Plan (Confirmed)

GitHub Pages hosting (repo: `taiyoungkim/AshitaKanji`):

| Page | Live URL |
|---|---|
| Privacy Policy | https://taiyoungkim.github.io/AshitaKanji/privacy/ |
| Support | https://taiyoungkim.github.io/AshitaKanji/support/ |

> ⚠️ URL case-sensitive. Repo name `AshitaKanji` (camelcase) used everywhere.
> Pre-launch check: `curl -I` both URLs → HTTP 200.
>
> **Deploy procedure**: run `~/jlpt-app/deploy-pages.sh` (pushes `~/jlpt-app/site/` to `gh-pages` branch),
> then enable Pages at https://github.com/taiyoungkim/AshitaKanji/settings/pages
> (Source = "Deploy from a branch", Branch = `gh-pages`, Folder = `/ (root)`).

## Kaggle CSV Level Count Check

Source file:

`/Users/tyoung/Downloads/jlpt_vocab.csv`

Observed columns:

`Original`, `Furigana`, `English`, `JLPT Level`

| Level | CSV count | Selection target | Spare count | Meets target |
|---|---:|---:|---:|---|
| N5 | 718 | 300 | +418 | Yes |
| N4 | 668 | 600 | +68 | Yes |
| N3 | 2,139 | 1,100 | +1,039 | Yes |
| N2 | 1,906 | 1,700 | +206 | Yes |
| N1 | 2,699 | 2,500 | +199 | Yes |
| **Total** | **8,130** | **6,200** | **+1,930** | **Yes** |

## Data Quality Notes

- Korean meanings are not included in the Kaggle CSV.
- `Furigana` has 2 blank rows.
- There is 1 exact duplicate row.
- There are 97 extra duplicate `Original + Furigana` candidates, often from cross-level overlap.
- The selection target is feasible for every level.

## OpenAI / AI Cost Policy

For launch data preparation:
- GPT may be used to draft Korean meanings.
- All released content must pass human QA.
- Internal generation cost is a development cost.

For user-facing AI features:
- MVP excludes AI questions.
- Future AI questions require subscription entitlement.
- BYO OpenAI API key is not used.
- A server proxy is required to protect the API key, enforce rate limits, and control cost.
