// Original integration preflight, NOT the missing supplied bridge test suite.
// Includes the unmodified pinned upstream headers using a full C++ standard library.
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <string>
#include "dice/hfe/io/PlayerInput.hpp"
#include "dice/hfe/VariableStorage.hpp"

int main() {
    using dice::hfe::io::PlayerInput;
    using dice::hfe::io::PlayerInputMap;
    PlayerInput players[6]{};
    unsigned checks = 0;
    for (unsigned slot = 0; slot < 6; ++slot) {
        for (unsigned channel = 0; channel < 64; ++channel) {
            const auto key = static_cast<PlayerInputMap>(channel);
            if (players[slot].getInput(key) != nullptr) return 1;
            const float value = static_cast<float>(slot * 64 + channel) / 384.0f;
            players[slot].setInput(key, value);
            ++checks;
        }
    }
    for (unsigned slot = 0; slot < 6; ++slot) {
        for (unsigned channel = 0; channel < 64; ++channel) {
            auto* value = players[slot].getInput(static_cast<PlayerInputMap>(channel));
            if (!value || *value != static_cast<float>(slot * 64 + channel) / 384.0f) return 2;
            ++checks;
        }
    }
    // PINone=64 is deliberately never sent to upstream unchecked array/shift methods.
    players[0] = PlayerInput{};
    if (players[0].getInput(PlayerInputMap::PIYaw) != nullptr) return 3;
    if (players[1].getInput(PlayerInputMap::PIYaw) == nullptr) return 4;
    // These methods work in isolation. Their stored lastLookup points at an expired
    // local iterator; never dereference it. That defect requires a documented port.
    dice::hfe::VariableStorage<std::string, int32_t> settings{};
    settings.set("players", 6);
    int32_t count = 0;
    settings.get("players", count);
    if (count != 6 || !settings.exists("players")) return 5;
    settings.set("players", 5);
    settings.get("players", count);
    if (count != 5 || settings.erase("players") != 1 || settings.exists("players")) return 6;
    std::printf("UPSTREAM_COMPONENT_PREFLIGHT_PASS checks=%u slots=6 channels=64 sizeof_PlayerInput=%zu\n", checks, sizeof(PlayerInput));
    std::puts("NOT the supplied bridge suite; NOT gameplay integration; NOT a multiplayer test.");
    return 0;
}
