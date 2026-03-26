export interface MusicScore {
  notes: MusicNote[]
  skills: MusicNoteBase[]
  fevers: MusicNoteBase[]
}

export interface MusicNoteBase {
  time: number
}

export interface MusicNote extends MusicNoteBase {
  type: number
  longId?: number
}
