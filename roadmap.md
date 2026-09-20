# Roadmap

## Radar vocale con VAPI (sostituisce ElevenLabs ConvAI)
- [ ] Verificare se esiste un connettore VAPI; altrimenti richiedere VAPI_API_KEY via add_secret
- [ ] Adattare edge functions: vapi-webhook (tool calls + instradamento chiamate in entrata con riconoscimento numero), vapi-assistant-setup (crea/aggiorna assistente "Radar FlyDeck" con strumenti), chiamate in uscita per promemoria importanti via VAPI API
- [ ] Aggiornare process-reminders: chiamata in uscita via VAPI invece di ElevenLabs
- [ ] Aggiornare VoiceRadarSettings.tsx (stato VAPI, numero, istruzioni)
- [ ] Aggiornare voci in ai_voice_settings (vapi_assistant_id, phone info)
- [ ] Numero 081: acquisto su Twilio + import in VAPI (passi manuali utente)
- [ ] Test end-to-end: chiamata in entrata (riconoscimento dal numero) e in uscita (promemoria importante)

## Completato
- [x] Rinomina "Urgente" → "Importante" (UI + messaggi Radar) e redeploy funzioni
- [x] DB: profiles.phone_number, reminders.is_urgent/call_status, voice_calls, radar_nudges reuse
- [x] Modulo condiviso _shared/radar-actions.ts (riusato anche da VAPI)

## In attesa (bloccanti esterni)
- Numero Twilio 081: regulatory bundle + acquisto (utente, console Twilio)
- VAPI: chiave API dall'account utente
