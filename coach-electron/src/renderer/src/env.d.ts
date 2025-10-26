/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_DEFAULT_AGENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
