export const NOTE_COLORS = [
  'slate', 'gray', 'zinc', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const;

export type NoteColor = typeof NOTE_COLORS[number];
