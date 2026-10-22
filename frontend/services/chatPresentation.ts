import type {SocialMessage} from './studentApi';

export function mergeMessages(current: SocialMessage[], incoming: SocialMessage[]): SocialMessage[] {
    const rows = new Map(current.map(message => [message.id, message]));
    for (const message of incoming) rows.set(message.id, message);
    return [...rows.values()].sort((a, b) => a.id - b.id);
}
export function messageDate(raw: string): string {
    // API stores UTC; SQLite may serialize it without a timezone suffix.
    const value = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`);
    return Number.isNaN(value.getTime()) ? '' : value.toLocaleString(undefined,
        {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
}
