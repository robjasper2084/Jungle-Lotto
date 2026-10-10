/** Original game balance. SI units; these are not real firearm specifications. */
export const COMBAT_REVISION='mounted-combat-3';
export const WEAPONS={
 static:{name:'Static Blaster',damage:20,interval:9,speed:180,gravity:9.81,inherit:1,life:180,radius:.045,ammo:80,magazine:20,pellets:1,spread:.005,reloadCommit:78,reloadEnd:120,modes:7,burstCount:3,adsTicks:14,kickYaw:.004,kickPitch:.014,recovery:5},
 heart:{name:'Heartbreaker',damage:36,interval:36,speed:110,gravity:3.5,inherit:.6,life:210,radius:.16,ammo:28,magazine:7,pellets:1,spread:.008,reloadCommit:90,reloadEnd:132,modes:1,burstCount:1,adsTicks:18,kickYaw:.008,kickPitch:.025,recovery:4},
 bass:{name:'Bass Cannon',damage:14,interval:55,speed:110,gravity:12,inherit:.8,life:30,radius:.08,ammo:18,magazine:6,pellets:4,spread:.045,reloadCommit:102,reloadEnd:150,modes:1,burstCount:1,adsTicks:22,kickYaw:.012,kickPitch:.035,recovery:3.5}
} as const;
export type Weapon=keyof typeof WEAPONS;
export const WEAPON_IDS:Weapon[]=['static','heart','bass'];
export const FIRE_MODES=['Semi','Burst','Auto'] as const;

/** Exported equipment uses +Z forward, +Y up and metres; sockets are root-local. */
export const EQUIPMENT_SOCKETS={
 weapon_grip_R:[0,-.075,0], support_grip_L:[0,-.04,.16],
 muzzle:[0,0,.52], sight_axis:[0,.105,.08], magazine_socket:[0,-.1,.12], holster_socket:[.18,1.02,-.09]
} as const;
