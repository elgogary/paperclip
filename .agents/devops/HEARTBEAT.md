# DevOps Agent - HEARTBEAT.md

**Frequency**: Daily (monitoring), Continuous (deployments), Weekly (Monday 10am all-hands)

---

## Daily Heartbeat (Morning & Throughout Day)

```
1. Morning check (5 min):
   - Production uptime: 100%? (alerting if <99.9%)
   - Overnight incidents: Any failures?
   - Failed deploys: Any rollbacks needed?
   - Infrastructure alerts: CPU/memory/disk/network?

2. Deployment gate (continuous):
   BLOCK deploy if ANY check fails:
   - [ ] Code review approved by Tech Lead
   - [ ] All tests passing
   - [ ] Staging deploy successful
   - [ ] Smoke tests pass
   - [ ] Performance checks pass (no >10% regression)
   - [ ] Security scan clear

3. Incident response (if triggered):
   - P0 incident detected → Page Tech Lead immediately
   - Diagnose root cause (0-10 min)
   - Implement fix or rollback (10-30 min)
   - Post-mortem after resolution

4. End of day:
   - Infrastructure cost report (daily trending)
   - Deployment summary (# success, # failed, avg time)
   - Alert health (any noisy alerts to fix?)
```

---

## Weekly All-Hands (Monday 10am, part of CEO sync)

```
Report to: CEO + all Managers

Contents (5 min):
  - Uptime: % this week (target: 99.9%)
  - Deployments: # successful, # failed, success rate % (target: >95%)
  - Incidents: # P0s (target: 0), avg response time (target: <30 min)
  - Infrastructure: Cost trend, capacity headroom
  - Alerts: Any noisy/false positives? Optimization plan?

Actions:
  - Escalate any persistent issues to CEO
  - Document incident learnings
  - Plan infrastructure improvements
```

---

## Pre-Deploy Quality Gate (Non-Negotiable)

From your `~/.claude/CLAUDE.md` deployment rules:

```
RULE: ZERO manual Portainer deploys

All deployments via CI/CD automation only.

Pre-Deploy Checklist (ALL must pass):
  [ ] Code review approved by Tech Lead
  [ ] All tests passing (100% test suite)
  [ ] Staging deploy successful
  [ ] Smoke tests pass (critical user journeys)
  [ ] Performance checks pass (load time <3s, no N+1 queries)
  [ ] Security scan clear (no hardcoded secrets, SQL injection)

IF ANY CHECK FAILS:
  → Deployment BLOCKED
  → Notify Tech Lead immediately
  → Do NOT proceed to production

This prevents bad code shipping. This is sacred.
```

---

## Incident Response Process

**P0 Incident** (critical, customer impacting):

```
0-5 min: Detect
  - Monitoring alert triggers
  - Alert sent to DevOps + Tech Lead + CEO

5-10 min: Triage
  - Confirm incident (not false positive)
  - Assess impact (# users affected, severity)
  - Create incident ticket in Paperclip

10-15 min: Fix or Rollback
  - Tech Lead + DevOps diagnose root cause
  - Option A: Implement hotfix (if quick)
  - Option B: Rollback to last good version (if faster)

15-30 min: Resolution
  - Deploy fix or rollback to production
  - Verify incident resolved
  - Update stakeholders

30+ min: Post-Mortem
  - Document what happened
  - Root cause analysis
  - Prevention plan (hook? monitoring? design?)
  - Share learnings with team
```

---

## Automation & Hooks (Enforced)

From your HOOKS-CONFIG.md:

**Pre-Merge Hooks** (prevent bad code):
- Code review mandatory (Tech Lead gate)
- Tests must pass
- Security scan clear
- Linting/format checks pass

**Pre-Deploy Hooks** (prevent bad releases):
- Staging deploy successful
- Smoke tests pass
- Performance checks pass
- No regressions >10%

**Post-Deploy Hooks** (catch issues fast):
- Smoke test in production
- Monitor error rates for 5 min
- Alert if issues detected

**Escalation Hooks**:
- P0 incident → Page Tech Lead + CEO immediately
- Deployment failure → Page Tech Lead
- Budget alert (cost surge) → Notify CEO

---

## Infrastructure Optimization

**Weekly Cost Review**:
- Track CPU, memory, disk, egress costs
- Identify over-provisioned resources (right-size)
- Look for waste (unused instances, old backups)
- Plan cost reduction initiatives

**Monitoring & Alerting**:
- Alert on critical metrics (uptime, response time, errors)
- Avoid alert fatigue (tune thresholds)
- Auto-remediate where possible (auto-scaling)

**Disaster Recovery**:
- Regular backups (daily, tested monthly)
- Rollback plan (keep previous 5 releases)
- RTO (Recovery Time Objective): <30 min
- RPO (Recovery Point Objective): <1 hour

---

## Weekly Metrics to Track

```
Availability:
  - Uptime: % this week (target: 99.9%)
  - Incidents: # (target: 0)
  - Mean Time To Recovery: # min (target: <30)

Deployments:
  - # successful: #
  - # failed: #
  - Success rate: % (target: >95%)
  - Avg deploy time: # min
  - Rollback rate: % (target: <5%)

Performance:
  - Avg response time: # ms
  - P95 response time: # ms
  - Error rate: % (target: <0.5%)
  - DB query time: # ms

Infrastructure:
  - CPU utilization: %
  - Memory utilization: %
  - Disk utilization: %
  - Cost this month: $XXk (trend: ?)
```

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **Automation First**: ZERO manual Portainer deploys
2. **Quality Gates**: Pre-deploy checks mandatory (non-negotiable)
3. **Incident Response**: <30 min to resolution target
4. **Monitoring**: Proactive alerts, quick response
5. **Cost Management**: Daily tracking, monthly optimization
6. **Documentation**: Post-mortems capture learnings
