# Frontend Engineer Agent - HEARTBEAT.md

**Frequency**: Daily (development), Continuous (code review), Bi-weekly (Eng sync)

---

## Daily Heartbeat (Morning)

```
1. Check overnight:
   - Any failed tests or CI pipeline errors?
   - Code review feedback from Tech Lead?
   - Any UI/accessibility issues reported?

2. Morning priorities:
   - Fix any failing tests (highest priority)
   - Address code review feedback (if blocking)
   - Continue yesterday's feature/component
   - Check Slack/Paperclip for design/UI issues

3. Development workflow:
   - TDD: Write failing test → implement → green → commit
   - Component-first (modular, reusable)
   - Design system compliance (no custom styles without approval)
   - Accessibility first (WCAG 2.1 AA target)

4. End of day:
   - Push code, create PR if ready for review
   - Update Paperclip with progress
   - Screenshot/video of UI changes for review
```

---

## Development Rules (Inherited from your ~/.claude/CLAUDE.md)

**Code Style** (rules/style.md):
```
- Concise code, minimal comments (only where logic isn't self-evident)
- No over-engineering: only what's requested
- No docstrings/comments to code you didn't change
- YAGNI: No features beyond scope
- Component = folder (never flat files for related components)
```

**Test-Driven Development** (TDD):
```
Step 1: Write failing test
  describe('MyComponent', () => {
    test('renders correctly', () => {
      render(<MyComponent />);
      expect(screen.getByText('Label')).toBeInTheDocument();
    });
  });

Step 2: Run to verify failure
  jest src/components/MyComponent.test.js
  Expected: FAIL

Step 3: Write minimal implementation
  function MyComponent() {
    return <div>Label</div>;
  }

Step 4: Run to verify pass
  jest src/components/MyComponent.test.js
  Expected: PASS

Step 5: Commit
  git commit -m "feat: add MyComponent"
```

**i18n Mandatory** (rules/style.md):
```
RULE: All UI strings wrapped in __()

✓ frappe.msgprint(__('Action successful'))
✓ frappe.show_alert({message: __('Saved')})
✓ frappe.throw(__('Invalid input'))
✓ frappe.confirm(__('Continue?'), ...)

✓ Dialog/field labels
  title: __('New Document')
  label: __('Field Name')

✓ Component props
  <Button label={__('Submit')} />
  <Dialog title={__('Confirm')} />

✗ NEVER bare English strings in UI
  BAD:  <Button>Click me</Button>
  GOOD: <Button>{__('Click me')}</Button>

✗ NEVER in template literals without __()
  BAD:  `Status: ${status}`
  GOOD: `${__('Status')}: ${status}`
```

---

## Design System Compliance

```
RULE: All UI must follow design guide

✓ Use approved colors (Tailwind or design tokens)
✓ Use approved fonts (typography scale)
✓ Use approved spacing (8px grid)
✓ Use approved components (design system library)

✗ NO custom CSS without design lead approval
  If you want a new color/font/component:
  → Ask in Eng sync
  → Design lead reviews
  → Add to design system
  → Use in your component

This prevents design drift and keeps UI consistent.
```

---

## Accessibility First

**WCAG 2.1 AA compliance** (minimum):

```
✓ Alt text on all images
  <img alt="Brief description of image" />

✓ ARIA labels on interactive elements
  <button aria-label="Close dialog">×</button>

✓ Keyboard navigation
  Tab through all interactive elements
  Enter/Space triggers actions
  Escape closes dialogs

✓ Semantic HTML
  <button>, <a>, <input>, <label>, <nav>, <main>
  NOT <div> or <span> for interactive elements

✓ Color contrast
  Text: 4.5:1 (AA standard)
  Test: https://webaim.org/resources/contrastchecker/

✓ Form labels
  Every <input> has associated <label>
  <label for="email">Email</label>
  <input id="email" type="email" />

Run Lighthouse audit weekly (target: >90)
```

---

## Frappe Client Script Patterns

```
frappe.ui.form.on('DocType', {
  refresh(frm) {
    // Setup buttons, visibility rules
    if (frm.doc.status === 'Draft') {
      frm.add_custom_button(__('Publish'), () => {
        frappe.call({
          method: 'app.doctype.method',
          args: { name: frm.doc.name },
          callback: (r) => {
            frm.reload_doc();
            frappe.msgprint(__('Published'));
          }
        });
      });
    }
  },

  validate(frm) {
    // Validation rules
    if (!frm.doc.email) {
      frappe.throw(__('Email required'));
    }
  },

  field_change(frm) {
    // React to field changes
    frm.set_value('other_field', 'new_value');
  }
});
```

---

## Code Review Process

**Your PR workflow**:
```
1. Create branch
   git checkout -b feature/short-description

2. Write failing test + implementation (TDD)
   - Create component with test
   - Implement component
   - Run tests locally before pushing

3. Push & create PR
   git push origin feature/short-description
   Create PR on GitHub/GitLab
   Include screenshot/video of UI

4. Tech Lead reviews (wait <24h)
   - Check design compliance
   - Check accessibility
   - Check test coverage
   - Requests changes? → Make changes, push again
   - Approves? → Proceed to step 5

5. Accessibility check
   - Run Lighthouse audit (target: >90)
   - Test keyboard navigation
   - Test screen reader
   - All pass? → Ready for DevOps

6. DevOps deploys
   - Deploy to staging
   - Smoke tests pass? → Deploy to production
```

---

## Bi-Weekly Eng Sync (Monday 2pm)

Participate in:
- Code review status
- Design system updates
- Accessibility audit results
- Component library health
- Skills updates / new patterns

---

## Weekly Metrics to Track

```
Development:
  - PRs created: #
  - PRs merged: #
  - Code review feedback time: # hours avg
  - Commits: # (should be frequent, small)

Testing:
  - Test coverage: % (target: >80% new code)
  - Tests passing: % (target: 100%)
  - Lighthouse score: # (target: >90)

Accessibility:
  - WCAG violations: # (target: 0)
  - Components with alt text: %
  - Keyboard navigation tested: %

Productivity:
  - Components shipped: #
  - Design system contributions: #
  - Accessibility fixes: #
```

---

## Rules Enforced This Week

Inherited from your `~/.claude/CLAUDE.md`:

1. **TDD**: Failing test → implementation → green → commit
2. **i18n mandatory**: All UI strings wrapped in __()
3. **Design compliance**: Use design system, no custom CSS without approval
4. **Accessibility first**: WCAG 2.1 AA, Lighthouse >90
5. **Code review**: MUST pass before merge
6. **Small commits**: Frequent, atomic, logical chunks
7. **Modular components**: Feature = folder (not flat files)
