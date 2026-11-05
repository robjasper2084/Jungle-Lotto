#include "input_bridge.h"
#include <cstdio>
#include <limits>

#define REQUIRE(x) do { if (!(x)) { std::fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#x); return 1; } } while (0)
int main() {
    REQUIRE(sr_abi_version() == 1 && sr_capabilities() == 1 && sr_slots() == 6);
    for (int s = 0; s < 6; ++s) {
        REQUIRE(sr_clear(s) == 1);
        for (int c = 0; c < 64; ++c) {
            REQUIRE(sr_has(s,c) == 0);
            REQUIRE(sr_get(s,c) == 0);
            float v = static_cast<float>((s+c)%5 - 2) / 2;
            REQUIRE(sr_set(s,c,v) == 1);
            REQUIRE(sr_has(s,c) == 1 && sr_get(s,c) == v);
        }
    }
    // All channels in all six slots remain independent.
    for (int s=0;s<6;++s) for (int c=0;c<64;++c)
        REQUIRE(sr_get(s,c)==static_cast<float>((s+c)%5-2)/2);
    REQUIRE(sr_set(0,64,1)==-2); // prevent out-of-bounds access and 64-bit shift UB
    REQUIRE(sr_set(0,-1,1)==-2);
    REQUIRE(sr_set(6,8,1)==-1 && sr_set(-1,8,1)==-1);
    REQUIRE(sr_set(0,8,std::numeric_limits<float>::quiet_NaN())==-3);
    REQUIRE(sr_set(0,8,std::numeric_limits<float>::infinity())==-3);
    REQUIRE(sr_set(0,8,-std::numeric_limits<float>::infinity())==-3);
    REQUIRE(sr_set(0,8,1.01f)==-3 && sr_set(0,8,-1.01f)==-3);
    REQUIRE(sr_has(6,0)==-1 && sr_has(0,64)==-2 && sr_get(6,0)==2);
    REQUIRE(sr_clear(6)==-1);
    REQUIRE(sr_clear(0)==1);
    for(int c=0;c<64;++c) REQUIRE(sr_has(0,c)==0 && sr_get(0,c)==0);
    REQUIRE(sr_has(1,8)==1); // another player was not cleared
    REQUIRE(sr_set(0,8,0)==1 && sr_has(0,8)==1 && sr_get(0,8)==0);
    std::puts("PASS: upstream input round trips, all 6x64 channels, invalid inputs, slot isolation, and release/reset.");
}
