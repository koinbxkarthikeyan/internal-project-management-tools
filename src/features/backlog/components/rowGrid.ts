// Title keeps the largest share, the other columns are only as wide as their content needs. The grid applies when the list itself is 56rem wide (a container query, not the screen's width): in a narrower list each row is a card.
export const ROW_GRID =
  "@4xl:grid @4xl:grid-cols-[minmax(0,3fr)_6.5rem_6rem_6.5rem_6.5rem_minmax(0,1.4fr)_5.5rem_3.5rem] @4xl:items-center @4xl:gap-3";
