# AppSelect convergence boundary

`AppSelectComponent` intentionally retains the platform-native `<select>` element for mobile picker behavior and built-in keyboard/screen-reader semantics.

It is still part of the Relay/Spartan component system: product colour, spacing and state styling must use Relay semantic tokens, and it must not introduce a second focus or interaction model. When a generated Spartan Select can replace this boundary without regressing native mobile picker behavior, that migration should happen here once and all feature consumers will inherit it.
