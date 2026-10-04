export type LottoSystem={key:string;route:string;path:string;title:string;description:string;group:string;version:string};
declare const api:{tools:LottoSystem[];byRoute:Record<string,LottoSystem>};
export default api;
