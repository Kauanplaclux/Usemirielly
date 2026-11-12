import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compressProductPhoto,PHOTO_MAX_BYTES,prepareProductPhoto} from '../public/photo.js';

function fakeCanvas(encode){
 const calls=[];const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toBlob(callback,type,quality){calls.push({width:canvas.width,height:canvas.height,type,quality});callback(encode(canvas.width,canvas.height,type,quality));}};
 return {canvas,calls};
}
test('requests JPEG, reduces quality and keeps original aspect ratio within the upload limit',async()=>{
 const {canvas,calls}=fakeCanvas((w,h,type,q)=>new Blob([new Uint8Array(Math.ceil(w*h*q))],{type}));
 const result=await compressProductPhoto({naturalWidth:4032,naturalHeight:3024},()=>canvas);
 assert.equal(result.type,'image/jpeg');assert.ok(result.size<=PHOTO_MAX_BYTES);assert.ok(calls.length>1);assert.ok(calls.every(c=>c.type==='image/jpeg'));assert.ok(Math.abs(calls[0].width/calls[0].height-4/3)<.01);assert.equal(canvas.width,1);
});
test('PNG fallback which ignores quality is reduced by dimensions instead of rejecting a phone photo',async()=>{
 const {canvas,calls}=fakeCanvas((w,h)=>new Blob([new Uint8Array(w*h*4)],{type:'image/png'}));
 const result=await compressProductPhoto({naturalWidth:4032,naturalHeight:3024},()=>canvas);
 assert.ok(result.size<=PHOTO_MAX_BYTES);assert.ok(new Set(calls.map(c=>c.width)).size>1);assert.equal(result.type,'image/png');assert.equal(canvas.width,1);
});
test('small photos are not enlarged and failed encoders give an actionable error',async()=>{
 const small=fakeCanvas((w,h,t)=>new Blob(['small'],{type:t}));await compressProductPhoto({width:300,height:200},()=>small.canvas);assert.equal(small.calls[0].width,300);
 const bad=fakeCanvas(()=>null);await assert.rejects(()=>compressProductPhoto({width:4000,height:3000},()=>bad.canvas),/captura de tela/);assert.equal(bad.canvas.width,1);
});
test('oversized and unsupported original files are rejected before decoding',async()=>{
 await assert.rejects(()=>prepareProductPhoto({name:'photo.jpg',type:'image/jpeg',size:30000001}),/30 MB/);
 await assert.rejects(()=>prepareProductPhoto({name:'photo.heic',type:'image/heic',size:10000}),/exporte como JPG/);
});
