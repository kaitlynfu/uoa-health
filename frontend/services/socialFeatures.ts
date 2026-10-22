import {studentRequest, type SocialMessage} from './studentApi.ts';
export const groupTypes = ['Exam Prep','Study Sessions','Notes Sharing','Assignments','Lab Reports','Past Papers','General Discussion','Career Support','Social','Other'] as const;
export const studyFormats = ['In Person','Online','Hybrid'] as const;
export const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
export interface GroupDraft {name:string;course:string;description:string;location:string;group_type:typeof groupTypes[number];study_format:typeof studyFormats[number];preferred_days:(typeof weekDays[number])[]}
export interface SocialGroup extends GroupDraft {id:number;created_at:string}
export interface SocialPerson {id:number;display_name:string;connection:'none'|'incoming'|'outgoing'|'friend'}
export interface FriendConnection {id:number;user:SocialPerson;created_at:string}
export interface GroupSummary extends SocialGroup {member_count:number;joined:boolean;saved:boolean;role:'admin'|'member'|null}
export interface GroupMember {user:SocialPerson;role:'admin'|'member';joined_at:string}
export interface Conversation {kind:'direct'|'group';target_id:number;name:string;last_message:SocialMessage;unread_count:number}
export const getInbox=(token:string,offset=0)=>studentRequest<Conversation[]>(`/social/messages/inbox?limit=50&offset=${offset}`,token);
export const getSavedGroups=(token:string,offset=0)=>studentRequest<SocialGroup[]>(`/social/groups/saved?limit=50&offset=${offset}`,token);
export const setGroupSaved=(token:string,id:number,saved:boolean)=>studentRequest<void>(`/social/groups/${id}/saved`,token,saved?'PUT':'DELETE');
export const createSocialGroup=(token:string,draft:GroupDraft)=>studentRequest<SocialGroup>('/social/groups',token,'POST',draft);
export const markConversationRead=(token:string,kind:'direct'|'group',id:number,through:number)=>studentRequest<void>(`/social/messages/${kind}/${id}/read`,token,'POST',{through_message_id:through});
export function socialPage<T>(token:string,path:string,offset=0){return studentRequest<T[]>(`${path}${path.includes('?')?'&':'?'}limit=50&offset=${offset}`,token);}
export const getJoinedGroups=(token:string,offset=0)=>socialPage<GroupSummary>(token,'/social/groups/joined',offset);
export const getGroupDetails=(token:string,id:number)=>studentRequest<GroupSummary>(`/social/groups/${id}`,token);
