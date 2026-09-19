# Factory Stall Investigation

The OpenHands Factory daemon has been unable to schedule new work for longer than its configured
alert threshold. You are given a deterministic diagnostic snapshot below (disk usage, service
status, recent logs, largest directories) gathered at the moment this investigation started.

You have no tool access in this session and cannot inspect anything beyond the snapshot given -
reason only from that evidence. Do not guess at causes the evidence doesn't support.

Produce a concise report, under 300 words, covering:

1. **Root cause** - the specific condition blocking scheduling, cited from the evidence.
2. **Confidence** - state plainly if the evidence is inconclusive rather than speculating.
3. **Recommended fix** - the smallest concrete action that would resolve it, and whether it looks
   like something requiring a code fix (a repeat of a known bug class) or purely an operational
   action (free disk space, restart a stuck process).

Write for an operator glancing at a phone notification: lead with the one-sentence diagnosis, then
the supporting detail.
