import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {socialPage} from '../services/socialFeatures';

export function useSocialPage<T>(token:string|undefined,path:string|null){
    const [items,setItems]=useState<T[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
    const epoch=useRef(0),working=useRef(false);
    const load=useCallback(async(offset:number,version:number)=>{
        if(!token||!path||working.current)return;
        working.current=true;setBusy(true);setError('');
        try {
            const next=await socialPage<T>(token,path,offset);
            if(epoch.current===version){setItems(previous=>offset?[...previous,...next]:next);setMore(next.length===50);}
        }catch(e){if(epoch.current===version)setError((e as Error).message);}
        finally{if(epoch.current===version){setBusy(false);working.current=false;}}
    },[token,path]);
    useFocusEffect(useCallback(()=>{
        const version=++epoch.current;working.current=false;setItems([]);setMore(false);setError('');setBusy(!!token&&!!path);
        void load(0,version);
        return()=>{epoch.current++;working.current=false;};
    },[load,token,path]));
    return {items,busy,error,more,refresh:()=>load(0,epoch.current),loadMore:()=>load(items.length,epoch.current)};
}
