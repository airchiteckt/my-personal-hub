# Roadmap

## Radar vocale con VAPI (sostituisce ElevenLabs ConvAI)
- [x] VAPI_API_KEY salvata (segreto)
- [x] DB: colonne vapi_assistant_id / vapi_phone_number_id su ai_voice_settings, vapi_call_id su voice_calls
- [x] Edge function vapi-webhook (assistant-request con riconoscimento numero, tool-calls Radar, end-of-call-report)
- [x] Edge function vapi-assistant-setup (crea/aggiorna assistente "Radar FlyDeck", collega numero al webhook)
- [x] process-reminders: chiamata in uscita via VAPI per promemoria importanti
- [x] VoiceRadarSettings.tsx aggiornato (attivazione, collegamento numero, registro chiamate)
- [x] Vecchie funzioni ElevenLabs ConvAI rimosse (codice + deploy)
- [x] Typecheck OK, webhook testato (auth OK)

## In attesa (passi manuali utente)
- VAPI dashboard → Phone Numbers: numero italiano collegato via SIP trunk (BYO carrier), senza assegnare assistente
- Incollare l'ID del numero in FlyDeck → Impostazioni → Integrazioni → Radar al telefono
- FlyDeck → Impostazioni → Integrazioni → "Radar al telefono": cliccare "Attiva Radar vocale", poi incollare l'ID numero VAPI e premere "Collega"
- Test end-to-end: chiamata in entrata (riconoscimento dal numero) e promemoria importante (chiamata in uscita)
