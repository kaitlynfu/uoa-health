import type {Auth} from './studentApi';

export interface SessionStorage {
    read(): Promise<string | null>;
    write(value: string): Promise<void>;
    remove(): Promise<void>;
}
export function sessionExpiry(raw: string): number {
    return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`);
}
export function decodeSession(raw: string | null, now = Date.now()): Auth | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        if (typeof value.access_token !== 'string' || !value.access_token ||
            typeof value.expires_at !== 'string' || !Number.isFinite(sessionExpiry(value.expires_at)) ||
            sessionExpiry(value.expires_at) <= now || !Number.isSafeInteger(value.user?.id) || value.user.id < 1 ||
            typeof value.user.display_name !== 'string' || typeof value.user.email !== 'string') return null;
        return value;
    } catch { return null; }
}

// Serialize writes so a slow sign-in cannot restore a token after sign-out.
export function sessionWriter(storage: SessionStorage) {
    let pending = Promise.resolve();
    return (auth: Auth | null) => {
        pending = pending.catch(() => {}).then(() => auth ? storage.write(JSON.stringify(auth)) : storage.remove());
        return pending;
    };
}
