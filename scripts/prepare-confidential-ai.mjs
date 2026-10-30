import {build} from 'esbuild';import {copyFile} from 'node:fs/promises';
await build({entryPoints:['worker/confidential-worker.mjs'],outfile:'public/chat/confidential-worker.js',bundle:true,format:'esm',platform:'browser',minify:true,lineLimit:120});
await copyFile('node_modules/@mlc-ai/web-llm/LICENSE','public/chat/webllm-LICENSE.txt');
