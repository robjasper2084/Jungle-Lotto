export const LENSES=[{mm:18,name:'18 mm · Ultra wide'},{mm:35,name:'35 mm · Street'},{mm:50,name:'50 mm · Standard'},{mm:85,name:'85 mm · Portrait'},{mm:135,name:'135 mm · Telephoto'}] as const;
/** 3:2 viewfinder fits above a compact mobile control tray. */
export function captureRect(width:number,height:number){const top=62,bottom=width<700?220:140,available=Math.max(80,height-top-bottom);const w=Math.max(2,Math.min(width-32,available*1.5)),h=w/1.5;return{x:(width-w)/2,y:top+(available-h)/2,w,h};}
/** Full-frame 24 mm sensor height, correcting for the viewfinder crop. */
export function lensFov(mm:number,zoom=1,screenHeight=1,frameHeight=1){return 2*Math.atan(24/(2*Math.max(1,mm)*zoom)*screenHeight/Math.max(1,frameHeight))*180/Math.PI;}
