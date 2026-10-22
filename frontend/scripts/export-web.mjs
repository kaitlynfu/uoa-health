// Build the same reviewed app for the existing API server's /app/ URL.
import {spawnSync, execFileSync} from 'node:child_process';
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const api=process.env.EXPO_PUBLIC_API_URL;
if(api!=='https://team43-api.3-27-96-180.sslip.io') throw new Error('Web tester build requires the reviewed hosted API URL.');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA && commit!==process.env.GITHUB_SHA) throw new Error('Checkout differs from the requested release.');
const env={...process.env,EXPO_NO_DOTENV:'1'};
delete env.EXPO_NO_CLIENT_ENV_VARS;
const result=spawnSync(process.execPath,[path.join(cwd,'node_modules/expo/bin/cli'),'export','--platform','web','--output-dir','dist-web'],{cwd,env,stdio:'inherit'});
if(result.error) throw result.error;
if(result.status!==0) process.exit(result.status??1);
const out=path.join(cwd,'dist-web');
const config=JSON.parse(await readFile(path.join(cwd,'app.json'),'utf8')).expo;
await copyFile(path.join(cwd,'assets/uoa-health-icon.png'),path.join(out,'icon.png'));
await writeFile(path.join(out,'manifest.json'),JSON.stringify({name:config.name,short_name:config.name,start_url:'/app/',scope:'/app/',display:'standalone',background_color:'#ffffff',theme_color:'#007D83',icons:[{src:'/app/icon.png',sizes:'1024x1024',type:'image/png',purpose:'any'}]},null,2));
const htmlPath=path.join(out,'index.html');
const html=await readFile(htmlPath,'utf8');
await writeFile(htmlPath,html.replace('</head>','<link rel="manifest" href="/app/manifest.json"/><link rel="apple-touch-icon" href="/app/icon.png"/><meta name="theme-color" content="#007D83"/><meta name="apple-mobile-web-app-capable" content="yes"/></head>'));
await writeFile(path.join(out,'build-info.json'),JSON.stringify({commit,version:config.version,api,builtAt:new Date().toISOString()},null,2));
console.log('Browser app exported for /app/ from '+commit);
