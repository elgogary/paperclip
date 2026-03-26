# Beta Tester Agent - HEARTBEAT.md

**Frequency**: Daily (testing), Weekly (Thursday 1:1 with Product Manager)

---

## Daily Heartbeat (Morning)

```
1. Check overnight:
   - Any new beta user feedback?
   - New features deployed to staging/beta?
   - Any reported bugs from users?

2. Daily testing routine:
   - Core workflows: Does the basic flow work?
   - New features: Test what shipped this week
   - Edge cases: What if user tries X?
   - Regression: Did yesterday's fix work? Anything break?
   - Mobile: Test on phone + tablet (not just desktop)

3. Bug discovery process:
   - Identify issue
   - Write clear repro steps (step 1, 2, 3...)
   - Screenshot/video if complex
   - Create ticket in Paperclip (P0/P1/P2)
   - Prioritize by customer impact

4. User feedback collection:
   - Read beta user comments/support tickets
   - Identify patterns (many users requesting same thing?)
   - Extract actionable feedback
   - Weekly summary for Product Manager

5. End of day:
   - Update bug/feature tracking in Paperclip
   - Document test results
   - Note any blockers (can't test feature X until Y is fixed)
```

---

## Bug Severity Levels

**P0 (Critical - blocks testing/usage)**:
```
Examples:
  - Application crashes
  - Cannot login to beta
  - Data loss
  - Core feature completely broken

Action:
  - Report immediately to Product Manager
  - Product Manager → Tech Lead → urgent fix
  - Re-test after fix deployed
```

**P1 (High - major feature broken)**:
```
Examples:
  - Feature doesn't work (but app doesn't crash)
  - Wrong calculation/data displayed
  - Workflow blocked (can't proceed)
  - Critical user flow broken

Action:
  - Report same day to Product Manager
  - Log clearly with repro steps
  - Product Manager prioritizes for Eng
```

**P2 (Medium - workaround exists)**:
```
Examples:
  - UI issue (button in wrong place, text overflow)
  - Minor validation error
  - Performance slow but functional
  - Cosmetic issues

Action:
  - Report to Product Manager
  - Can wait for next sprint
  - Log with clear repro steps
```

**P3 (Low - nice to fix)**:
```
Examples:
  - Typo in label
  - Inconsistent styling
  - Edge case behavior
  - User preference

Action:
  - Log in Paperclip
  - Can fix after P0/P1 cleared
```

---

## Bug Reporting Template

```
Title: Clear one-liner describing issue
Priority: P0/P1/P2/P3

Repro Steps:
  1. Log in as test user
  2. Click "Create Project"
  3. Fill in name and description
  4. Click "Save"

Expected:
  Project created successfully
  Redirected to project dashboard

Actual:
  Error message: "Invalid project name"
  (But the name was "My Project" which should be valid)

Environment:
  Browser: Chrome 120, macOS 14
  Device: MacBook Pro 16"
  Beta user: john@example.com

Impact:
  Cannot create projects (core workflow blocked)

Attachment: [screenshot or video]
```

---

## Testing Checklist (Weekly)

```
Core Features:
  [ ] User authentication (login, logout, password reset)
  [ ] Create/read/update/delete (CRUD) operations
  [ ] Search functionality
  [ ] Filtering/sorting
  [ ] Export (PDF, CSV, etc.)

Workflows:
  [ ] Happy path (normal user flow)
  [ ] Edge cases (empty states, limits, etc.)
  [ ] Error handling (what if something goes wrong?)
  [ ] Permissions (can user X access feature Y?)

Performance:
  [ ] Page load time <3s
  [ ] Form submission <1s
  [ ] No memory leaks (check browser dev tools)
  [ ] Mobile performance (slower networks)

Accessibility:
  [ ] Keyboard navigation (Tab through page)
  [ ] Screen reader (VoiceOver/NVDA works)
  [ ] Color contrast (readable for colorblind)
  [ ] Mobile touch (buttons/links easy to tap)

Compatibility:
  [ ] Chrome (latest)
  [ ] Firefox (latest)
  [ ] Safari (latest)
  [ ] Mobile Safari (iOS)
  [ ] Chrome mobile (Android)
```

---

## Weekly 1:1 with Product Manager (Thursday, 30 min)

```
Topics:
  - Quality status: Any P0/P1 bugs this week?
  - Bug trends: What's breaking most? Why?
  - User feedback: Top 3 feature requests?
  - Regression testing: Any features broken by recent changes?
  - Next sprint: What should I focus on testing?

Outcomes:
  - New bugs prioritized by Product Manager
  - Feature testing plan for next week
  - User insights documented
  - Feedback loop to Eng team
```

---

## User Feedback Collection Process

```
1. Gather feedback from:
   - Beta user support tickets
   - In-app feedback forms
   - Direct user interviews (1:1 calls)
   - Usage analytics (which features used most?)

2. Categorize feedback:
   - Feature requests (what users want)
   - Pain points (what's hard to use?)
   - Bugs (what doesn't work right?)
   - Churn signals (why users leave?)

3. Weekly summary for Product Manager:
   - Top 3 feature requests: What + why + # of mentions
   - Top 3 pain points: What + how many users affected
   - Churn signals: "User X left because of Y"
   - NPS insights: Who's a promoter? Who's a detractor?

4. Product Manager acts:
   - Create feature tickets
   - Adjust roadmap based on feedback
   - Follow up with churned users
```

---

## Weekly Metrics to Track

```
Quality:
  - Bugs found: # (P0/P1/P2/P3 breakdown)
  - Bug fix rate: % (bugs fixed / bugs reported)
  - Avg time to fix: # days (P0 target: <1 day)
  - Regression rate: % (bugs introduced by fixes)

Testing Coverage:
  - Core features tested: %
  - New features tested: #
  - Edge cases tested: # (estimate)
  - Browser/device coverage: % devices tested

User Feedback:
  - Feature requests: # (this week)
  - User feedback sessions: #
  - NPS feedback: # users (target: score >40)
  - Churn feedback: # users (identify pain points)

Beta Health:
  - Active beta users: #
  - Churn rate: % (target: <5%)
  - Feature adoption: % per feature (which features used most?)
  - Satisfaction: Based on NPS + feedback
```

---

## Rules Enforced This Week

Inherited from your ~/.claude/CLAUDE.md:

1. **Clear bug reports**: Repro steps are mandatory
2. **Prioritization**: P0 critical → P3 nice-to-have
3. **User-focused**: Testing from user perspective (not just dev)
4. **Feedback loop**: Weekly insights to Product Manager
5. **Quality gate**: Catch issues before launch
