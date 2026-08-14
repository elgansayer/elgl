from openhands_factory.daemon import select_batch
from openhands_factory.models import Job, JobState, Task


def job(identifier: str, priority: int, state: JobState = JobState.DISCOVERED) -> Job:
    return Job(Task(identifier, f"Task {identifier}", "Body", "github-issue", priority), state)


def test_select_batch_fills_parallel_capacity_by_priority() -> None:
    jobs = {
        "12": job("12", 10),
        "10": job("10", 0),
        "11": job("11", 0),
        "9": job("9", 0, JobState.DONE),
        "8": job("8", 0, JobState.QUARANTINED),
    }

    selected = select_batch(jobs, 3)

    assert [item.task.identifier for item in selected] == ["10", "11", "12"]


def test_select_batch_refills_free_capacity_without_rescheduling_active_jobs() -> None:
    jobs = {
        "10": job("10", 0, JobState.IMPLEMENTING),
        "11": job("11", 0),
        "12": job("12", 1),
        "13": job("13", 2),
    }

    selected = select_batch(jobs, 2, {"10"})

    assert [item.task.identifier for item in selected] == ["11", "12"]
