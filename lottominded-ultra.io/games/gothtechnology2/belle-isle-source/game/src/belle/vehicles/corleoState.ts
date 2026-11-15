export const CORLEO_ACTIONS=['IDLE','WALK','RUN','CRAWL','JUMP','MOUNT','DISMOUNT'] as const;
export type CorleoAction=typeof CORLEO_ACTIONS[number];
export const CORLEO_TRANSITION_SECONDS=12;
export type CorleoAnimationState={corleoAction?:CorleoAction;corleoTime?:number};
