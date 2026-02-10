export const CHARACTER_MODAL_VIEW = Object.freeze({
  ACCOUNT: 'account',
  CHARACTERS: 'characters',
  DKP: 'dkp',
})

export const CHARACTER_MODAL_VIEW_ORDER = Object.freeze([
  CHARACTER_MODAL_VIEW.ACCOUNT,
  CHARACTER_MODAL_VIEW.CHARACTERS,
  CHARACTER_MODAL_VIEW.DKP,
])

export const normalizeCharacterModalView = (view) => {
  if (CHARACTER_MODAL_VIEW_ORDER.includes(view)) return view
  return CHARACTER_MODAL_VIEW.ACCOUNT
}
