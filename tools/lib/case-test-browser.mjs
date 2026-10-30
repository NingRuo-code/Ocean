import assert from "node:assert/strict";
import {join} from "node:path";
import {readdir} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {waitFor} from "./browser-driver.mjs";

export const owner="self-authored-export-owner";
export const headers={Authorization:"Bearer "+owner,"Content-Type":"application/json"};
export async function click(c,selector){
  const point=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
}
export async function type(c,id,value){await c.evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).value=''`);await c.send("Input.insertText",{text:value});}
export async function savedCase(base,index=0){
  const item=(await(await fetch(base+"/api/query/monthly-analysis/published")).json()).results[index];
  const report=await(await fetch(base+"/api/query/monthly-analysis/published/"+encodeURIComponent(item.result_id)+"/report?projection_id="+encodeURIComponent(item.projection_id))).json();
  const response=await fetch(base+"/api/query/monthly-analysis/cases",{method:"POST",headers,body:JSON.stringify({result_id:item.result_id,projection_id:item.projection_id,report_id:report.report_id,intent_id:"8".repeat(32),title:"冻结版本导出",tags:["A,B"],note:"第一版人工笔记"})});
  assert.equal(response.status,200);return response.json();
}
export async function openCase(c,base){
  await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#workbenchToggle");await click(c,"#caseArchiveOpen");await type(c,"caseOwnerToken",owner);await click(c,"#caseLoad");
  await waitFor(c,"document.querySelectorAll('#caseItems button').length===1&&!document.getElementById('caseLoad').disabled");await click(c,"#caseItems button");
  await waitFor(c,"document.getElementById('caseArchive').dataset.state==='opened'&&!document.getElementById('caseVersion').disabled");
}
export function exportUrl(base,saved,format){return `${base}/api/query/monthly-analysis/cases/${saved.case_id}/versions/${saved.version}/exports/${format}?version_id=${encodeURIComponent(saved.version_id)}&report_id=${encodeURIComponent(saved.report.report_id)}`;}
export async function downloaded(directory,extension){
  for(let n=0;n<200;n++){const file=(await readdir(directory)).find(name=>name.endsWith(extension));if(file)return join(directory,file);await delay(50);}
  assert.fail("Browser did not download "+extension);
}

