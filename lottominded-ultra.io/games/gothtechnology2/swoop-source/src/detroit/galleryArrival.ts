export const GALLERY_URL='https://robjasper2084.github.io/serengeti-gallery/';
export function galleryArrival(station:number,finish:number,offset:number,speed:number,crashed:boolean,attemptActive:boolean){
 return Number.isFinite(station)&&station>=finish&&station<=finish+11&&Math.abs(offset)<4&&Math.abs(speed)<.5&&!crashed&&!attemptActive;
}
