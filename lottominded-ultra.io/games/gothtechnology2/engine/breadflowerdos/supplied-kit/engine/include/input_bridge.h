#pragma once
// Stable scalar C ABI: never export upstream pointers, unions, or memory layouts.
#ifdef __cplusplus
extern "C" {
#endif
int sr_abi_version(void);
int sr_capabilities(void); // bit 0 = input bridge ONLY. No physics/combat/network bits.
int sr_slots(void);
int sr_upstream_id(void);
int sr_clear(int slot);             // 1 success; -1 invalid slot
int sr_set(int slot, int channel, float value); // -2 channel; -3 nonfinite/out of range
int sr_has(int slot, int channel);  // 0 absent, 1 present; negative = error
float sr_get(int slot, int channel); // 0 if absent; 2 (outside valid range) if invalid
#ifdef __cplusplus
}
#endif
