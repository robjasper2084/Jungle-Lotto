declare const api: {
 analyzeDailyDigits(input:string):Record<string,unknown>;
 dateMath(input:string):Record<string,unknown>;
 [key:string]: ((input:never)=>Record<string,unknown>);
};
export default api;
