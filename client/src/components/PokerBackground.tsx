export function PokerBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern
            id="poker-suits"
            x="0"
            y="0"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            <animateTransform
              attributeName="patternTransform"
              type="translate"
              from="0 0"
              to="220 220"
              dur="55s"
              repeatCount="indefinite"
            />

            {/* ♠ Spades */}
            <text x="18"  y="46"  fontSize="30" fontFamily="serif" fill="white" fillOpacity="0.09" transform="rotate(-15,18,46)">♠</text>
            <text x="108" y="26"  fontSize="18" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(8,108,26)">♠</text>
            <text x="192" y="82"  fontSize="22" fontFamily="serif" fill="white" fillOpacity="0.07" transform="rotate(-10,192,82)">♠</text>
            <text x="74"  y="148" fontSize="16" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(20,74,148)">♠</text>
            <text x="158" y="202" fontSize="26" fontFamily="serif" fill="white" fillOpacity="0.08" transform="rotate(5,158,202)">♠</text>

            {/* ♥ Hearts — soft warm red */}
            <text x="78"  y="66"  fontSize="24" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.10" transform="rotate(10,78,66)">♥</text>
            <text x="152" y="40"  fontSize="16" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.07" transform="rotate(-8,152,40)">♥</text>
            <text x="20"  y="118" fontSize="20" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.08" transform="rotate(-18,20,118)">♥</text>
            <text x="132" y="132" fontSize="28" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.09" transform="rotate(6,132,132)">♥</text>
            <text x="56"  y="212" fontSize="18" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.06" transform="rotate(14,56,212)">♥</text>

            {/* ♣ Clubs */}
            <text x="172" y="116" fontSize="20" fontFamily="serif" fill="white" fillOpacity="0.07" transform="rotate(12,172,116)">♣</text>
            <text x="38"  y="74"  fontSize="16" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(-22,38,74)">♣</text>
            <text x="100" y="192" fontSize="24" fontFamily="serif" fill="white" fillOpacity="0.08" transform="rotate(9,100,192)">♣</text>
            <text x="202" y="158" fontSize="18" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(-5,202,158)">♣</text>
            <text x="142" y="92"  fontSize="14" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(16,142,92)">♣</text>

            {/* ♦ Diamonds — soft warm red */}
            <text x="56"  y="170" fontSize="22" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.08" transform="rotate(-7,56,170)">♦</text>
            <text x="196" y="34"  fontSize="20" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.07" transform="rotate(18,196,34)">♦</text>
            <text x="118" y="64"  fontSize="16" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.06" transform="rotate(-12,118,64)">♦</text>
            <text x="10"  y="186" fontSize="18" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.06" transform="rotate(5,10,186)">♦</text>
            <text x="180" y="216" fontSize="28" fontFamily="serif" fill="#ffb8b8" fillOpacity="0.09" transform="rotate(-15,180,216)">♦</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#poker-suits)" />
      </svg>
    </div>
  );
}
