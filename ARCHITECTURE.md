# Logician Architecture

Logician is organized around deterministic simulation playback.

- Algorithms are pure plugins. They receive domain input and emit typed `StepEvent` objects plus a final `SimulationResult`.
- `TimelineEngine` owns playback position and timestamped entries. It does not derive UI state.
- `StateEngine` implementations convert events into diffs and apply those diffs to reconstruct visual state.
- Domain runners connect a plugin, a state engine, and UI listeners. They also derive compact snapshots for controls.
- React components render snapshots and visual state only; algorithm decisions stay outside the UI layer.
- Interactive teaching tools, such as Predict Mode and the event inspector, sit at the UI/runner boundary. They can peek at the next deterministic event or jump to timeline indices, but they do not mutate algorithm output.

The teaching layer lives in `StepEvent`:

- `explanation.what` says what happened.
- `explanation.why` explains the reasoning.
- `explanation.impact` describes state changes.
- `explanation.next` previews the next expected move when useful.
- `decision` records considered options, the chosen option, and the reasoning.
- `insightTags` mark the key idea being applied at that moment.

Advanced controls:

- Predict Mode uses `peekNextStep()` to ask for the next decision before replay advances.
- The event inspector is derived from recent emitted events and milestone indices.
- Bookmarks are UI-local; replay correctness remains fully owned by `TimelineEngine`.
