# Pull Request Repair

Address only verified findings for the current pull-request head SHA. Reinspect the affected implementation
and tests, make the smallest complete repair, and rerun the failed and full applicable verification gates.
Do not force-push, discard commits, hide failures, or commit conflict markers.

