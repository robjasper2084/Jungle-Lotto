import {normalizeRideChoice,rideName,type RideChoice} from './rideChoice.ts';
import './rideSetup.css';
const storageKey='belle-ride-setup-v1';
export function createRideSetup(screen:HTMLElement){
 let choice=normalizeRideChoice(null);try{choice=normalizeRideChoice(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{}
 const setup=document.createElement('div');setup.className='ride-setup';
 setup.innerHTML='<fieldset class="vehicle-choice"><legend>Choose your ride</legend><div class="ride-options"><label><input type="radio" name="startup-vehicle" value="onewheel"><span><svg viewBox="0 0 64 32" aria-hidden="true"><rect x="25" y="3" width="14" height="26" rx="7"/><path d="M29 8v16m6-16v16M14 23h11m14 0h11"/></svg><strong>One wheel</strong><small>Ride the roads. Explore on foot.</small></span></label><label><input type="radio" name="startup-vehicle" value="hoverbike"><span><svg viewBox="0 0 64 32" aria-hidden="true"><path d="m14 19 13-8h12l12 8M21 19h22M30 11l-3-6h7"/><ellipse cx="14" cy="22" rx="10" ry="4"/><ellipse cx="50" cy="22" rx="10" ry="4"/></svg><strong>Hoverbike</strong><small>Lift off. Cruise over the island.</small></span></label></div></fieldset><fieldset class="camera-choice"><legend>Camera view</legend><label><input type="radio" name="startup-camera" value="fpp"><span>FPP <small>First person</small></span></label><label><input type="radio" name="startup-camera" value="tpp"><span>TPP <small>Third person</small></span></label></fieldset>';
 screen.querySelector('.cinema-actions')!.before(setup);
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(choice));}catch{}};
 const sync=()=>{setup.querySelectorAll<HTMLInputElement>('input').forEach(input=>{input.checked=input.value===(input.name==='startup-vehicle'?choice.vehicle:choice.camera);});screen.dataset.vehicle=choice.vehicle;screen.dataset.camera=choice.camera;};
 setup.addEventListener('change',()=>{choice=normalizeRideChoice({vehicle:setup.querySelector<HTMLInputElement>('input[name="startup-vehicle"]:checked')?.value,camera:setup.querySelector<HTMLInputElement>('input[name="startup-camera"]:checked')?.value});persist();sync();});sync();
 return {get choice(){return {...choice};},get name(){return rideName(choice);},setCamera(camera:RideChoice['camera']){choice={...choice,camera};persist();sync();},disable(disabled:boolean){setup.querySelectorAll('fieldset').forEach(field=>field.disabled=disabled);}};
}
