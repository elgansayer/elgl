# Neptune OpenCode research trial

Use the existing Factory router and direct OpenCode subscription adapter for one
bounded Neptune research job. Codex and Gemini retain their current assignments;
the shared broker and host gate remain authoritative. This setup prepares a new
agent configuration and does not purchase a plan, launch a model or activate a service.

## Prepare the subscription and catalogue

Use the daemon's existing operating-system account and the supported OpenCode Go
login described in [SUBSCRIPTION-AGENTS.md](SUBSCRIPTION-AGENTS.md). Keep credentials
in the CLI's private credential store. Do not put a key in Git, a command argument,
a prompt or a new API-backed fallback. Check whether the existing Go workspace is
already funded before buying another plan. For the initial trial, use the included
allowance with Extra Usage disabled in the OpenCode console.

OpenCode's latest stable release checked on 4 November 2026 was v1.19.5. Refresh
this against the [official releases](https://github.com/anomalyco/opencode/releases)
at deployment; verify the installed version and its actual flags. The Factory
already has a direct adapter, so a second server or scheduler is unnecessary.

As the existing service user, retain the current model listing in a private file:

```bash
umask 077
opencode --version
opencode auth list
opencode models opencode-go > /home/dev/neptune-opencode-models.txt
```

These are metadata probes. They do not prove remaining allowance, a successful
generation, research correctness or live shared-session enrolment.

## Generate a separate Neptune profile

After the accepted Factory package contains the new command:

```bash
repo-factory opencode-profile \
  --source /etc/repo-factory/agents.json \
  --catalogue /home/dev/neptune-opencode-models.txt \
  --model opencode-go/minimax-m3 \
  --output /home/dev/neptune-opencode-trial.agents.json
```

Use the actual existing private agent-configuration path if the host uses a
different one. The output must be a new path. The command writes a mode-0600 file
atomically, refuses replacement of an existing file or symlink, and prints source,
catalogue and output hashes without copying credentials into its report. It needs
no GitHub token, vendor key or running model process.

The generated profile:

- binds itself to `elgansayer/Neptune-Bomberman`; loading it for Elgl or Workout fails;
- enables the selected account-listed OpenCode Go model with one concurrent attempt,
  a timeout no longer than ten minutes and a bounded captured-output size;
- places OpenCode first for implementation, quality repair and general action;
- retains native providers for planning, architecture, security, code review and CI repair;
- clears old OpenCode phase-model overrides and rejects custom argument overrides
  or an enabled API-backed provider;
- preserves the other providers, phase timeouts, circuit breakers and original source file.

The timeout/output bounds are process limits. They are not a vendor dollar meter,
and the existing `max_turns` field is not advertised as an enforced OpenCode turn cap.
The approximately $100 evaluation budget is not a new monthly or per-project allowance.
Go subscription limits and its Extra Usage setting must be checked in the actual account.

To compare DeepSeek, select its exact identifier from the new account listing and
write a second new profile. Do not guess a renamed model or silently substitute one.
The adapter rechecks exact catalogue membership before dispatch. Provider catalogue
visibility alone does not establish payment, remaining usage or task success.

## Host adoption and the first experiment

Have the existing trusted coordinator apply the trial configuration only to the
Neptune instance through its supported operator/deployment path. Do not replace
the shared `/etc/repo-factory/agents.json`, start a competing daemon, or interrupt
an existing Codex/Gemini worker. Preserve the shared provider-capacity directory,
host gate, storage reserves, task intake and repository-specific merge rules.
Before model dispatch, disable internal delegation or prove that any child agents
are included in the existing shared accounting. One CLI process does not prove
that only one model conversation exists. The profile generator does not certify
the installed harness's delegation configuration.

Neptune's committed instance template is preparatory and disabled. The scope guard
does not enable it or satisfy #33/#536. Prove installed source identity, provider
authentication and shared-account/session registration, then admit one existing
non-overlapping research task. Use the accepted bounded-job path and one heavy
experiment initially. Missing registration, host access, storage or allowance is an
explicit resumable blocker, not a reason to bypass admission.

Compare the same source-pinned task with the existing harness baseline. Retain the
commands, original-byte checks, meaningful mutations, result, correction effort,
duration and actual known allowance consumption. Scripts execute emulator loops;
models inspect selected derived evidence. Keep private media and raw memory local.
Use #779's handoff contracts for cooperation; a prepared profile is not a completed
research experiment or a running factory.

## References

- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [OpenCode Go plans, supported clients and limits](https://opencode.ai/docs/go/)
- [MiniMax pricing](https://platform.minimax.io/docs/pricing/overview)
- [DeepSeek pricing and current model names](https://api-docs.deepseek.com/quick_start/pricing/)
- [Factory location and framework evaluation](LOCATION-AND-EVALUATION.md)
