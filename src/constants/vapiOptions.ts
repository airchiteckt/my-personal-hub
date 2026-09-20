// VAPI Configuration Constants
// Centralized constants for voice, model, and transcriber options

export const LANGUAGES = ["Italiano", "English"] as const;

export const GENDERS = ["male", "female"] as const;

// ElevenLabs TTS Models
export const ELEVENLABS_MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5", description: "⚡ Più veloce - 32 lingue - Consigliato", recommended: true },
  { value: "eleven_v3", label: "Eleven v3 (Alpha)", description: "🎭 Più espressivo - Nuovo!", recommended: false },
  { value: "eleven_multilingual_v2", label: "Multilingual v2", description: "Alta qualità - 29 lingue", recommended: false },
  { value: "eleven_turbo_v2", label: "Turbo v2", description: "Veloce - Solo inglese", recommended: false },
  { value: "eleven_flash_v2_5", label: "Flash v2.5", description: "Ultra veloce - Bassa latenza", recommended: false },
];

// AI Models for voice-test function
export const AI_MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Google Gemini 2.5 Flash Lite", description: "⚡ Velocissimo - Consigliato", recommended: true },
  { value: "google/gemini-2.5-flash", label: "Google Gemini 2.5 Flash", description: "Molto veloce, buona qualità", recommended: false },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini", description: "Veloce, economico", recommended: false },
  { value: "openai/gpt-5-mini", label: "OpenAI GPT-5 Mini", description: "Più potente, più lento", recommended: false },
];

// VAPI Voice Providers (TTS)
export const VAPI_VOICE_PROVIDERS = [
  { value: "11labs", label: "ElevenLabs", description: "⚡ Alta qualità, bassa latenza", recommended: true },
  { value: "openai", label: "OpenAI", description: "Veloce, buona qualità", recommended: false },
  { value: "azure", label: "Azure", description: "Microsoft TTS", recommended: false },
  { value: "deepgram", label: "Deepgram", description: "Ultra veloce", recommended: false },
  { value: "playht", label: "PlayHT", description: "Voci realistiche", recommended: false },
  { value: "cartesia", label: "Cartesia", description: "Sonic - Ultra bassa latenza", recommended: false },
  { value: "rime-ai", label: "Rime AI", description: "Voci naturali", recommended: false },
  { value: "lmnt", label: "LMNT", description: "Voci espressive", recommended: false },
  { value: "neets", label: "Neets", description: "Economico", recommended: false },
  { value: "tavus", label: "Tavus", description: "Video AI voices", recommended: false },
];

// VAPI Transcriber Providers (STT)
export const VAPI_TRANSCRIBER_PROVIDERS = [
  { value: "deepgram", label: "Deepgram", description: "⚡ Consigliato - Veloce e accurato", recommended: true },
  { value: "google", label: "Google", description: "Google Cloud Speech-to-Text", recommended: false },
  { value: "assembly-ai", label: "Assembly AI", description: "Alta precisione", recommended: false },
  { value: "azure", label: "Azure", description: "Microsoft Speech", recommended: false },
  { value: "11labs", label: "11labs", description: "ElevenLabs STT", recommended: false },
  { value: "gladia", label: "Gladia", description: "Multilingue avanzato", recommended: false },
  { value: "openai", label: "OpenAI", description: "Whisper - Alta qualità", recommended: false },
  { value: "speechmatics", label: "Speechmatics", description: "Enterprise - Multi lingua", recommended: false },
  { value: "talkscriber", label: "Talkscriber", description: "Whisper ottimizzato", recommended: false },
  { value: "cartesia", label: "Cartesia", description: "Ultra bassa latenza", recommended: false },
  { value: "custom-transcriber", label: "Custom", description: "Transcriber personalizzato", recommended: false },
];

