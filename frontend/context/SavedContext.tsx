import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSession } from './SessionContext';
import { studentRequest, type Profile } from '../services/studentApi';

type Saved = {
    notice: string;
    loading: boolean; refresh: () => Promise<void>;
    savedCareerIds: number[]; savedProgrammeIds: number[];
    toggleCareer: (id: number) => Promise<void>; toggleProgramme: (id: number) => Promise<void>;
    isCareerSaved: (id: number) => boolean; isProgrammeSaved: (id: number) => boolean;
};
const Context = createContext<Saved | null>(null);
export function SavedProvider({ children }: PropsWithChildren) {
    const { auth } = useSession();
    const token = auth?.access_token;
    const currentToken = useRef(token); currentToken.current = token;
    const pending = useRef(new Set<string>());
    const [profile, setProfile] = useState<Profile | null>(null);
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const version = useRef(0);
    const refresh = useCallback(async () => {
        if (!token || pending.current.has(token)) return;
        const ticket = ++version.current;
        setLoading(true); setNotice('Loading saved items…');
        try {
            const result = await studentRequest<Profile>('/profile/me', token);
            if (version.current === ticket && currentToken.current === token) { setProfile(result); setNotice(''); }
        } catch (error) {
            if (version.current === ticket && currentToken.current === token) setNotice(error instanceof Error ? error.message : 'Could not load saved items. Tap Retry.');
        } finally { if (version.current === ticket) setLoading(false); }
    }, [token]);
    useEffect(() => {
        version.current++;
        setProfile(null);
        setNotice(token ? 'Loading saved items…' : 'Sign in from Profile to save items.');
        setLoading(false);
        if (token) void refresh();
        return () => { version.current++; };
    }, [token, refresh]);
    useEffect(() => {
        const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
        return () => listener.remove();
    }, [refresh]);
    const ownProfile = profile?.user.id === auth?.user.id ? profile : null;
    const savedCareerIds = ownProfile?.saved_careers.map(c => c.id) ?? [];
    const savedProgrammeIds = ownProfile?.saved_programmes.map(p => p.id) ?? [];
    async function toggle(kind: 'careers' | 'programmes', id: number) {
        if (!token) { setNotice('Open Profile and sign in to save items to your account.'); return; }
        if (!ownProfile) { await refresh(); return; }
        // Serialize profile writes so overlapping refreshes cannot restore stale saved IDs.
        const key = token;
        if (pending.current.has(key)) return;
        pending.current.add(key);
        version.current++; setLoading(false);
        setNotice('Saving…');
        try {
            const ids = kind === 'careers' ? savedCareerIds : savedProgrammeIds;
            await studentRequest('/profile/me/saved-' + kind + '/' + id, token, ids.includes(id) ? 'DELETE' : 'POST');
            const next = await studentRequest<Profile>('/profile/me', token);
            if (currentToken.current === token) { setProfile(next); setNotice(''); }
        } catch (e) { if (currentToken.current === token) setNotice(e instanceof Error ? e.message : 'Could not save. Please retry.'); }
        finally { pending.current.delete(key); }
    }
    return <Context.Provider value={{ notice, loading, refresh, savedCareerIds, savedProgrammeIds,
        toggleCareer: id => toggle('careers', id), toggleProgramme: id => toggle('programmes', id),
        isCareerSaved: id => savedCareerIds.includes(id), isProgrammeSaved: id => savedProgrammeIds.includes(id) }}>
        {children}
    </Context.Provider>;
}
export function useSaved() {
    const context = useContext(Context);
    if (!context) throw new Error('SavedProvider missing');
    return context;
}
