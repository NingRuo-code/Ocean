/* Bounded, no-store public reads shared by monthly results and draft checks. */
(function () {
  function origin() {
    const mode = OFData.serverMode();
    return mode.userMode === "offline" || !mode.base ? {kind:"offline",base:null} : {kind:"server",base:mode.base};
  }
  function sameOrigin(a,b) { return a.kind === b.kind && a.base === b.base; }
  async function text(url, signal, options = {}) {
    const response = await fetch(url,{...options,cache:"no-store",credentials:"omit",signal});
    if (!response.ok) throw Error("http_"+response.status);
    // File representations retain a UTF-8 BOM; JSON alone consumes it below.
    const reader = response.body.getReader(), decoder = new TextDecoder("utf-8",{fatal:true,ignoreBOM:true});
    let size=0, text="";
    try { while (true) { const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>1048576)throw Error("budget");text+=decoder.decode(chunk.value,{stream:true}); } text+=decoder.decode(); }
    finally { await reader.cancel().catch(()=>{}); }
    return text;
  }
  async function json(url, signal, options) {return JSON.parse((await text(url,signal,options)).replace(/^\uFEFF/,""));}
  window.OceanPublicRead = Object.freeze({source:origin,sameSource:sameOrigin,json,text});
})();