// VAPI AI Models (LLM) - Organized by provider
export const VAPI_AI_MODELS = [
  // OpenAI - Most recommended for VAPI
  { value: "gpt-4o-mini", label: "OpenAI GPT-4o Mini", description: "⚡ Veloce - Consigliato", recommended: true, provider: "openai" },
  { value: "gpt-4o", label: "OpenAI GPT-4o", description: "Potente, multimodale", recommended: false, provider: "openai" },
  { value: "gpt-4-turbo", label: "OpenAI GPT-4 Turbo", description: "Alta qualità", recommended: false, provider: "openai" },
  { value: "gpt-3.5-turbo", label: "OpenAI GPT-3.5 Turbo", description: "Economico, veloce", recommended: false, provider: "openai" },
  { value: "gpt-5", label: "OpenAI GPT-5", description: "Nuovo modello avanzato", recommended: false, provider: "openai" },
  { value: "gpt-5-mini", label: "OpenAI GPT-5 Mini", description: "Veloce, nuovo", recommended: false, provider: "openai" },
  // Anthropic Claude
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", description: "Bilanciato", recommended: false, provider: "anthropic" },
  { value: "claude-3-opus-20240229", label: "Claude 3 Opus", description: "Più potente", recommended: false, provider: "anthropic" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku", description: "Ultra veloce", recommended: false, provider: "anthropic" },
  // Google
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "⚡ Ultra veloce", recommended: false, provider: "google" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Veloce", recommended: false, provider: "google" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", description: "Potente", recommended: false, provider: "google" },
  // Groq - Ultra fast inference
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", description: "⚡ Groq - Ultra veloce", recommended: true, provider: "groq" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", description: "Groq - Istantaneo", recommended: false, provider: "groq" },
  { value: "llama3-70b-8192", label: "Llama 3 70B", description: "Groq - Potente", recommended: false, provider: "groq" },
  { value: "llama3-8b-8192", label: "Llama 3 8B", description: "Groq - Veloce", recommended: false, provider: "groq" },
  { value: "gemma2-9b-it", label: "Gemma 2 9B IT", description: "Groq - Google", recommended: false, provider: "groq" },
  { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill", description: "Groq - Reasoning", recommended: false, provider: "groq" },
  { value: "mistral-saba-24b", label: "Mistral Saba 24B", description: "Groq - Mistral", recommended: false, provider: "groq" },
];

// ElevenLabs Voices
export const VAPI_ELEVENLABS_VOICES = [
  { value: "9BWtsMINqrJLrRacOk9x", label: "Aria", description: "Femminile, espressiva" },
  { value: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger", description: "Maschile, professionale" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", description: "Femminile, naturale" },
  { value: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", description: "Femminile, calda" },
  { value: "IKne3meq5aSn9XLyUdCD", label: "Charlie", description: "Maschile, amichevole" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George", description: "Maschile, autorevole" },
  { value: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", description: "Maschile, britannico" },
  { value: "SAz9YHcvj6GT2YYXdXww", label: "River", description: "Non-binary, moderno" },
  { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", description: "Maschile, giovane" },
  { value: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", description: "Femminile, elegante" },
  { value: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", description: "Femminile, britannica" },
  { value: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", description: "Femminile, calma" },
  { value: "bIHbv24MWmeRgasZH58o", label: "Will", description: "Maschile, narratore" },
  { value: "cgSgspJ2msm6clMCkdW9", label: "Jessica", description: "Femminile, americana" },
  { value: "cjVigY5qzO86Huf0OWal", label: "Eric", description: "Maschile, profondo" },
  { value: "iP95p4xoKVk53GoZ742B", label: "Chris", description: "Maschile, energico" },
  { value: "nPczCjzI2devNBz1zQrb", label: "Brian", description: "Maschile, narratore" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", description: "Maschile, britannico" },
  { value: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", description: "Femminile, britannica" },
  { value: "pqHfZKP75CvOlQylNhV4", label: "Bill", description: "Maschile, americano" },
  { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Femminile, calma" },
  { value: "custom", label: "Voice ID Personalizzato", description: "Inserisci il tuo Voice ID" },
] as const;

// Deepgram STT Models
export const DEEPGRAM_MODELS = [
  { value: "nova-3", label: "Nova 3", description: "🚀 Ultimo modello, massima accuratezza", recommended: true },
  { value: "nova-3-general", label: "Nova 3 General", description: "General purpose - ultima generazione", recommended: false },
  { value: "nova-3-medical", label: "Nova 3 Medical", description: "Ottimizzato per contesto medico", recommended: false },
  { value: "nova-3-finance", label: "Nova 3 Finance", description: "Ottimizzato per contesto finanziario", recommended: false },
  { value: "nova-2", label: "Nova 2", description: "Veloce e accurato", recommended: false },
  { value: "nova-2-phonecall", label: "Nova 2 Phonecall", description: "Ottimizzato per telefonate", recommended: false },
  { value: "nova-2-conversationalai", label: "Nova 2 ConversationalAI", description: "Ottimizzato per AI", recommended: false },
  { value: "nova", label: "Nova", description: "Versione precedente", recommended: false },
  { value: "enhanced", label: "Enhanced", description: "Qualità migliorata", recommended: false },
  { value: "base", label: "Base", description: "Economico", recommended: false },
];

// Deepgram Languages
export const DEEPGRAM_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "en-US", label: "🇺🇸 English (US)" },
  { value: "en-GB", label: "🇬🇧 English (UK)" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "multi", label: "🌐 Multi-lingua" },
] as const;

// Google STT Models
export const GOOGLE_STT_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "⚡ Consigliato - Veloce", recommended: true },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Ultra veloce, economico", recommended: false },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Massima qualità", recommended: false },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Veloce, stabile", recommended: false },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", description: "Economico", recommended: false },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Versione precedente", recommended: false },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", description: "Pro, versione precedente", recommended: false },
];

// Google STT Languages
export const GOOGLE_STT_LANGUAGES = [
  { value: "it-IT", label: "🇮🇹 Italiano" },
  { value: "en-US", label: "🇺🇸 English (US)" },
  { value: "en-GB", label: "🇬🇧 English (UK)" },
  { value: "es-ES", label: "🇪🇸 Español (España)" },
  { value: "es-MX", label: "🇲🇽 Español (México)" },
  { value: "fr-FR", label: "🇫🇷 Français" },
  { value: "de-DE", label: "🇩🇪 Deutsch" },
  { value: "pt-BR", label: "🇧🇷 Português (Brasil)" },
  { value: "pt-PT", label: "🇵🇹 Português (Portugal)" },
  { value: "nl-NL", label: "🇳🇱 Nederlands" },
  { value: "ja-JP", label: "🇯🇵 日本語" },
  { value: "zh-CN", label: "🇨🇳 中文" },
] as const;

// OpenAI STT Models
export const OPENAI_STT_MODELS = [
  { value: "whisper-1", label: "Whisper 1", description: "⚡ Standard - Alta qualità", recommended: true },
] as const;

// OpenAI STT Languages
export const OPENAI_STT_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "ja", label: "🇯🇵 日本語" },
  { value: "zh", label: "🇨🇳 中文" },
] as const;

// AssemblyAI Models
export const ASSEMBLYAI_MODELS = [
  { value: "best", label: "Best", description: "⚡ Massima qualità", recommended: true },
  { value: "nano", label: "Nano", description: "⚡ Ultra veloce, economico", recommended: false },
];

// AssemblyAI Languages
export const ASSEMBLYAI_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "en_us", label: "🇺🇸 English (US)" },
  { value: "en_uk", label: "🇬🇧 English (UK)" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
] as const;

