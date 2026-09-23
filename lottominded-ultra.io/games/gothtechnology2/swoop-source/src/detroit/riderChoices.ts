export const RIDER_CHOICES=[
  {id:'DS_Man_01',label:'Original suited man'},
  {id:'DS_Hoodie_Woman_01',label:'Woman · Detroit hoodie'},
  {id:'DS_Mascot_Suit_01',label:'Mascot · Pinstripe suit'},
  {id:'DS_Mascot_Hoodie_01',label:'Mascot · Detroit hoodie'},
] as const;
export type RiderId=typeof RIDER_CHOICES[number]['id'];
export function riderChoice(value:string|null):RiderId{return RIDER_CHOICES.find(r=>r.id===value)?.id??'DS_Man_01';}
