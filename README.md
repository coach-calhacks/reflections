Your reflection bringing about change. 

Reflection is a Desktop Application featuring an AI twin that has all the context on you and allows you to stay true to your goals and self. 


Reflections securely connects to your work signals. By passively understanding your screen activity and analyzing communication patterns from your Gmail, Google Calendar, Notion, it builds a private, real-time picture of what you're working on, where your time is going, and when you are truly focused. But Reflection goes beyond data. It begins with a guided conversation to understand the intangibles that make you who you are: your story, your dreams, your personality, and what truly drives you. This forms the core of its coaching intelligence.


When it senses you've slipped into distraction, it doesn't send a notification you can ignore. A simple, FaceTime-style window appears with your AI twin - a 3D model, modeled after you. Using your own voice, it offers a gentle but firm nudge to get back on track. It’s the voice of your own intentions, helping you stay true to your goals.


Your coach is always available. You can start a voice or text conversation anytime to talk through challenges, set priorities, or set short or long-term goals. The Reflection remembers every session, getting smarter about your goals and work style over time. 


We built Reflections as a cross‑platform Electron app (Vite + React/TypeScript) with Tailwind and shadcn/ui for a clean, responsive UI and Framer Motion for subtle interactions. Voice and text coaching run through ElevenLabs over WebRTC, and a FaceTime‑style, always‑on‑top popup uses your camera to “call” you when focus slips. The 3D model of the user's face was rendered using Blender and Unreal Engine. In the main process, we sample the screen at user‑set intervals, run Claude function‑calling to classify on‑task vs. distraction and task type, and persist per‑interval stats to Supabase, which power the session/lifetime radar. For signals, we securely link Gmail via Composio, fetch a recent slice of mail, and analyze it with Claude to infer communication patterns, role, and personality - while deep research runs on the Exa API and is summarized and saved. A Claude synthesis step then fuses conversations, email insights, and research into a living system prompt that personalizes coaching over time, with Google sign‑in and a hardened preload bridge keeping secrets isolated and IPC streams reliable.