// Azure STT Languages
export const AZURE_STT_LANGUAGES = [
  { value: "it-IT", label: "🇮🇹 Italiano" },
  { value: "en-US", label: "🇺🇸 English (US)" },
  { value: "en-GB", label: "🇬🇧 English (UK)" },
  { value: "es-ES", label: "🇪🇸 Español" },
  { value: "fr-FR", label: "🇫🇷 Français" },
  { value: "de-DE", label: "🇩🇪 Deutsch" },
  { value: "pt-BR", label: "🇧🇷 Português" },
  { value: "nl-NL", label: "🇳🇱 Nederlands" },
  { value: "ja-JP", label: "🇯🇵 日本語" },
  { value: "zh-CN", label: "🇨🇳 中文" },
] as const;

// Talkscriber Models
export const TALKSCRIBER_MODELS = [
  { value: "whisper", label: "Whisper", description: "⚡ OpenAI Whisper - Alta qualità", recommended: true },
] as const;

// Talkscriber Languages
export const TALKSCRIBER_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
] as const;

// Gladia Models
export const GLADIA_MODELS = [
  { value: "fast", label: "Fast", description: "⚡ Ultra veloce", recommended: true },
  { value: "accurate", label: "Accurate", description: "Alta precisione", recommended: false },
];

// Gladia Languages
export const GLADIA_LANGUAGES = [
  { value: "italian", label: "🇮🇹 Italiano" },
  { value: "english", label: "🇬🇧 English" },
  { value: "spanish", label: "🇪🇸 Español" },
  { value: "french", label: "🇫🇷 Français" },
  { value: "german", label: "🇩🇪 Deutsch" },
  { value: "portuguese", label: "🇵🇹 Português" },
  { value: "dutch", label: "🇳🇱 Nederlands" },
  { value: "auto", label: "🌐 Auto-detect" },
] as const;

// Cartesia Models
export const CARTESIA_MODELS = [
  { value: "sonic-3", label: "Sonic 3", description: "🚀 Nuovo - 40ms TTFB, italiano nativo", recommended: true },
  { value: "sonic-3-turbo", label: "Sonic 3 Turbo", description: "⚡ Più veloce di sonic-3", recommended: false },
  { value: "sonic-2", label: "Sonic 2", description: "Stabile, qualità alta", recommended: false },
  { value: "sonic-english", label: "Sonic English", description: "Solo inglese, ottimizzato", recommended: false },
  { value: "sonic", label: "Sonic (legacy)", description: "Versione originale", recommended: false },
] as const;

