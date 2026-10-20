> hellotalk-workspace@1.0.0 report:ux-system-health
> node scripts/report-ux-system-health.mjs

# UX, Spartan and Claude Design health report

Generated: 2026-10-11T22:07:43.884Z

## Stack

| Capability        | Version / configuration |
| ----------------- | ----------------------- |
| Angular           | ^22.1.1                 |
| Tailwind          | ^4.3.3                  |
| Spartan Brain     | ^1.3.2                  |
| Spartan CLI       | ^1.3.2                  |
| Helm import alias | @spartan-ng/helm        |
| Helm style        | nova                    |

## Completion

| Metric                                  | Value |
| --------------------------------------- | ----: |
| Claude Design reconciliation provenance |  100% |
| Mapped preview files present            |  100% |
| Spartan Brain ownership outside Helm    |  100% |

## Counts

| Metric                               | Count |
| ------------------------------------ | ----: |
| applicationSourceFiles               |   644 |
| nonHelmApplicationSourceFiles        |   562 |
| helmComponents                       |    12 |
| relayPrimitives                      |    20 |
| directBrainFilesOutsideHelm          |     0 |
| designSyncItems                      |    23 |
| designSyncItemsReconciled            |    23 |
| designSyncItemsPendingReconciliation |     0 |
| mappedPreviewPaths                   |    25 |
| existingMappedPreviewPaths           |    25 |
| missingGovernanceFiles               |     0 |

## Pending Claude Design reconciliation

- None

## Direct Spartan Brain imports outside owned Helm

- None

## Missing mapped previews

- None

## Missing governance files

- None
