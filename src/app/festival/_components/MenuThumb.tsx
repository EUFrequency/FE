/**
 * 박스 크기(9:4)는 고정해 메뉴 카드 높이를 목록 전체에서 일정하게 유지하되, 이미지는
 * 크롭하지 않고 object-contain으로 박스 안에 맞춰 넣는다 - 업로드하는 사진마다 원본
 * 비율이 제각각이라(정사각형·가로로 긴 배너 등) 박스를 꽉 채우려 crop하면 위아래나
 * 좌우가 잘리므로, 대신 남는 여백은 그라디언트 배경으로 채운다.
 * 사진이 없으면 같은 박스에 그라디언트 + 아이콘 placeholder만 보여준다.
 */
export function MenuThumb({
  image,
  accentColor,
}: {
  image: string;
  accentColor: string;
}) {
  return (
    <div
      className="flex aspect-[9/4] items-center justify-center text-5xl"
      style={{
        background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}05)`,
      }}
      aria-hidden
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="opacity-40">🍽️</span>
      )}
    </div>
  );
}