// Cartesia Languages
export const CARTESIA_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
] as const;

// OpenAI TTS Models
export const OPENAI_TTS_MODELS = [
  { value: "gpt-4o-mini-tts", label: "GPT-4o Mini TTS", description: "🚀 Nuovo - Steerable, espressivo", recommended: true },
  { value: "tts-1", label: "TTS-1", description: "⚡ Bassa latenza", recommended: false },
  { value: "tts-1-hd", label: "TTS-1 HD", description: "Alta qualità, più lento", recommended: false },
] as const;

// OpenAI TTS Voices
// Nota: ash, ballad, coral, sage e verse sono utilizzabili solo con i modelli
// realtime/GPT-Live, quindi non sono selezionabili per le chiamate di Radar.
export const OPENAI_TTS_VOICES = [
  { value: "alloy", label: "Alloy", description: "Neutro, bilanciato" },
  { value: "echo", label: "Echo", description: "Maschile, profondo" },
  { value: "fable", label: "Fable", description: "Narratore britannico" },
  { value: "onyx", label: "Onyx", description: "Maschile, autorevole" },
  { value: "nova", label: "Nova", description: "Femminile, energica" },
  { value: "shimmer", label: "Shimmer", description: "Femminile, brillante" },
] as const;

// Azure TTS Voices (Italiano + multilingua principali)
export const AZURE_TTS_VOICES = [
  { value: "it-IT-IsabellaMultilingualNeural", label: "Isabella Multilingual", description: "🇮🇹 Femminile, multilingua" },
  { value: "it-IT-GiuseppeMultilingualNeural", label: "Giuseppe Multilingual", description: "🇮🇹 Maschile, multilingua" },
  { value: "it-IT-ElsaNeural", label: "Elsa", description: "🇮🇹 Femminile, naturale" },
  { value: "it-IT-IsabellaNeural", label: "Isabella", description: "🇮🇹 Femminile, calda" },
  { value: "it-IT-DiegoNeural", label: "Diego", description: "🇮🇹 Maschile, autorevole" },
  { value: "it-IT-BenignoNeural", label: "Benigno", description: "🇮🇹 Maschile, amichevole" },
  { value: "it-IT-CalimeroNeural", label: "Calimero", description: "🇮🇹 Maschile, giovane" },
  { value: "it-IT-CataldoNeural", label: "Cataldo", description: "🇮🇹 Maschile, anziano" },
  { value: "it-IT-FabiolaNeural", label: "Fabiola", description: "🇮🇹 Femminile, professionale" },
  { value: "it-IT-FiammaNeural", label: "Fiamma", description: "🇮🇹 Femminile, energica" },
  { value: "it-IT-GianniNeural", label: "Gianni", description: "🇮🇹 Maschile, narratore" },
  { value: "en-US-AndrewMultilingualNeural", label: "Andrew Multilingual", description: "🇺🇸 Maschile, multilingua" },
  { value: "en-US-AvaMultilingualNeural", label: "Ava Multilingual", description: "🇺🇸 Femminile, multilingua" },
] as const;

// Cartesia Voices (italiano focus)
export const CARTESIA_VOICES = [
  { value: "custom", label: "Voice ID Personalizzato", description: "Inserisci il tuo Voice ID Cartesia" },
] as const;

// PlayHT Models
export const PLAYHT_MODELS = [
  { value: "PlayDialog", label: "PlayDialog", description: "🚀 Conversazionale, multi-turno", recommended: true },
  { value: "Play3.0-mini", label: "Play 3.0 Mini", description: "⚡ Bassa latenza", recommended: false },
  { value: "PlayHT2.0-turbo", label: "PlayHT 2.0 Turbo", description: "Veloce, stabile", recommended: false },
  { value: "PlayHT2.0", label: "PlayHT 2.0", description: "Qualità alta, più lento", recommended: false },
] as const;

