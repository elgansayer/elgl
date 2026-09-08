from datetime import UTC, datetime
from types import SimpleNamespace

from openhands_factory.gated_daemon import MainCiGatedFactoryDaemon
from openhands_factory.models import Job, JobState, Task


class Gate:
    def __init__(self, green: bool) -> None:
        self.green = green
        self.calls = 0

    def is_green(self) -> bool:
        self.calls += 1
        return self.green


class MergeRecorder:
    def __init__(self) -> None:
        self.merges: list[tuple[int, str]] = []

    def __call__(self, pull_request: int, expected_head_sha: str) -> None:
        self.merges.append((pull_request, expected_head_sha))


class AdmissionSlots:
    def __init__(self, slots: int | None) -> None:
        self.slots = slots

    def available_slots(self, now: datetime | None = None) -> int | None:
        del now
        return self.slots


class IssueCollector:
    def __init__(self, tasks: list[Task]) -> None:
        self.tasks = tasks
        self.calls: list[int] = []

    def __call__(self, limit: int) -> list[Task]:
        self.calls.append(limit)
        return list(self.tasks)


def _job(identifier: str, state: JobState) -> Job:
    task = Task(identifier, f"Task {identifier}", "Body", "github-pull-request", 5)
    return Job(task, state=state)


def _task(identifier: str, source: str) -> Task:
    return Task(identifier, f"Task {identifier}", "Body", source, 10)


def test_daemon_only_queries_main_ci_when_batch_contains_a_merge() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(False)
    daemon.main_merge_gate = gate
    review = _job("1", JobState.REVIEWING)

    def original(*args: object, **kwargs: object) -> list[Job]:
        del args, kwargs
        return [review]

    selected = daemon._gated_select_batch(original, {"1": review}, 1)

    assert selected == [review]
    assert gate.calls == 0


def test_daemon_fences_merge_batch_when_current_main_is_not_green() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(False)
    daemon.main_merge_gate = gate
    merge_one = _job("1", JobState.MERGE_QUEUED)
    review = _job("2", JobState.REVIEWING)
    merge_two = _job("3", JobState.MERGE_QUEUED)

    def original(*args: object, **kwargs: object) -> list[Job]:
        del args, kwargs
        return [merge_one, review, merge_two]

    selected = daemon._gated_select_batch(
        original,
        {"1": merge_one, "2": review, "3": merge_two},
        3,
        now=datetime.now(UTC),
    )

    assert selected == [review]
    assert gate.calls == 1


def test_daemon_schedules_at_most_one_merge_from_green_main() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(True)
    daemon.main_merge_gate = gate
    merge_one = _job("1", JobState.MERGE_QUEUED)
    review = _job("2", JobState.REVIEWING)
    merge_two = _job("3", JobState.MERGE_QUEUED)

    def original(*args: object, **kwargs: object) -> list[Job]:
        del args, kwargs
        return [merge_one, review, merge_two]

    selected = daemon._gated_select_batch(
        original,
        {"1": merge_one, "2": review, "3": merge_two},
        3,
    )

    assert selected == [merge_one, review]
    assert gate.calls == 1


def test_daemon_does_not_schedule_second_merge_while_first_is_in_flight() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(True)
    daemon.main_merge_gate = gate
    active_merge = _job("1", JobState.MERGE_QUEUED)
    waiting_merge = _job("2", JobState.MERGE_QUEUED)
    repair = _job("3", JobState.REPAIRING)

    def original(*args: object, **kwargs: object) -> list[Job]:
        del args, kwargs
        return [waiting_merge, repair]

    selected = daemon._gated_select_batch(
        original,
        {"1": active_merge, "2": waiting_merge, "3": repair},
        2,
        excluded_task_ids={"1"},
    )

    assert selected == [repair]
    assert gate.calls == 0


def test_daemon_fences_merge_execution_when_current_main_is_not_green() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(False)
    daemon.main_merge_gate = gate
    merge = MergeRecorder()

    daemon._gated_merge_pull_request(merge, 77, "reviewed-head")

    assert merge.merges == []
    assert gate.calls == 1


def test_daemon_executes_merge_after_current_main_is_reverified() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    gate = Gate(True)
    daemon.main_merge_gate = gate
    merge = MergeRecorder()

    daemon._gated_merge_pull_request(merge, 77, "reviewed-head")

    assert merge.merges == [(77, "reviewed-head")]
    assert gate.calls == 1


def test_issue_refresh_reuses_cached_backlog_while_admission_is_full() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    cached_issue = _task("101", "github-issue")
    cached_pull_request = _task("202", "github-pull-request")
    daemon.issue_admission = AdmissionSlots(0)
    daemon.pipeline = SimpleNamespace(
        tasks=SimpleNamespace(cached=lambda: [cached_issue, cached_pull_request])
    )
    collector = IssueCollector([_task("303", "github-issue")])

    tasks = daemon._collect_open_issues_for_refresh(
        collector,
        now=datetime(2026, 8, 31, tzinfo=UTC),
    )

    assert tasks == [cached_issue]
    assert collector.calls == []


def test_issue_refresh_hits_github_when_admission_slot_opens() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    fresh_issue = _task("303", "github-issue")
    daemon.issue_admission = AdmissionSlots(1)
    daemon.pipeline = SimpleNamespace(tasks=SimpleNamespace(cached=lambda: []))
    collector = IssueCollector([fresh_issue])

    tasks = daemon._collect_open_issues_for_refresh(
        collector,
        limit=777,
        now=datetime(2026, 8, 31, tzinfo=UTC),
    )

    assert tasks == [fresh_issue]
    assert collector.calls == [777]


def test_issue_refresh_keeps_full_scan_when_admission_limit_is_disabled() -> None:
    daemon = object.__new__(MainCiGatedFactoryDaemon)
    fresh_issue = _task("404", "github-issue")
    daemon.issue_admission = AdmissionSlots(None)
    daemon.pipeline = SimpleNamespace(tasks=SimpleNamespace(cached=lambda: []))
    collector = IssueCollector([fresh_issue])

    tasks = daemon._collect_open_issues_for_refresh(
        collector,
        now=datetime(2026, 8, 31, tzinfo=UTC),
    )

    assert tasks == [fresh_issue]
    assert collector.calls == [10_000]
