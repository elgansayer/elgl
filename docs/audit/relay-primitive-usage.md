> hellotalk-workspace@1.0.0 report:relay-primitive-usage
> node scripts/report-relay-primitive-usage.mjs

# Relay primitive usage audit

Primitive families: 20
Families with external consumers: 19
Families with no detected external consumer: 1

| Primitive         | Selectors                                                                                           | Source files | External consumers |
| ----------------- | --------------------------------------------------------------------------------------------------- | -----------: | -----------------: |
| audio-equalizer   | app-audio-equalizer                                                                                 |            1 |                  2 |
| button-primary    | app-button-primary                                                                                  |            1 |                 40 |
| button-secondary  | app-button-secondary                                                                                |            1 |                 30 |
| card              | app-card                                                                                            |            1 |                 49 |
| chip              | app-chip                                                                                            |            1 |                 14 |
| empty-state       | app-empty-state                                                                                     |            1 |                 34 |
| fluency-indicator | app-fluency-indicator                                                                               |            1 |                  2 |
| gradient-button   | app-gradient-button                                                                                 |            1 |                  6 |
| input             | app-input                                                                                           |            1 |                  7 |
| language-picker   | app-language-picker                                                                                 |            2 |                  9 |
| loading           | app-loading-indicator, app-loading-state-panel, app-progress-bar, app-skeleton, ngx-skeleton-loader |            6 |                  1 |
| lottie-player     | app-lottie-player                                                                                   |            1 |                  0 |
| no-network-banner | app-no-network-banner                                                                               |            1 |                  2 |
| pill              | app-pill                                                                                            |            1 |                 13 |
| scrollable-pills  | app-scrollable-pills                                                                                |            1 |                  8 |
| select            | app-select                                                                                          |            1 |                  3 |
| skeleton-loader   | app-skeleton-loader                                                                                 |            1 |                 28 |
| textarea          | app-textarea                                                                                        |            1 |                  3 |
| toast             | app-toast                                                                                           |            1 |                  2 |
| typing-indicator  | app-typing-indicator                                                                                |            1 |                  3 |

## No detected external consumer

- lottie-player (app-lottie-player)

These are review candidates, not automatic deletion candidates. Dynamic rendering, barrel exports, tests and future/public API use can make a static zero-consumer result legitimate.