// Impostazioni di partenza valide per ogni provider voce:
// cambiando provider la voce (e il modello) devono sempre essere coerenti,
// altrimenti VAPI rifiuta la chiamata.
export const VOICE_PROVIDER_DEFAULTS: Record<string, { voiceId: string; voiceModel: string; needsOwnKey?: boolean }> = {
  azure: { voiceId: "it-IT-GiuseppeMultilingualNeural", voiceModel: "" },
  openai: { voiceId: "onyx", voiceModel: "gpt-4o-mini-tts" },
  "11labs": { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceModel: "eleven_turbo_v2_5", needsOwnKey: true },
  cartesia: { voiceId: "", voiceModel: "sonic-3", needsOwnKey: true },
  playht: { voiceId: "", voiceModel: "PlayDialog", needsOwnKey: true },
  deepgram: { voiceId: "aura-2-thalia-en", voiceModel: "", needsOwnKey: true },
  "rime-ai": { voiceId: "marsh", voiceModel: "", needsOwnKey: true },
  lmnt: { voiceId: "lily", voiceModel: "", needsOwnKey: true },
  neets: { voiceId: "vits-eng-1", voiceModel: "", needsOwnKey: true },
  tavus: { voiceId: "", voiceModel: "", needsOwnKey: true },
};

// Helper to get TTS options by provider (per Admin Voices UI)
export const getTtsOptions = (provider: string) => {
  switch (provider) {
    case 'openai':
      return { models: OPENAI_TTS_MODELS, voices: OPENAI_TTS_VOICES };
    case 'azure':
      return { models: null, voices: AZURE_TTS_VOICES };
    case 'cartesia':
      return { models: CARTESIA_MODELS, voices: CARTESIA_VOICES };
    case 'playht':
      return { models: PLAYHT_MODELS, voices: null };
    case '11labs':
    case 'elevenlabs':
      return { models: ELEVENLABS_MODELS, voices: VAPI_ELEVENLABS_VOICES };
    default:
      return { models: null, voices: null };
  }
};

export const ELEVENLABS_STT_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "pl", label: "🇵🇱 Polski" },
  { value: "hi", label: "🇮🇳 हिन्दी" },
] as const;

// Speechmatics Languages
export const SPEECHMATICS_LANGUAGES = [
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "ja", label: "🇯🇵 日本語" },
  { value: "ar", label: "🇸🇦 العربية" },
  { value: "auto", label: "🌐 Auto-detect" },
] as const;

// Helper function to get models/languages by transcriber provider
export const getTranscriberOptions = (provider: string) => {
  switch (provider) {
    case 'deepgram':
      return { models: DEEPGRAM_MODELS, languages: DEEPGRAM_LANGUAGES };
    case 'google':
      return { models: GOOGLE_STT_MODELS, languages: GOOGLE_STT_LANGUAGES };
    case 'openai':
      return { models: OPENAI_STT_MODELS, languages: OPENAI_STT_LANGUAGES };
    case 'assembly-ai':
      return { models: ASSEMBLYAI_MODELS, languages: ASSEMBLYAI_LANGUAGES };
    case 'azure':
      return { models: null, languages: AZURE_STT_LANGUAGES };
    case 'talkscriber':
      return { models: TALKSCRIBER_MODELS, languages: TALKSCRIBER_LANGUAGES };
    case 'gladia':
      return { models: GLADIA_MODELS, languages: GLADIA_LANGUAGES };
    case 'cartesia':
      return { models: CARTESIA_MODELS, languages: CARTESIA_LANGUAGES };
    case '11labs':
      return { models: null, languages: ELEVENLABS_STT_LANGUAGES };
    case 'speechmatics':
      return { models: null, languages: SPEECHMATICS_LANGUAGES };
    default:
      return { models: null, languages: DEEPGRAM_LANGUAGES };
  }
};

// Helper to get AI provider from model
export const getAiProviderFromModel = (model: string): string => {
  const foundModel = VAPI_AI_MODELS.find(m => m.value === model);
  return foundModel?.provider || 'openai';
};

// Default Voice IDs
export const DEFAULT_VOICE_ID_IT_MALE = "onwK4e9ZLuTAKqWW03F9"; // Daniel
export const DEFAULT_VOICE_ID_IT_FEMALE = "21m00Tcm4TlvDq8ikWAM"; // Rachel
export const DEFAULT_VOICE_ID_EN_MALE = "JBFqnCBsd6RMkjVDRZzb"; // George  
export const DEFAULT_VOICE_ID_EN_FEMALE = "EXAVITQu4vr4xnSDxMaL"; // Sarah

// Default ElevenLabs Model
export const DEFAULT_ELEVENLABS_MODEL = "eleven_turbo_v2_5";

// Default Transcriber Settings
export const DEFAULT_TRANSCRIBER_PROVIDER = "deepgram";
export const DEFAULT_TRANSCRIBER_MODEL = "nova-2";
export const DEFAULT_TRANSCRIBER_LANGUAGE = "it";
