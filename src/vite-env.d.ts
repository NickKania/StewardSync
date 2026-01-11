interface ImportMetaEnv {
  readonly NG_APP_DISCORD_CLIENT_ID: string
  readonly NG_APP_DISCORD_CLIENT_SECRET: string
  readonly NG_APP_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
