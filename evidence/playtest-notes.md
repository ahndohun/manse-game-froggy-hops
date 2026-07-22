# Froggy Hops playtest notes

- Deterministic child-motion replay clears all three authored squat scenes and reaches the terminal celebration.
- A fresh pointer playtest on the production build recorded real squat progress from 0/2 to 1/2 and 2/2, then cleared the authored 2-, 3-, and 4-hop sequence and reached the Korean terminal celebration shown in the completion evidence.
- Pointer and camera share the same game renderer and evaluator feedback; camera pixels remain full-strength, cover-fit, mirrored, and device-local.
- Reduced-motion mode removes water drift, pulsing, and hop arcs while preserving pad state, progress, completion, captions, and restart.
- English and Korean canvas HUD, reaction, mode, and completion copy are supplied by the renderer locale factory.
