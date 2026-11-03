import {DefaultLoadingManager} from 'three';
import pins from './assetPins.json' with {type:'json'};

/** Keep the local authoring build self-contained; production uses exact committed bytes. */
export function configureAssetDelivery(){
 if(!import.meta.env.PROD||['127.0.0.1','localhost'].includes(location.hostname))return;
 const urls=new Map(pins.files.map(file=>[new URL('./'+file.path,document.baseURI).href,pins.base+file.path]));
 DefaultLoadingManager.setURLModifier(url=>urls.get(new URL(url,document.baseURI).href)??url);
}
