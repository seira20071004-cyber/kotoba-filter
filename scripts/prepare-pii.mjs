import {build} from 'esbuild';import {mkdir,copyFile,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
await build({entryPoints:['worker/pii-worker.mjs'],outfile:'public/chat/pii-worker.js',bundle:true,format:'esm',platform:'browser',conditions:['browser'],minify:true,lineLimit:120});
const target='public/chat/ort';await mkdir(target,{recursive:true});for(const file of await readdir(target))await unlink(target+'/'+file);
await copyFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',target+'/ort-wasm-simd-threaded.asyncify.mjs');
const binary=await readFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm'),partSize=16*1024*1024;for(let start=0,i=0;start<binary.length;start+=partSize,i++)await writeFile(target+'/runtime.part'+i,binary.subarray(start,start+partSize));
await writeFile(target+'/runtime.json',JSON.stringify({bytes:binary.length,parts:Math.ceil(binary.length/partSize)}));
await copyFile('node_modules/@huggingface/transformers/LICENSE','public/chat/transformers-LICENSE.txt');
