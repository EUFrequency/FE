/** 메뉴 사진이 있으면 그대로, 없으면 은은한 그라디언트 + 아이콘 placeholder */
export function MenuThumb({
  image,
  accentColor,
}: {
  image: string;
  accentColor: string;
}) {
  return (
    <div
      className="flex h-40 items-center justify-center bg-cover bg-center text-5xl"
      style={{
        backgroundImage: image
          ? `linear-gradient(135deg, ${accentColor}22, ${accentColor}05), url("${image}")`
          : `linear-gradient(135deg, ${accentColor}22, ${accentColor}05)`,
      }}
      aria-hidden
    >
      {!image && <span className="opacity-40">🍽️</span>}
    </div>
  );
}
