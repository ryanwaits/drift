export function WavePattern() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[
          { d: 'M0 300 Q360 250 720 320 T1440 280', delay: 0 },
          { d: 'M0 400 Q360 350 720 420 T1440 380', delay: 0.5 },
          { d: 'M0 500 Q360 460 720 530 T1440 490', delay: 1 },
          { d: 'M0 600 Q360 570 720 640 T1440 590', delay: 1.5 },
          { d: 'M0 700 Q360 660 720 730 T1440 690', delay: 2 },
          { d: 'M0 200 Q360 160 720 220 T1440 180', delay: 2.5 },
        ].map(({ d, delay }) => (
          <path
            key={d}
            d={d}
            stroke="var(--wave-stroke)"
            strokeWidth="1.5"
            opacity="0.4"
            style={{
              animation: `drift ${8 + delay * 2}s ease-in-out infinite alternate`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-page-bg" />
      <style>{`
        @keyframes drift {
          0% { transform: translateX(0) translateY(0); }
          100% { transform: translateX(-20px) translateY(10px); }
        }
      `}</style>
    </div>
  );
}
