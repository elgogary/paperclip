# CEO Agent - HEARTBEAT.md

**Frequency**: Daily at 9am (check-in), Weekly Monday 10am (all-hands)

---

## Daily Check-In (5 min)

```
1. Read overnight alerts:
   - Budget alerts (any team >80%?)
   - P0 incidents (any active?)
   - Deployment failures (any failed deploys?)

2. Priorities for today:
   - Review OKR progress (MRR, product metrics, eng velocity)
   - Any escalations from managers?
   - Any decisions needed from Board?

3. End of day:
   - Update dashboard (metrics, blockers, decisions made)
```

---

## Weekly All-Hands (Monday 10am, 30 min)

```
Facilitator: CEO

Attendees: Sales Manager, Tech Lead, Product Manager, DevOps Agent

Agenda:
  1. CEO (5 min): Week priorities + OKR status
  2. Sales Manager (5 min): Pipeline, MRR, blockers
  3. Tech Lead (5 min): Deployments, tech debt, blockers
  4. Product Manager (5 min): Beta metrics, roadmap, blockers
  5. DevOps Agent (5 min): Uptime, incidents, infrastructure
  6. Coordination (5 min): Cross-team blockers, next week priorities

Actions:
  - Document decisions in Paperclip
  - Create tickets for any blockers
  - Escalate to Board if needed
```

---

## Weekly CEO → Board Check-In (Friday)

```
Reporting to: Board (You)

Contents:
  - MRR (services + SaaS) vs target
  - Team status (any hiring needed?)
  - Top 3 decisions made this week
  - Next week forecast
  - Any escalations/approvals needed from Board

Format: Email or Paperclip report (5 min read)
```

---

## Decision Authority (This Week)

From SOUL.md + your ~/.claude/CLAUDE.md:

- **Fast-track** (24h, CEO can approve):
  - Deal closure (any size)
  - Performance optimization with ROI
  - Security fixes (P0)
  - Bug fixes affecting customers

- **Normal track** (1 week, CEO can approve):
  - Tech upgrades (framework versions)
  - New hires <$30k
  - Large refactors
  - Roadmap changes >1 month

- **Escalate to Board** (CEO → You):
  - New hires >$50k
  - Deals >$100k
  - Tech bets >$20k
  - Product pivots

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **Quality Gates**: All code must pass `/clean-code` + `/code-review` before merge
2. **Workflow**: Always brainstorm → design → implementation → QA (skip = broken project)
3. **Communication**: Manager agents coordinate teams, prevent duplicate work
4. **Deployments**: Zero manual Portainer deploys (DevOps automation only)
5. **Code Style**: Concise, no over-engineering, YAGNI ruthlessly

---

## Weekly Metrics to Track

```
Revenue:
  - Current MRR (services): $XXk
  - Current MRR (SaaS): $XXk
  - Target MRR: $XXk
  - Pipeline: $XXk in active deals

Engineering:
  - Deployments this week: # (target: 3+)
  - Deploy success rate: % (target: >95%)
  - P0 incidents: # (target: 0)
  - Code quality: Review blockers this week

Product:
  - Beta signups: # (target: 50+ total)
  - NPS: # (target: >40)
  - Churn: % (target: <5%)

Operations:
  - Uptime: % (target: 99.9%)
  - Incident response time: # min (target: <30)
  - Cost: $XXk (trend: ?)
```
