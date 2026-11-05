#include "input_bridge.h"
#include <dice/hfe/io/PlayerInput.hpp>

namespace {
using dice::hfe::io::PlayerInput;
using dice::hfe::io::PlayerInputMap;
// One instance per match, prediction world, or replay. This is not a shared server singleton.
// A fresh WebAssembly instance provides isolation. Native tests use one process per context.
PlayerInput inputs[6]{};
constexpr int valid(int slot, int channel) {
    return slot < 0 || slot >= 6 ? -1 : channel < 0 || channel >= 64 ? -2 : 1;
}
}
extern "C" {
int sr_abi_version() { return 1; }
int sr_capabilities() { return 1; }
int sr_slots() { return 6; }
int sr_upstream_id() { return 0x6b4d4e1f; }
int sr_clear(int slot) {
    if (slot < 0 || slot >= 6) return -1;
    // Zero payload AND flags: released buttons must not survive a frame or focus transition.
    for (int i = 0; i < 64; ++i) inputs[slot].m_inputs[i] = 0.0f;
    inputs[slot].m_flags = 0;
    return 1;
}
int sr_set(int slot, int channel, float value) {
    const int status = valid(slot, channel);
    if (status != 1) return status;
    // Check before invoking the upstream shift/array access. PINone=64 is NOT a channel.
    if (value != value || value < -1.0f || value > 1.0f) return -3;
    inputs[slot].setInput(static_cast<PlayerInputMap>(channel), value);
    return 1;
}
int sr_has(int slot, int channel) {
    const int status = valid(slot, channel);
    if (status != 1) return status;
    return inputs[slot].getInput(static_cast<PlayerInputMap>(channel)) ? 1 : 0;
}
float sr_get(int slot, int channel) {
    if (valid(slot, channel) != 1) return 2.0f;
    const float* value = inputs[slot].getInput(static_cast<PlayerInputMap>(channel));
    return value ? *value : 0.0f;
}
}
