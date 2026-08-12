# Factory quality-gate rollout

This branch changes factory intake to allow-listed `factory-ready` issues by default, separates broad epic/planning
work from implementation work, adds a deterministic pre-PR production-quality scan, and makes independent review
fail closed through a structured acceptance-criteria report.

Deployment note: existing hosts with an explicit `FACTORY_REQUIRE_READY_LABEL=false` in
`/etc/hellotalk-factory/factory.env` must change that value to `true` before restarting the service if they want
the safe intake policy immediately.
