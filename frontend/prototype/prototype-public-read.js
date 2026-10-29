/* Bounded, no-store public reads shared by monthly results and draft checks. */
(function () {
  function origin() {
    const mode = OFData.serverMode();
    return mode.userMode === "offline" || !mode.base ? {kind:"offline",base:null} : {kind:"server",base:mode.base};
  }
  function sameOrigin(a,b) { return a.kind === b.kind && a.base === b.base; }
  async function bytes(url, signal, options = {}) {
    const response = await fetch(url,{...options,cache:"no-store",credentials:"omit",signal});
    if (!response.ok) throw Error("http_"+response.status);
    const reader = response.body.getReader(),chunks=[];
    let size=0;
    try { while (true) { const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>1048576)throw Error("budget");chunks.push(chunk.value); } }
    finally { await reader.cancel().catch(()=>{}); }
    const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
  }
  async function text(url, signal, options) {
    // File representations retain a UTF-8 BOM; JSON alone consumes it below.
    return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(await bytes(url,signal,options));
  }
  async function json(url, signal, options) {return JSON.parse((await text(url,signal,options)).replace(/^\uFEFF/,""));}
  window.OceanPublicRead = Object.freeze({source:origin,sameSource:sameOrigin,json,text,bytes});
})();
