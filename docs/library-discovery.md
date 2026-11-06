# Finding a configuration from its characteristics

Library search can start with what is known about a component or assembly instead of its name. Enter a power supply, bearing model or named width, or open **Choose characteristics** to select these values directly. The live **Matching configurations** list shows actual presets with their relevant characteristics; the generic family rows remain available below it.

| Example                             | Meaning                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `12 V width <= 25`                  | A documented supply compatible with 12 V and a documented width no greater than 25 mm.                                                    |
| `3S width 60`                       | Support for a three-series-cell configuration and a documented 60 mm width. The Waveshare UPS example identifies its 60 mm **PCB width**. |
| `bearing F686-2RS`                  | A configured bearing or an explicitly recorded installed bearing model.                                                                   |
| `12 V bearing F686-2RS width <= 25` | All three constraints in one configuration; the query does not imply that such an execution exists.                                       |
| `width 20–40`                       | An inclusive width interval. Decimal commas and dots are accepted.                                                                        |

Recognized Ukrainian characteristic terms are accepted alongside English terms. A bare number remains ambiguous: typing `12` can offer separate power and width suggestions. Partial component designations such as `F68` offer actual bearing models to select. Each suggestion names its characteristic and shows a count within the current search scope. Selecting a suggestion adds a removable characteristic constraint while retaining the other query terms.

Width meanings remain explicit. A PCB width, case width, bearing width and frame diameter are different characteristics; a field labelled length or depth does not become width merely because its internal key is named `width`. Use **Width meaning** when the relevant dimension is known, and read the dimensional label on each candidate. Published discrete sizes remain discrete; a displayed source range does not invent intermediate stocked variants.

Power characteristics describe documented input or supply ratings and supported battery configurations. Output voltages, motor phase ratings and torque-test voltages do not become input supply values. A supported series-cell count does not establish a voltage without the corresponding evidence. Missing characteristics cannot satisfy an active constraint. Installed bearing facts come from the configured selector or reviewed component metadata, rather than from a generic library dependency.

All constraints must be compatible within the same preset. Search does not combine the power of one execution, the bearing of another and a third execution's width. When no configuration matches, explicit suggestions such as **Try without width** show how many candidates remain if that one constraint is removed. These suggestions retain the other characteristics; no constraint is silently discarded.

Typing, filtering and viewing suggestions leave the current preview unchanged. Click an exact configuration card to apply that preset, including its matching component choices. Selecting a constrained family row also resolves a compatible configuration instead of loading unrelated family defaults. Use **Show more configurations** to inspect additional matches.

Breadcrumb levels and collection filters also constrain discovery. Search within **Batteries & holders**, for example, cannot return a camera merely because it has a matching width. Opening a breadcrumb level clears the previous query and characteristic filters so that its complete inventory is visible, while preserving the current preview. Switching collections during a search narrows the active results. See [library structure](library-structure.md) for navigation behavior.
