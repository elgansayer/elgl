from datetime import UTC, datetime

from openhands_factory.gated_daemon import MainCiGatedFactoryDaemon
from openhands_factory.models import Job, JobState, Task


class Gate:
    def __init__(self, green: bool) -> None:
        self.green = green
        self.calls = 0

    def is_green(self) -> bool:
        self.calls += 1
        return self.green


def _job(identifier: str, state: JobState) -> Job:
    return Job(Task(identifier, f"Task {identifier}", "Body", "github-pull-request", 5), state=state)


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
