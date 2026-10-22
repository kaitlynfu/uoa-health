import {useEffect, useRef, useState} from 'react';
import {useSession} from '../context/SessionContext';
import {studentRequest, type Profile} from '../services/studentApi';
import {preferenceTerms} from '../services/preferenceHelpers';

export function usePreferenceEditor(field:'interests'|'career_interests', navigation:{goBack:()=>void}) {
    const {auth,preferences,setPreferences}=useSession();
    const [value,setValue]=useState('');
    const [loaded,setLoaded]=useState(false);
    const [busy,setBusy]=useState(false);
    const [error,setError]=useState('');
    const [attempt,retry]=useState(0);
    const alive=useRef(true);
    useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
    useEffect(()=>{
        let active=true;setLoaded(false);setError('');
        if(!auth) {setValue(preferences[field].join(', '));setLoaded(true);return;}
        studentRequest<Profile>('/profile/me',auth.access_token).then(p=>{
            if(active) {setValue(p[field].join(', '));setLoaded(true);}
        }).catch(e=>{if(active)setError(e.message);});
        return()=>{active=false;};
    },[auth,field,attempt]);
    async function save() {
        if(busy||!loaded)return;
        setBusy(true);setError('');
        try {
            const terms=preferenceTerms(value);
            if(auth) await studentRequest('/profile/me',auth.access_token,'PATCH',{[field]:terms});
            if(!alive.current)return;
            if(!auth)setPreferences({...preferences,[field]:terms});
            navigation.goBack();
        } catch(e) {if(alive.current)setError(e instanceof Error?e.message:'Could not save. Please retry.');}
        finally {if(alive.current)setBusy(false);}
    }
    return {value,setValue,loaded,busy,error,retry:()=>retry(n=>n+1),save,guest:!auth};
}
