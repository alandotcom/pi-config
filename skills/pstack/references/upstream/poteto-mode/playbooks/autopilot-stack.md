### Autopilot-stack

Read the Pi execution contract. Follow Autopilot-full's grounding, ownership, independent verification, and lifecycle limits, while delivering a reviewed stack for the operator to land.

1. Pin the ordered dependency graph and authorized base branch. Follow the repository's installed stack tooling. Keep one owner per coherent unit and preserve existing changes.
2. Build each layer through its local implementation owner, then independently review and verify the exact layer head. Record evidence and open findings in the decision trail. Parent-owned publication requires an explicit grant.
3. Restack only with the operator's branch authority and the repository's linear-history rules. Reverify affected layers when a restack changes their patch or dependencies. A reused receipt must identify the unchanged contract and revision evidence.
4. Publish the complete stack only when authorized. Report the contiguous verified frontier, blockers above it, and the actual PR or branch references. Do not merge: the operator owns landing this stack.
5. Audit through current-session completion notifications. A scheduled cadence or unattended restart mechanism requires a separate explicit request and supported runtime.

**Reply:** stack order, exact verified heads, contiguous landing frontier, remaining blockers, and decision-trail path.
