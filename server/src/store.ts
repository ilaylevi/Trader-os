import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createRequire } from "node:module";

export const dataDir = resolve(process.env.DATA_DIR ?? "/app/data");
const backend=(process.env.STORAGE_BACKEND??"sqlite").toLowerCase();
let db:any=null,sqliteError:string|undefined;
function ensureDataDir(){mkdirSync(dataDir,{recursive:true})}
function getDb(){if(backend!=="sqlite")return null;if(db)return db;if(sqliteError)return null;try{ensureDataDir();const require=createRequire(import.meta.url),{DatabaseSync}=require("node:sqlite") as any;db=new DatabaseSync(resolve(dataDir,"trader-os.db"));db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);");return db}catch(e){sqliteError=e instanceof Error?e.message:String(e);return null}}
function docKey(path:string){const r=relative(dataDir,resolve(path));return r.startsWith("..")?resolve(path):r}
export function storageStatus(){return{backend:getDb()?"sqlite":"json",requested:backend,sqliteError,database:getDb()?resolve(dataDir,"trader-os.db"):undefined}}

export function dataPath(name: string) { return resolve(dataDir, name); }
export function ensureParent(path: string) { mkdirSync(dirname(path), { recursive: true }); }

export function readJsonFile<T>(path: string, fallback: T): T {
  ensureParent(path);const database=getDb();
  if(database){try{const row=database.prepare("SELECT json FROM documents WHERE key=?").get(docKey(path)) as {json?:string}|undefined;if(row?.json)return JSON.parse(row.json) as T;
      // Lazy migration from previous JSON-backed versions.
      if(existsSync(path)){const value=JSON.parse(readFileSync(path,"utf8")) as T;writeJsonFile(path,value);return structuredClone(value)}
      writeJsonFile(path,fallback);return structuredClone(fallback)}catch{return structuredClone(fallback)}}
  try {if (!existsSync(path)) { writeJsonFile(path, fallback); return structuredClone(fallback); }return JSON.parse(readFileSync(path, "utf8")) as T;} catch {return structuredClone(fallback);}
}

export function writeJsonFile<T>(path: string, value: T): T {
  ensureParent(path);const database=getDb(),json=JSON.stringify(value,null,2);
  if(database){database.exec("BEGIN IMMEDIATE");try{database.prepare("INSERT INTO documents(key,json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at").run(docKey(path),json,new Date().toISOString());database.exec("COMMIT")}catch(e){try{database.exec("ROLLBACK")}catch{}throw e}return value}
  const tmp = `${path}.tmp`;writeFileSync(tmp,json);renameSync(tmp,path);return value;
}
export function uid(prefix: string) {return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;}
export function isoNow() { return new Date().toISOString(); }
export function isoDay(date = new Date(), timeZone = "America/New_York") {const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";return `${get("year")}-${get("month")}-${get("day")}`;}
export function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
