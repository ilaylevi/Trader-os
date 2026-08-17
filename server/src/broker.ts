import type { ActiveTrade, BrokerSnapshot, StagedOrder } from "@trader-os/shared";
import { getActiveTrades } from "./portfolio.js";
import { dataPath, isoNow, readJsonFile, uid, writeJsonFile } from "./store.js";

interface BrokerState { snapshot: BrokerSnapshot; stagedOrders: StagedOrder[] }
const broker=(process.env.BROKER_NAME??"IBI").trim();
const path=dataPath("broker-state.json");
const empty:BrokerState={snapshot:{broker,mode:"STAGED_ONLY",positions:[],orders:[],source:"none"},stagedOrders:[]};
function load(){const s=readJsonFile<BrokerState>(path,empty);s.snapshot.broker=broker;return s}
function save(s:BrokerState){s.stagedOrders=s.stagedOrders.slice(0,500);return writeJsonFile(path,s)}

export function getBrokerState(){return load()}
export function importBrokerSnapshot(input:{cashUsd?:number;positions?:BrokerSnapshot["positions"];orders?:Array<Record<string,unknown>>;source?:string}){const s=load();s.snapshot={broker,mode:"READ_ONLY",syncedAt:isoNow(),cashUsd:input.cashUsd,positions:Array.isArray(input.positions)?input.positions:[],orders:Array.isArray(input.orders)?input.orders:[],source:input.source??"manual_read_only_import"};save(s);return s.snapshot}
export function clearBrokerSnapshot(){const s=load();s.snapshot={broker,mode:"STAGED_ONLY",positions:[],orders:[],source:"none"};save(s);return s.snapshot}

function order(input:Omit<StagedOrder,"id"|"createdAt"|"status"|"broker">):StagedOrder{return{id:uid("ord"),createdAt:isoNow(),status:"STAGED",broker,...input}}
export function stageOrdersForTrade(trade:ActiveTrade){const s=load();const qty=Math.max(0,Math.floor(trade.quantity||0));if(qty<=0)throw new Error("trade_quantity_required_to_stage_orders");const staged:StagedOrder[]=[];
  if(trade.executionState==="PLANNED"&&trade.entry)staged.push(order({symbol:trade.symbol,side:trade.side==="LONG"?"BUY":"SELL",quantity:qty,orderType:"LIMIT",limitPrice:trade.entry,purpose:"ENTRY",tradeId:trade.id,notes:"Staged only — confirm/send manually in broker."}));
  if(trade.stop)staged.push(order({symbol:trade.symbol,side:trade.side==="LONG"?"SELL":"BUY",quantity:qty,orderType:"STOP",stopPrice:trade.stop,purpose:"STOP",tradeId:trade.id,notes:"Protective stop — staged only."}));
  const tp1Qty=trade.tp1?Math.max(1,Math.floor(qty/2)):0; if(trade.tp1&&tp1Qty>0)staged.push(order({symbol:trade.symbol,side:trade.side==="LONG"?"SELL":"BUY",quantity:tp1Qty,orderType:"LIMIT",limitPrice:trade.tp1,purpose:"TP1",tradeId:trade.id}));
  const tp2Qty=trade.tp2?Math.max(1,qty-tp1Qty):0;if(trade.tp2&&tp2Qty>0)staged.push(order({symbol:trade.symbol,side:trade.side==="LONG"?"SELL":"BUY",quantity:tp2Qty,orderType:"LIMIT",limitPrice:trade.tp2,purpose:"TP2",tradeId:trade.id}));
  s.stagedOrders=s.stagedOrders.filter(x=>x.tradeId!==trade.id||x.status!=="STAGED");s.stagedOrders.unshift(...staged);save(s);return staged}
export function stageOrdersByTradeId(id:string){const t=getActiveTrades().find(x=>x.id===id);if(!t)throw new Error("trade_not_found");return stageOrdersForTrade(t)}
export function updateStagedOrder(id:string,status:StagedOrder["status"]){const s=load(),o=s.stagedOrders.find(x=>x.id===id);if(!o)throw new Error("staged_order_not_found");o.status=status;save(s);return o}
export function getStagedOrders(){return load().stagedOrders}

export function brokerReconciliation(){const s=load(),local=getActiveTrades().filter(x=>x.executionState==="RECORDED"),remote=s.snapshot.positions;const symbols=new Set([...local.map(x=>x.symbol),...remote.map(x=>x.symbol)]);const differences=[...symbols].flatMap(symbol=>{const l=local.find(x=>x.symbol===symbol),r=remote.find(x=>x.symbol===symbol);const localQty=l?.quantity??0,brokerQty=r?.quantity??0;if(localQty===brokerQty)return[];return[{symbol,localQty,brokerQty,delta:brokerQty-localQty,tradeId:l?.id}]});return{broker:s.snapshot.broker,mode:s.snapshot.mode,syncedAt:s.snapshot.syncedAt,differences,inSync:differences.length===0}}
export function formatIbiInstructions(orders:StagedOrder[]){return orders.map(o=>{const price=o.orderType==="LIMIT"?`Limit ${o.limitPrice}`:o.orderType==="STOP"?`Stop ${o.stopPrice}`:o.orderType;return`${o.purpose}: ${o.side} ${o.quantity} ${o.symbol} — ${price}`}).join("\n")}
