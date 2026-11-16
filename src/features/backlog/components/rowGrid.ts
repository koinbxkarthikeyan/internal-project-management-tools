// On a wide screen the free width is shared: Title gets the biggest share and every other column a smaller one, so no single gap grows much larger than the rest. Each column keeps a minimum that
// fits its content (Type "Enhancement" with its icon, a name like "Abhishek - CTO", the Assignee avatars), and Title never goes under 10rem. Every row is its own grid, so the tracks are
// the same in every row and line up with the header.
export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(10rem,3.2fr)_minmax(6.5rem,1fr)_minmax(5.25rem,.8fr)_minmax(5.5rem,.8fr)_minmax(5.5rem,.8fr)_minmax(9.5rem,1.3fr)_minmax(4.75rem,.8fr)_minmax(6rem,.9fr)_3rem] md:items-center md:gap-3";
