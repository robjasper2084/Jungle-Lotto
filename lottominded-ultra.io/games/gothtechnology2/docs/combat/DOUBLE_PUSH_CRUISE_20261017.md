# Double-push cruise — local implementation

Swoop Detroit, Static Royale and Elmwood Explorer now use `ride-core/src/cruiseControl.ts` to capture the current forward wheel speed when forward input crosses the activation threshold twice within 450 ms, returning through neutral between pushes. One sustained push and small thumb jitter do not activate it. Joystick release preserves the captured speed and steering remains available. Existing Swoop/Elmwood cruise buttons also capture current speed.

Cruise uses the normal throttle/physics path, including multiplayer command validation. It is not a position or velocity override. Brake/reverse input, pause/input interruption, dismount and crash/inactive states clear the lock. Walking does not activate cruise. Each local multiplayer rider has a separate controller. A stationary wheel cannot engage cruise.

Validation on October 17:

- 35 tests passed: gesture timing, captured speed, actual RideController speed holding and turning, touch ownership, cancellation, independent Swoop split/online and Elmwood input adapters, existing split-race and Elmwood session tests.
- Swoop/Royale and Elmwood TypeScript checks passed using their merge-check configs.
- Packaged all three games through `scripts/build-riding-games.mjs`; build receipt `f29507ea-29a6-41a3-8f19-60c275841b8d`.
- Desktop browser: Swoop locked 2.6909 m/s and subsequently held 2.689 m/s with steering; brake cleared it. Royale displayed CRUISE at 57 km/h. Elmwood displayed CRUISE at 23 km/h. All three browser pages reported no console errors.
- Browser gesture checks used the equivalent double-forward keyboard input. Touch adapter tests passed; physical iPad gesture retesting remains unverified.
- Local preview: `http://127.0.0.1:8261/`. This change was not pushed or deployed by this task.

Evidence: `C:/Users/digit/Documents/phone/output/cruise-tests.log`, `cruise-swoop-types.log`, `cruise-elmwood-types.log`, `cruise-build.log`, and `cruise-swoop-20261017.png`.
