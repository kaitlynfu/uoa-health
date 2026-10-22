import {readFile} from 'node:fs/promises';
const requirements=JSON.parse(await readFile(new URL('../release-requirements.json',import.meta.url),'utf8'));
const base=process.env.EXPO_PUBLIC_API_URL;
if(!base?.startsWith('https://'))throw new Error('Release requires the hosted HTTPS API.');
const deadline=Date.now()+10*60*1000;
while(true){
    try{
        const response=await fetch(`${base}/capabilities`,{signal:AbortSignal.timeout(15000)});
        if(response.ok){
            const capabilities=await response.json();
            if(Object.entries(requirements).every(([key,version])=>Number.isInteger(capabilities[key])&&capabilities[key]>=version)){
                console.log('Hosted backend supports this frontend release.');break;
            }
        }
    }catch{/* Backend can be restarting during its coordinated deployment. */}
    if(Date.now()>=deadline)throw new Error('Required backend APIs are not deployed. Frontend publication stopped. Deploy/rehearse the matching backend first.');
    console.log('Waiting for matching backend capabilities…');
    await new Promise(resolve=>setTimeout(resolve,15000));
}
