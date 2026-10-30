/* Rasterize only the authenticated, fixed-version self-contained evidence figure. */
(function(){
  async function png(data,expected,signal){
    const fail=()=>{throw Error("contract");};
    if(signal.aborted)throw Error("cancelled");
    if(data.byteLength>1048576)fail();
    const svg=new TextDecoder("utf-8",{fatal:true}).decode(data);
    if(/<!|<\?/.test(svg))fail();
    const doc=new DOMParser().parseFromString(svg,"image/svg+xml"),root=doc.documentElement;
    if(root.localName!=="svg"||root.namespaceURI!=="http://www.w3.org/2000/svg"||root.getAttribute("data-chart-version")!=="case-daily-chart/v1"||root.getAttribute("data-case-id")!==expected.case_id||root.getAttribute("data-case-version")!==String(expected.version)||root.getAttribute("data-case-version-id")!==expected.version_id||root.getAttribute("data-report-id")!==expected.report.report_id)fail();
    const width=Number(root.getAttribute("width")),height=Number(root.getAttribute("height"));
    if(width!==1600||!Number.isInteger(height)||height<1100||height>10000)fail();
    const tags=new Set(["svg","g","rect","line","text","circle","path"]);
    const attrs=new Set(["xmlns","width","height","viewBox","data-chart-version","data-case-id","data-case-version","data-case-version-id","data-report-id","data-axis","font-family","fill","x","y","font-size","text-anchor","x1","y1","x2","y2","stroke","stroke-width","data-date","data-state","data-hours","cx","cy","r","d"]);
    for(const element of [root,...root.querySelectorAll("*")]){
      if(!tags.has(element.tagName)||element.namespaceURI!==root.namespaceURI)fail();
      for(const attr of element.attributes){
        if(!attrs.has(attr.name)||/url\s*\(/i.test(attr.value))fail();
        if(["fill","stroke"].includes(attr.name)&&!/^#[0-9a-f]{6}$/i.test(attr.value))fail();
        if(attr.name==="font-family"&&attr.value!=="sans-serif")fail();
      }
    }
    const url=URL.createObjectURL(new Blob([data],{type:"image/svg+xml"})),picture=new Image();let abort;
    try{
      return await new Promise((resolve,reject)=>{
        abort=()=>reject(Error("cancelled"));signal.addEventListener("abort",abort,{once:true});
        picture.onerror=()=>reject(Error("chart_render_failed"));
        picture.onload=()=>{
          if(signal.aborted){abort();return;}
          try{
            const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
            const context=canvas.getContext("2d");if(!context)throw Error("chart_render_failed");
            context.drawImage(picture,0,0);
            canvas.toBlob(blob=>{
              if(signal.aborted){abort();return;}
              if(!blob||blob.type!=="image/png"||!blob.size||blob.size>8388608){reject(Error("chart_render_failed"));return;}
              resolve(blob);
            },"image/png");
          }catch{reject(Error("chart_render_failed"));}
        };
        picture.src=url;
      });
    }finally{signal.removeEventListener("abort",abort);picture.onload=null;picture.onerror=null;picture.src="";URL.revokeObjectURL(url);}
  }
  window.OceanCaseChart=Object.freeze({png});
})();
