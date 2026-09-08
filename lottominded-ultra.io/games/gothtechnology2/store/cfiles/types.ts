export type CaseFile={id:string;title:string;year:number;event_date:string;timezone:string;location:string;lat:number|null;lon:number|null;location_note?:string;event_type:string;witness_type:string;credibility:string;narrative:string;gear:string;source_name?:string;source_url?:string;status:string;created_at:string;author_id?:string};
export type User={id:string;name:string;email:string;role:string};
export const eventTypes=['Sighting','Physical trace','Reported abduction','Astronomical event','Other'];
export const evidenceStatuses=['Unreviewed','Source documented','Insufficient data','Explanation proposed'];
