# open-dashboard-mcp 1.0.0

## Contract and migration

1.0 introduces `dashboard_contract`, which reports `schema_version`, the installed `package_version`, and field/tool deprecations. This release is the first release with that mechanism, so it could not warn consumers before the 0.9-to-1.0 changes. The notices for those changes are therefore retrospective; this is the one exception to the normal announce-before-removal rule.

From this release onward, a field or tool will be announced before removal. A notice always names `replaced_by`, or gives a plain `reason` when the capability is gone. If the removal release is known but not dateable, `removed_in` is `unknown`, never a guessed version.

## Breaking response changes

- Scalar and nested `pricing`/`prices` response fields are removed rather than repurposed.
- Consumers should read `pricePoints`, `pricingState`, and `pricingNote`.
- Price points carry exact decimal amounts, explicit units and conditions, source read timestamps, and provenance.
- Normalized figures carry `value`, `unit`, `assumption`, and `derived_from`.
- Price comparisons return all compatible points or an explicit refusal for incompatible units or conditions.

## New operational contracts

- `OPEN_DASHBOARD_TOOLS` and `OPEN_DASHBOARD_PROVIDERS` are install-time allowlists. Deselected tools are absent from MCP discovery.
- `dashboard_speed` distinguishes published claims, measured observations, and unknowns. Its measured protocol is four streamed runs at 700 max tokens, discarding the first and reporting median/min/max over the remaining three.
- Crazyrouter discounts remain per-model and retain their own derived provenance; no global discount is inferred.

