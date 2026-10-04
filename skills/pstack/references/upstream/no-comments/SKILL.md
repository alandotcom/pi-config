---
name: no-comments
description: Independently audit comments and resolve evidenced in-scope findings.
disable-model-invocation: true
---

# No comments

Read [the Pi execution contract](../../pi-runtime.md). Keep comments that express a necessary public contract, legal requirement, external constraint, or supported toolchain directive. Make ordinary code clear through names, types, and ownership.

1. Pin the caller's files or diff. Launch a read-only general-purpose agent with the bundled reviewer brief for comment quality, including the repository's comment policy. The reviewer reports proposed deletions and root-cause concerns; it does not edit comments or application code.
2. Require file/line evidence and an explanation for every finding. Reject scope escapes and speculative claims. Preserve legal headers, public API contracts, necessary dependency/protocol constraints, and repository-approved suppressions. Validate a claimed constraint against the real API or source.
3. The implementation owner removes confirmed redundant comments or fixes the smallest approved root cause. A shape change runs architect first. Out-of-scope changes require separate authorization.
4. A safety or correctness suppression is a code finding, not permission to delete the directive blindly. Repair the owner and rerun the relevant check. Record unresolved constraints with reason and owner.
5. Report confirmed removals, preserved constraints, repairs, verification, and remaining questions. The result must preserve behavior and safety. This reference does not require the original Comment Sicko agent or its theatrical output.
