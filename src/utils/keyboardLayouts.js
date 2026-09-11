export const LAYOUTS = {
  QWERTY: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.'],
    [
      { id: 'BACKSPACE', label: 'BACKSPACE', icon: 'Delete', span: 2, action: 'backspace' },
      { id: 'SPACE', label: 'SPACE', icon: 'Space', span: 4, action: 'space' },
      { id: 'CLEAR', label: 'CLEAR', icon: 'Trash2', span: 2, action: 'clear' },
      { id: 'SEND', label: 'SEND', icon: 'Send', span: 2, action: 'send', variant: 'accent' },
    ],
  ],
  ALPHABETICAL: [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
    ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
    ['V', 'W', 'X', 'Y', 'Z', ',', '.'],
    [
      { id: 'BACKSPACE', label: 'BACKSPACE', icon: 'Delete', span: 2, action: 'backspace' },
      { id: 'SPACE', label: 'SPACE', icon: 'Space', span: 3, action: 'space' },
      { id: 'CLEAR', label: 'CLEAR', icon: 'Trash2', span: 1, action: 'clear' },
      { id: 'SEND', label: 'SEND', icon: 'Send', span: 2, action: 'send', variant: 'accent' },
    ],
  ],
};

export function getFlatKeys(layoutType = 'QWERTY') {
  const layout = LAYOUTS[layoutType] || LAYOUTS.QWERTY;
  const list = [];
  layout.forEach((row, rowIndex) => {
    row.forEach((key, colIndex) => {
      if (typeof key === 'string') {
        list.push({
          id: key,
          label: key,
          action: 'type',
          value: key,
          rowIndex,
          colIndex,
        });
      } else {
        list.push({
          ...key,
          rowIndex,
          colIndex,
        });
      }
    });
  });
  return list;
}

