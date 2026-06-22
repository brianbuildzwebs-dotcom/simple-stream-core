export const EMBED_VOLUME_PRESETS = [
  { label: 'Mute', value: 0 },
  { label: 'Low', value: 0.35 },
  { label: 'Med', value: 0.65 },
  { label: 'High', value: 1 },
];

/** Default when a viewer opens the embed — Med is easier for elderly listeners. */
export const EMBED_DEFAULT_VOLUME =
  EMBED_VOLUME_PRESETS.find((preset) => preset.label === 'Med')?.value ?? 0.65;