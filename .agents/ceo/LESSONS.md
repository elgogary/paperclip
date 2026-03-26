# Lessons Learned

## Format
- [YYYY-MM-DD] LESSON: <what happened> → <what to do instead>

## Lessons

- [2026-03-25] LESSON: Blocked tasks accumulate repeated dedup comments → always fetch comment thread first and skip if my last comment was a blocked-status update with no new replies since.

- [2026-03-25] LESSON: Company dashboard endpoint (GET /api/companies/:companyId/dashboard) gives instant snapshot of agent count, task counts, and monthly spend — faster than querying individual issues for status overview.

- [2026-03-25] LESSON: SalesRep1 was idle (not running) while consuming 64% of budget — check agent status alongside budget when evaluating team health; idle agents may have stalled or need reassignment.
