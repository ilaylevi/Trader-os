import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ConsoleMessage } from "@trader-os/shared";

const dataDir = resolve(process.env.DATA_DIR ?? "/app/data");
const memoryPath = resolve(dataDir, "trader-memory.json");
const consolePath = resolve(dataDir, "strategy-console-history.json");

export interface TraderMemory {
  version: 2;
  doctrine: string[];
  commands: Record<string, string>;
  notes: string[];
}

const defaultMemory: TraderMemory = {
  version: 2,
  doctrine: [
    "Day/Swing only; expected holding window 1–3 days.",
    "Capital preservation and risk management come before profit maximization.",
    "Use Market → Sector → Stock before approving an entry.",
    "Never chase price. A setup must have a defined stop and acceptable risk/reward.",
    "Data quality, event risk, portfolio risk and market regime can veto a technical setup.",
    "Never fabricate market data, events, fills, broker state or execution.",
    "Trader OS is deterministic: every verdict must be traceable to explicit rules and measured gates.",
  ],
  commands: {
    "סריקת שוק": "Fresh two-stage scan in Market → Sector → Stock order, then risk context.",
    "מצא עסקה עכשיו": "Return the strongest deterministic Day/Swing setup without relaxing risk gates.",
    "הכנה לפתיחה": "Build a deterministic pre-market/session brief and ARMED shortlist.",
    "בדיקת כניסה": "Run the complete pre-trade gate for the requested ticker.",
    "נהל": "Run deterministic management checkpoints against the original trade plan.",
    "סיכון תיק": "Show total risk, correlation/factor warnings and remaining capacity.",
    "בוא נפתח עסקה": "Create a local PLANNED trade only when a valid deterministic plan exists; never claim broker execution.",
  },
  notes: [],
};

function ensureDir(){ mkdirSync(dirname(memoryPath),{recursive:true}); }
export function getTraderMemory(): TraderMemory {
  ensureDir();
  if(!existsSync(memoryPath)){ writeFileSync(memoryPath,JSON.stringify(defaultMemory,null,2)); return structuredClone(defaultMemory); }
  try { const x=JSON.parse(readFileSync(memoryPath,"utf8")) as Partial<TraderMemory>; return {...defaultMemory,...x,version:2,doctrine:Array.isArray(x.doctrine)?x.doctrine:defaultMemory.doctrine,commands:{...defaultMemory.commands,...(x.commands??{})},notes:Array.isArray(x.notes)?x.notes:[]}; }
  catch { return structuredClone(defaultMemory); }
}
export function saveTraderMemory(memory:TraderMemory){ ensureDir(); writeFileSync(memoryPath,JSON.stringify(memory,null,2)); return memory; }
export function addMemoryNote(note:string){ const m=getTraderMemory(),clean=note.trim(); if(clean&&!m.notes.includes(clean))m.notes.push(clean);m.notes=m.notes.slice(-100);return saveTraderMemory(m); }
export function getConsoleHistory():ConsoleMessage[]{ ensureDir(); if(!existsSync(consolePath))return[]; try{const x=JSON.parse(readFileSync(consolePath,"utf8")) as ConsoleMessage[];return Array.isArray(x)?x.slice(-60):[]}catch{return[]} }
export function appendConsoleMessage(message:ConsoleMessage){ const history=[...getConsoleHistory(),message].slice(-60);writeFileSync(consolePath,JSON.stringify(history,null,2));return history; }
export function clearConsoleHistory(){ensureDir();writeFileSync(consolePath,"[]\n");}
