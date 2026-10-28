import {open} from 'node:fs/promises';

const MAX_BYTES=16*1024*1024,MAX_DEPTH=64;
function invalid(code){return Object.assign(new Error('Invalid audit JSON'),{code});}

// Validate decoded property identities before JSON.parse can overwrite a key.
function checkKeys(text){
  const stack=[];
  for(let i=0;i<text.length;){
    const char=text[i];
    if(char==='"'){
      const start=i++;
      while(i<text.length&&text[i]!=='"'){if(text[i]==='\\')i++;i++;}
      const token=text.slice(start,++i);
      let after=i;while(/\s/.test(text[after]??'')&&after<text.length)after++;
      if(text[after]===':'&&stack.at(-1) instanceof Set){
        const key=JSON.parse(token),keys=stack.at(-1);
        if(keys.has(key))throw invalid('duplicate_json_key');
        keys.add(key);
      }
    }else{
      if(char==='{'||char==='['){stack.push(char==='{'?new Set():null);if(stack.length>MAX_DEPTH)throw invalid('json_depth_budget');}
      else if(char==='}'||char===']')stack.pop();
      i++;
    }
  }
}

export async function readAuditJson(path){
  const file=await open(path,'r'),parts=[];let size=0;
  try{
    const block=Buffer.alloc(65536);
    while(true){
      const {bytesRead}=await file.read(block,0,block.length,null);
      if(!bytesRead)break;
      size+=bytesRead;if(size>MAX_BYTES)throw invalid('json_byte_budget');
      parts.push(Buffer.from(block.subarray(0,bytesRead)));
    }
  }finally{await file.close();}
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
  checkKeys(text);
  return JSON.parse(text);
}
