import { PlayingCard } from '../components/poker/PlayingCard';

function CardFan() {
  return (
    <div className="relative h-28 w-44 flex-shrink-0">
      <div className="absolute top-5 left-3 -rotate-[18deg] origin-bottom">
        <PlayingCard card={{ rank: 'A', suit: '♠' }} faceUp size="sm" />
      </div>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
        <PlayingCard card={{ rank: 'K', suit: '♥' }} faceUp size="sm" />
      </div>
      <div className="absolute top-5 right-3 rotate-[18deg] origin-bottom">
        <PlayingCard card={{ rank: 'Q', suit: '♦' }} faceUp size="sm" />
      </div>
    </div>
  );
}

export function LandingScreen({ onLogin, onFacebookLogin }: { onLogin: () => void; onFacebookLogin: () => void }) {
  return (
    <div
      className="pum-screen h-dvh flex flex-col [@media(orientation:landscape)]:flex-row bg-transparent overflow-hidden select-none"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none" />

      {/* Left / Top — Branding */}
      <div className="relative flex flex-col items-center justify-center gap-4 flex-1 px-6 pt-10 pb-4 [@media(orientation:landscape)]:pt-0 [@media(orientation:landscape)]:pb-0">
        <img
          src="/android-chrome-192x192.png"
          alt="PokerUrMemory"
          draggable={false}
          className="w-20 h-20 lg:w-28 lg:h-28 xl:w-36 xl:h-36 2xl:w-44 2xl:h-44 [@media(orientation:landscape)]:w-16 [@media(orientation:landscape)]:h-16 rounded-[22px] xl:rounded-[32px] 2xl:rounded-[40px] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
        />
        <div className="text-center">
          <h1 className="font-display text-[1.6rem] min-[390px]:text-[2.2rem] lg:text-[3rem] xl:text-[4rem] 2xl:text-[5rem] [@media(orientation:landscape)]:text-[1.7rem] font-bold blue-text leading-tight tracking-wide">
            PokerUrMemory
          </h1>
          <p className="text-[11px] text-gray-300 mt-1 tracking-[0.18em] uppercase">
            5-Card Draw · Memory Twist
          </p>
        </div>
        <div className="opacity-80 [@media(orientation:landscape)]:hidden">
          <CardFan />
        </div>
      </div>

      {/* Divider */}
      <div className="hidden [@media(orientation:landscape)]:block w-px self-stretch my-8 bg-black/[0.08]" />

      {/* Right / Bottom — Login */}
      <div className="relative flex flex-col items-center justify-center gap-4 flex-1 px-8 pb-10 pt-2 [@media(orientation:landscape)]:pt-0 [@media(orientation:landscape)]:pb-0">
        {/* Card fan shown only in landscape, inside the right column */}
        <div className="hidden [@media(orientation:landscape)]:block opacity-80 mb-2">
          <CardFan />
        </div>
        <div className="w-full max-w-xs lg:max-w-sm xl:max-w-md 2xl:max-w-lg flex flex-col gap-3 xl:gap-4 2xl:gap-5">
          <button
            onClick={onLogin}
            className="w-full h-14 lg:h-16 xl:h-[4.5rem] 2xl:h-20 rounded-2xl font-semibold text-sm xl:text-base 2xl:text-lg bg-white border border-black/[0.12] shadow-md flex items-center justify-center gap-3 active:scale-[0.97] transition-transform"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            onClick={onFacebookLogin}
            className="w-full h-14 lg:h-16 xl:h-[4.5rem] 2xl:h-20 rounded-2xl font-semibold text-sm xl:text-base 2xl:text-lg text-white bg-[#1877F2] shadow-md flex items-center justify-center gap-3 active:scale-[0.97] transition-transform"
          >
            <FacebookIcon />
            Continue with Facebook
          </button>
          <p className="text-center text-[10px] text-gray-300 tracking-wide">
            No account needed: sign in to play
          </p>
        </div>
      </div>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 35 24 35c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.314 0-9.822-3.397-11.421-8.131l-6.515 5.018C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  );
}
