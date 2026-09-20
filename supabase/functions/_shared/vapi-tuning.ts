// Parametri di fine-tuning dell'assistente vocale VAPI (Radar).
// Condivisi tra edge function e pannello admin: i default qui devono restare
// allineati a src/types/vapiTuning.ts.

export interface VapiTuning {
  llmProvider: string;
  llmModel: string;
  temperature: number;
  maxTokens: number;

  voiceProvider: string;
  voiceId: string;
  voiceModel: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceStyle: number;
  voiceUseSpeakerBoost: boolean;

  transcriberProvider: string;
  transcriberModel: string;
  transcriberLanguage: string;

  firstMessage: string;
  systemPrompt: string;
  silenceTimeoutSeconds: number;
  maxDurationSeconds: number;
  backgroundSound: string;
  backchannelingEnabled: boolean;

  startSpeakingWaitSeconds: number;
  smartEndpointingEnabled: boolean;
  smartEndpointingProvider: string;

  stopSpeakingNumWords: number;
  stopSpeakingVoiceSeconds: number;
  stopSpeakingBackoffSeconds: number;

  firstMessageInterruptionsEnabled: boolean;
  smartDenoisingEnabled: boolean;
  recordingEnabled: boolean;
}

export const DEFAULT_VAPI_TUNING: VapiTuning = {
  llmProvider: "openai",
  llmModel: "gpt-4o",
  temperature: 0.2,
  maxTokens: 250,

  voiceProvider: "azure",
  voiceId: "it-IT-GiuseppeMultilingualNeural",
  voiceModel: "",
  voiceSpeed: 1.05,
  voiceStability: 0.45,
  voiceSimilarityBoost: 0.8,
  voiceStyle: 0.15,
  voiceUseSpeakerBoost: true,

  transcriberProvider: "deepgram",
  transcriberModel: "nova-3",
  transcriberLanguage: "it",

  firstMessage: "Ciao, sono Radar. Come posso aiutarti?",
  systemPrompt: "",
  silenceTimeoutSeconds: 20,
  maxDurationSeconds: 900,
  backgroundSound: "off",
  backchannelingEnabled: false,

  startSpeakingWaitSeconds: 0.3,
  smartEndpointingEnabled: true,
  smartEndpointingProvider: "livekit",

  stopSpeakingNumWords: 2,
  stopSpeakingVoiceSeconds: 0.15,
  stopSpeakingBackoffSeconds: 0.8,

  firstMessageInterruptionsEnabled: true,
  smartDenoisingEnabled: false,
  recordingEnabled: true,
};

export function mergeTuning(raw: unknown): VapiTuning {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<VapiTuning>;
  return { ...DEFAULT_VAPI_TUNING, ...t };
}

/** Costruisce il blocco voice per VAPI in base al provider scelto. */
export function buildVoiceBlock(t: VapiTuning) {
  const base: Record<string, unknown> = {
    provider: t.voiceProvider,
    voiceId: t.voiceId,
    speed: t.voiceSpeed,
  };
  if (t.voiceProvider === "11labs") {
    return {
      ...base,
      model: t.voiceModel || "eleven_turbo_v2_5",
      language: "it",
      stability: t.voiceStability,
      similarityBoost: t.voiceSimilarityBoost,
      style: t.voiceStyle,
      useSpeakerBoost: t.voiceUseSpeakerBoost,
      optimizeStreamingLatency: 3,
    };
  }
  if (t.voiceProvider === "cartesia" || t.voiceProvider === "playht" || t.voiceProvider === "openai") {
    return { ...base, ...(t.voiceModel ? { model: t.voiceModel } : {}) };
  }
  return base;
}

export function buildTranscriberBlock(t: VapiTuning) {
  return {
    provider: t.transcriberProvider,
    ...(t.transcriberModel ? { model: t.transcriberModel } : {}),
    ...(t.transcriberLanguage ? { language: t.transcriberLanguage } : {}),
  };
}
