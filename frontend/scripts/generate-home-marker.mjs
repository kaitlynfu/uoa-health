// Reproducible, asymmetric image-tracking target; no external image dependencies.
// Generates the exact PNG used by ARKit and embeds those same bytes in the print page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
const size = 800;
const pixels = Buffer.alloc(size * size * 3, 255);
let seed = 43991;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const palette = [[12,30,48],[27,88,115],[181,66,24],[40,40,40],[115,122,128]];
function rect(x,y,w,h,color) {
    for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) {
        if(i<0 || j<0 || i>=size || j>=size) continue;
        const p=(j*size+i)*3;
        for(let k=0;k<3;k++) pixels[p+k]=color[k];
    }
}
// Irregular clusters, multiple feature sizes, high contrast, no repeating QR grid.
for(let n=0;n<310;n++) {
    const x=18+Math.floor(random()*750), y=90+Math.floor(random()*680);
    const w=8+Math.floor(random()*44), h=8+Math.floor(random()*40);
    rect(x,y,w,h,palette[Math.floor(random()*palette.length)]);
    if(n%3===0) rect(x+4,y+4,Math.max(2,w-8),Math.max(2,h-8),[255,255,255]);
}
// Direction arrow at image-top (-Z of a horizontal ARImageAnchor).
rect(350,10,100,72,[255,255,255]);
for(let y=14;y<45;y++) rect(400-(y-14),y,2*(y-14)+1,1,[0,0,0]);
rect(389,44,23,30,[0,0,0]);
rect(18,18,65,52,[0,0,0]); rect(29,29,43,30,[255,255,255]);
rect(690,20,90,18,[181,66,24]); rect(728,20,18,58,[181,66,24]);
// Thin boundary provides an exact physical-width measurement (includes white area).
rect(0,0,size,2,[0,0,0]);rect(0,size-2,size,2,[0,0,0]);
rect(0,0,2,size,[0,0,0]);rect(size-2,0,2,size,[0,0,0]);
function crc32(bytes) {
    let crc=0xffffffff;
    for(const b of bytes) { crc^=b; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
    const name=Buffer.from(type), length=Buffer.alloc(4), crc=Buffer.alloc(4);
    length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
    return Buffer.concat([length,name,data,crc]);
}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
const rows=Buffer.alloc(size*(size*3+1));
for(let y=0;y<size;y++) pixels.copy(rows,y*(size*3+1)+1,y*size*3,(y+1)*size*3);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
const resources=fileURLToPath(new URL('../modules/wayfinder-ar/ios/Resources/',import.meta.url));
mkdirSync(resources,{recursive:true});writeFileSync(resources+'home-start-v1.png',png);
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Home start marker — print at 100%</title>
<style>@page{size:A4;margin:5mm}*{box-sizing:border-box}body{margin:0;font:14px Arial;color:#111}main{width:200mm;margin:auto}h1{font-size:20px}img{display:block;width:200mm;height:200mm}p{line-height:1.4}.controls{margin:12px}@media print{.controls{display:none}}</style>
<div class="controls"><button onclick="print()">Print marker</button> A4 portrait · scale 100% · margins 5 mm · headers/footers off</div>
<main><h1>HOME START v1 — TOP points down the clear aisle ↓ on the floor plan</h1>
<p>Print at actual size. Measure the square below: exactly <b>20 × 20 cm</b>, outer edge to outer edge. Do not use “fit to page”.</p>
<img alt="Asymmetric home start tracking marker; small black arrow marks its top" src="data:image/png;base64,${png.toString('base64')}">
<p>Place flat on the floor, square centre at the NEW red X (left-side clear aisle in Bedroom 1). Point the small black arrow at the top toward the bottom of the floor plan, along the aisle. Tape edges flat; do not cover the pattern or create a trip hazard.</p>
<p>Do not move or duplicate this marker. Scan from nearby; you do not need to stand on it. This is an AR image target, not a QR code. Keep paper flat, well lit and matte.</p></main></html>`;
writeFileSync(fileURLToPath(new URL('../../docs/home-start-marker.html',import.meta.url)),html);
console.log('Generated native marker PNG and docs/home-start-marker.html (20 cm square).');
