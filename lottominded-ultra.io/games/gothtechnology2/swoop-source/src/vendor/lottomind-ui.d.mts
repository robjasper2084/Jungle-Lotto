export type SystemsContext={state:{route:string};toast:(message:string)=>void;render:()=>void};
export default function createSystemsUi(root:Record<string,unknown>):{
 renderLab():string;renderTool(route:string):string;historyRows():string;
 handleAction(action:string,target:HTMLElement,context:SystemsContext):boolean;
 handleInput(target:HTMLElement):boolean;touch(route:string):void;
};
