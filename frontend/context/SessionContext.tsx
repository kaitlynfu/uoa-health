import {createContext, useContext, useEffect, useRef, useState, type PropsWithChildren} from 'react';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {ApiError, onSessionExpired, studentRequest, type Auth, type User} from '../services/studentApi';
import {decodeSession, sessionExpiry, sessionWriter} from '../services/sessionStorage';

type Preferences = {interests: string[]; career_interests: string[]};
type Session = {
    auth: Auth | null; ready: boolean; sessionNotice: string; preferences: Preferences;
    setPreferences: (value: Preferences) => void;
    login: (email: string, password: string, name?: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    updateUser: (user: User, token: string) => Promise<void>;
    logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
const key = 'student-compass.session';
// Web sessions stay in memory: no bearer tokens in localStorage.
const save = sessionWriter({
    read: () => Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(key),
    write: value => Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(key, value,
        {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
    remove: () => Platform.OS === 'web' ? Promise.resolve() : SecureStore.deleteItemAsync(key),
});
export function SessionProvider({children}: PropsWithChildren) {
    const [auth, setAuth] = useState<Auth | null>(null);
    const [ready, setReady] = useState(false), [sessionNotice, setSessionNotice] = useState('');
    const generation = useRef(0);
    const currentAuth = useRef(auth); currentAuth.current = auth;
    const [preferences, setPreferences] = useState<Preferences>({interests: [], career_interests: []});
    useEffect(()=>onSessionExpired(token=>{
        if(auth?.access_token!==token)return;
        generation.current++;currentAuth.current=null;setAuth(null);setPreferences({interests:[],career_interests:[]});
        setSessionNotice('Your sign-in expired or was revoked. Please sign in again.');
        void save(null).catch(()=>setSessionNotice('Sign-in expired. Secure storage could not be cleared.'));
    }),[auth]);
    useEffect(() => {
        let active = true;
        const version = generation.current;
        async function restore() {
            try {
                const raw = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(key);
                const saved = decodeSession(raw);
                if (!saved) { if (raw) await save(null); return; }
                try {
                    const user = await studentRequest<User>('/auth/me', saved.access_token);
                    if (active && version === generation.current) { currentAuth.current={...saved,user}; setAuth(currentAuth.current); }
                } catch (error) {
                    if (error instanceof ApiError && error.status === 401) await save(null);
                    // Keep the encrypted token on transient connection failures; don't expose
                    // private screens until the server has validated it.
                    else if (active) setSessionNotice('Could not restore sign-in. Check your connection, then reopen or sign in.');
                }
            } catch { if (active) setSessionNotice('Secure storage is unavailable. You can sign in for this session.'); }
            finally { if (active) setReady(true); }
        }
        void restore();
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!auth) return;
        const delay = Math.max(0, sessionExpiry(auth.expires_at) - Date.now());
        const timer = setTimeout(() => {
            generation.current++; currentAuth.current=null; setAuth(null); setPreferences({interests: [], career_interests: []});
            void save(null).catch(() => setSessionNotice('Sign-in expired. Secure storage could not be cleared.'));
        }, Math.min(delay, 2147483647));
        return () => clearTimeout(timer);
    }, [auth]);
    async function accept(result: Auth) {
        generation.current++; currentAuth.current=result; setAuth(result); setSessionNotice('');
        try { await save(result); }
        catch { setSessionNotice('Signed in, but secure storage failed. Sign in again after closing the app.'); }
    }
    async function login(email: string, password: string, name?: string) {
        const version = generation.current;
        const result = await studentRequest<Auth>(name === undefined ? '/auth/login' : '/auth/register', undefined, 'POST',
            {email: email.trim(), password, ...(name === undefined ? {} : {display_name: name.trim()})});
        if (version !== generation.current) throw new Error('Sign-in changed while this request was running. Please retry.');
        await accept(result); setPreferences({interests: [], career_interests: []});
    }
    async function logout() {
        const token = auth?.access_token;
        generation.current++; currentAuth.current=null; setAuth(null); setPreferences({interests: [], career_interests: []});
        // Still revoke remotely if secure storage fails, so a retained token cannot
        // restore a live session after a successful server-side sign-out.
        let storageError: unknown;
        try { await save(null); } catch (error) { storageError=error; }
        if (token) await studentRequest('/auth/logout', token, 'POST');
        if (storageError) throw new Error('Signed out, but secure storage could not be cleared.');
    }
    async function changePassword(currentPassword: string, newPassword: string) {
        if (!auth) throw new Error('Sign in to change your password.');
        const version=generation.current;
        const result=await studentRequest<Auth>('/auth/password', auth.access_token, 'POST',
            {current_password: currentPassword, new_password: newPassword});
        if (version!==generation.current) throw new Error('Password changed. Sign in again with the new password.');
        await accept(result);
    }
    async function updateUser(user: User, token: string) {
        const current = currentAuth.current;
        if (!current || current.access_token !== token || current.user.id !== user.id) return;
        const next = {...current, user};
        currentAuth.current = next; setAuth(next);
        try { await save(next); }
        catch { setSessionNotice('Profile saved. Secure sign-in storage could not be updated.'); }
    }
    return <Context.Provider value={{auth, ready, sessionNotice, preferences, setPreferences, login, logout, changePassword, updateUser}}>{children}</Context.Provider>;
}
export function useSession() {
    const value = useContext(Context);
    if (!value) throw new Error('SessionProvider missing');
    return value;
}
