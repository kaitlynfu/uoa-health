export function positiveId(value:unknown): number {
    const text=String(value??'');
    if(!/^[1-9]\d*$/.test(text)||!Number.isSafeInteger(Number(text))) throw new Error('Enter a positive numeric ID. Ask your classmate or group creator for it.');
    return Number(text);
}
export function messageTarget(id:unknown,isGroup:boolean,content:string) {
    const target=positiveId(id);
    if(!content.trim()||content.length>2000)throw new Error('Enter a message between 1 and 2000 characters.');
    return {...(isGroup?{group_id:target}:{recipient_id:target}),content:content.trim()};
}
