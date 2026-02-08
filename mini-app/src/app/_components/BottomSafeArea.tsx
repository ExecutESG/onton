"use client";

const BottomSafeArea = () => {
  return (
    <div
      className="h-[var(--tg-safe-area-inset-bottom)] bg-white/75"
      style={{
        backdropFilter: "blur(50px)",
      }}
    />
  );
};

export default BottomSafeArea;
