export type ReactionKind = 'heart' | 'laugh' | 'sad' | 'angry' | 'wow'

export type ReactionComment = {
  author: string
  text: string
}

export type ReactionState = {
  counts: Record<ReactionKind, number>
  comments: ReactionComment[]
}

export type ReactionThread =
  | 'avatar-Long'
  | 'avatar-Tuấn'
  | 'celebration'
  | 'letter-Long'
  | 'letter-Tuấn'

const mockReactionStates: Record<ReactionThread, ReactionState> = {
  'avatar-Long': {
    counts: { heart: 12, laugh: 3, sad: 0, angry: 1, wow: 4 },
    comments: [
      { author: 'Long Đại Ca', text: 'duma con tó sao m lấy ảnh này' },
      { author: 'Tuấn', text: 'đẹp troai mà' },
      { author: 'Ngân', text: ':)' },
      { author: 'Khang', text: 'Ảnh hồi lớp 11 nè' },
    ],
  },
  'avatar-Tuấn': {
    counts: { heart: 5, laugh: 8, sad: 2, angry: 0, wow: 6 },
    comments: [
      { author: 'Tuấn Hay Nói', text: 'm khác dell gì t toàn lấy ảnh dìm của nhau đúng hiểu ý nhau thật' },
      { author: 'Long Đại Ca', text: 'im lặng nào cô bé' },
      { author: 'Ngân', text: 'ảnh nhu c' },
      { author: 'Nhân', text: 'đẹp trai đấy em' },
      { author: 'Bảo', text: 'vjp' },
    ],
  },
  celebration: {
    counts: { heart: 24, laugh: 7, sad: 1, angry: 0, wow: 9 },
    comments: [
      { author: 'Ngân', text: 'con AI lúc trc đúng ko' },
      { author: 'Thảo', text: 'hihi' },
      { author: 'Tiên', text: '2 thg tụi bây' },
      { author: 'Tiền', text: 'con AI khốn nạn vô cùng' },
    ],
  },
  'letter-Long': {
    counts: { heart: 9, laugh: 2, sad: 6, angry: 0, wow: 3 },
    comments: [
      { author: 'Ngân', text: 'xúc động đấy thg ranh' },
      { author: 'Thoa', text: 'Em trai tui đó mn' },
      { author: 'Yến', text: 'AI của tụi m láo vô cùng' },
      { author: 'Thu', text: 'cảm ơn nha' },
    ],
  },
  'letter-Tuấn': {
    counts: { heart: 15, laugh: 4, sad: 3, angry: 1, wow: 7 },
    comments: [
      { author: 'Ngân', text: 'Như c' },
      { author: 'Ngân', text: 't xin loi bạn' },
      { author: 'Thoa', text: 'Em tui luôn đó mn' },
    ],
  },
}

export const createMockReactionState = (thread: ReactionThread): ReactionState => {
  const state = mockReactionStates[thread]
  return {
    counts: { ...state.counts },
    comments: state.comments.map((comment) => ({ ...comment })),
  }
}
