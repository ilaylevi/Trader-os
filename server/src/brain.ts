import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const brainPath = process.env.TRADER_BRAIN_PATH ? resolve(process.env.TRADER_BRAIN_PATH) : resolve(__dirname, "../../brain/trader-brain.json");

export type TraderBrain = {
  version: number;
  identity: string;
  style: Record<string, string>;
  principles: string[];
  decisionProcess: string[];
  entryGate: { mustHave: string[]; preferred: string[] };
  tradeManagement: { rules: string[] };
  commands: Record<string, string>;
  localTradeWritePolicy: { explicitOpenPhrases: string[]; behavior: string; fillIntegrity: string; actualFill: string };
  communication: Record<string, string>;
  sourceInfluences: string[];
  adaptiveLearning?: { minimumCompletedSamples:number; positiveAdjustmentCap:number; negativeAdjustmentCap:number; policy:string };
};

let cached: TraderBrain | null = null;
export function getTraderBrain(): TraderBrain {
  if (!cached) cached = JSON.parse(readFileSync(brainPath, "utf8")) as TraderBrain;
  return structuredClone(cached);
}

export function strategyRulesSummary() {
  const b = getTraderBrain();
  return {
    version: b.version,
    identity: b.identity,
    style: b.style,
    principles: b.principles,
    decisionProcess: b.decisionProcess,
    entryGate: b.entryGate,
    tradeManagement: b.tradeManagement,
    commands: b.commands,
    localTradeWritePolicy: b.localTradeWritePolicy,
    communication: b.communication,
    adaptiveLearning: b.adaptiveLearning,
    externalAi: false,
    modelCostUsd: 0,
  };
}
