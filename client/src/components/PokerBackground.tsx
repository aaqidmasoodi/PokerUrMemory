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
            id="poker-hearts"
            x="0"
            y="0"
            width="180"
            height="180"
            patternUnits="userSpaceOnUse"
          >
            <animateTransform
              attributeName="patternTransform"
              type="translate"
              from="0 0"
              to="180 180"
              dur="35s"
              repeatCount="indefinite"
            />
            {/* Hearts */}
            <text x="10"  y="38"  fontSize="26" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(-14, 10, 38)">♥</text>
            <text x="90"  y="20"  fontSize="20" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(9, 90, 20)">♥</text>
            <text x="148" y="48"  fontSize="28" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(-20, 148, 48)">♥</text>
            <text x="55"  y="110" fontSize="22" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(12, 55, 110)">♥</text>
            <text x="128" y="108" fontSize="24" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(-8, 128, 108)">♥</text>
            <text x="22"  y="168" fontSize="20" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(16, 22, 168)">♥</text>
            {/* Spades */}
            <text x="72"  y="62"  fontSize="22" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(-10, 72, 62)">♠</text>
            <text x="158" y="148" fontSize="20" fontFamily="serif" fill="white" fillOpacity="0.06" transform="rotate(18, 158, 148)">♠</text>
            <text x="8"   y="118" fontSize="26" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(-5, 8, 118)">♠</text>
            {/* Clubs */}
            <text x="108" y="160" fontSize="22" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(11, 108, 160)">♣</text>
            <text x="42"  y="46"  fontSize="18" fontFamily="serif" fill="white" fillOpacity="0.04" transform="rotate(-18, 42, 46)">♣</text>
            <text x="170" y="88"  fontSize="20" fontFamily="serif" fill="white" fillOpacity="0.05" transform="rotate(7, 170, 88)">♣</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#poker-hearts)" />
      </svg>
    </div>
  );
}
