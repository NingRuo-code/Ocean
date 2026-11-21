/* Rasterize the backend's protected SVG using the app's browser renderer. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser-driver.mjs";

const chunks=[];
let length=0;
for await(const chunk of process.stdin){
  length+=chunk.length;
  if(length>1_400_000)throw Error("Frozen figure exceeds budget");
  chunks.push(chunk);
}
const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
const library=fileURLToPath(new URL("../frontend/prototype/prototype-case-chart.js",import.meta.url));
const browser=await launchBrowser(process.argv[2]);
try{
  await browser.cdp.evaluate(await readFile(library,"utf8"));
  const rendered=await browser.cdp.evaluate(`(async(input)=>{
    const svg=Uint8Array.from(atob(input.svg),c=>c.charCodeAt(0));
    const picture=await window.OceanCaseChart.png(svg,input.expected,new AbortController().signal);
    const bytes=new Uint8Array(await picture.arrayBuffer()),chunks=[];
    for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
    return btoa(chunks.join(""));
  })(${JSON.stringify(input)})`);
  process.stdout.write(Buffer.from(rendered,"base64"));
}finally{
  await browser.close();
}
