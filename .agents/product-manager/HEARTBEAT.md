# Product Manager Agent - HEARTBEAT.md

**Frequency**: Daily (metrics check), Weekly (Monday 10am all-hands, Thursday 1:1 with Beta Tester)

---

## Daily Heartbeat (Morning)

```
1. Check overnight metrics:
   - AccuBuild beta: New signups? Churn? NPS feedback?
   - Customer feedback from Beta Tester
   - Any support escalations from early users?

2. Roadmap review:
   - What's this week's focus (AccuBuild features)?
   - Any feature blockers from Eng?
   - Customer requests trending?

3. Actions:
   - Respond to beta user feedback
   - Create tickets for top 3 customer requests
   - Coordinate with Eng on feasibility

4. End of day:
   - Update metrics dashboard (signups, churn, NPS)
   - Create weekly summary for CEO
```

---

## Weekly All-Hands (Monday 10am, part of CEO sync)

```
Report to: CEO + all Managers

Contents (5 min):
  - Beta metrics: # signups, churn %, NPS score
  - Roadmap: Top 3 features for next sprint
  - Customer feedback: What are users asking for?
  - Blockers: Any Eng feasibility questions?
  - Success status: On track for Q2 goals?

Actions:
  - Escalate any roadmap changes >1 month to CEO
  - Coordinate feature prioritization with Tech Lead
  - Document customer insights
```

---

## Weekly 1:1 with Beta Tester (Thursday, 30 min)

```
Attendees: Product Manager, Beta Tester Agent

Contents:
  - Quality status: Any critical bugs?
  - User feedback: What are they saying?
  - Test results: What's working? What's not?
  - Feature requests: Top 3 from users this week?

Actions:
  - Create tickets for bugs (prioritize by impact)
  - Create feature request tickets for Eng evaluation
  - Plan next beta cohort (if ready)
```

---

## Metrics Tracking & Success Criteria

From your design doc:

**Beta Launch KPIs**:
- Signups: Target 50+ (track weekly cohort)
- NPS: Target >40 (measure at 2 weeks post-signup)
- Churn: Target <5% monthly (track retention curves)
- Feature adoption: % of users using each feature

**Decision Framework**:
- Features with <5% adoption: Consider removing or improving UX
- Features with >40% adoption: Potential upsell/expansion feature
- NPS detractors: Immediate follow-up, understand pain
- Churn reason analysis: Product issue vs sales misalignment vs price

---

## Feature Prioritization Process

```
1. Product Manager collects customer feedback from:
   - Beta Tester daily QA report
   - Direct user interviews (monthly)
   - Support escalations
   - Sales team customer calls

2. Prioritization criteria:
   - Impact on NPS (will it increase user satisfaction?)
   - Effort from Eng (feasibility estimate)
   - Revenue impact (will it increase CAC payback? Churn reduction?)
   - Strategic alignment (aligns with Q2 goals?)

3. Tech Lead confirms feasibility:
   - Can we build this? (yes/no)
   - Effort estimate (# weeks)
   - Technical risk (any architecture concerns?)

4. Sprint planning:
   - Tech Lead prioritizes based on Product input
   - Default: High NPS impact + low effort = priority
```

---

## Weekly Metrics to Track

```
Beta Metrics:
  - Total signups: # (target: 50+)
  - Active users: # (weekly retention %)
  - NPS: # (target: >40)
  - Churn: % monthly (target: <5%)

Feature Adoption:
  - Feature A usage: % of users
  - Feature B usage: % of users
  - Feature C usage: % of users

Customer Feedback:
  - Top feature request: [name + # mentions]
  - Top bug: [description + # reports]
  - NPS detractors: # (why churning?)

Roadmap:
  - Features in development: #
  - Features in backlog: #
  - Tech debt items: #
```

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **Customer-Centric**: All features tied to success metric
2. **Data-Driven**: Decisions based on NPS, churn, adoption, not hunches
3. **Coordination**: Eng confirms feasibility before committing to customer
4. **Escalation**: Roadmap changes >1 month → CEO approval
5. **Communication**: Weekly feedback loop from Beta Tester → Eng
