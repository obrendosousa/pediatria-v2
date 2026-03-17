import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar | Centro Médico Aliança',
  description: 'Acesso ao sistema',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#08080b]">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[#08080b]" />

        {/* Doctor Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/doctors-hero.jpg"
          alt="Equipe médica"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Decorative blurs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">Centro Médico Aliança</span>
          </div>

          {/* Tagline */}
          <div>
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
              Cuidar é a
              <br />
              nossa
              <br />
              <span className="text-white/70">
                missão.
              </span>
            </h2>
            <p className="text-white/50 text-sm">
              Centro Médico Aliança
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-[#08080b] relative overflow-hidden">

        {/* Glow bleeding from photo */}
        <div className="hidden lg:block absolute -left-32 top-1/4 w-64 h-96 bg-sky-500/[0.07] rounded-full blur-[100px]" />
        <div className="hidden lg:block absolute -left-20 bottom-1/4 w-48 h-64 bg-blue-500/[0.05] rounded-full blur-[80px]" />

        {/* Floating orbs */}
        <div className="absolute top-[5%] right-[8%] w-1 h-1 bg-sky-400/25 rounded-full animate-[float_5s_ease-in-out_infinite]" />
        <div className="absolute top-[12%] right-[35%] w-2 h-2 bg-sky-400/15 rounded-full animate-[float_7s_ease-in-out_infinite_0.3s]" />
        <div className="absolute top-[15%] right-[10%] w-2 h-2 bg-sky-400/20 rounded-full animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute top-[18%] left-[10%] w-1 h-1 bg-violet-400/20 rounded-full animate-[float_9s_ease-in-out_infinite_4s]" />
        <div className="absolute top-[22%] right-[45%] w-1.5 h-1.5 bg-blue-300/15 rounded-full animate-[float_11s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[25%] right-[25%] w-1.5 h-1.5 bg-blue-400/15 rounded-full animate-[float_8s_ease-in-out_infinite_1s]" />
        <div className="absolute top-[30%] left-[5%] w-1 h-1 bg-sky-300/20 rounded-full animate-[float_6s_ease-in-out_infinite_3.5s]" />
        <div className="absolute top-[35%] right-[5%] w-2 h-2 bg-violet-300/10 rounded-full animate-[float_12s_ease-in-out_infinite_1s]" />
        <div className="absolute top-[40%] left-[25%] w-1 h-1 bg-sky-400/15 rounded-full animate-[float_7s_ease-in-out_infinite_5s]" />
        <div className="absolute top-[45%] right-[18%] w-1.5 h-1.5 bg-blue-400/20 rounded-full animate-[float_10s_ease-in-out_infinite_0.8s]" />
        <div className="absolute top-[50%] left-[35%] w-1 h-1 bg-violet-400/15 rounded-full animate-[float_8s_ease-in-out_infinite_2.5s]" />
        <div className="absolute top-[55%] right-[40%] w-2 h-2 bg-sky-300/10 rounded-full animate-[float_13s_ease-in-out_infinite_1.2s]" />
        <div className="absolute top-[60%] right-[30%] w-2.5 h-2.5 bg-sky-400/10 rounded-full animate-[float_9s_ease-in-out_infinite_0.5s]" />
        <div className="absolute top-[65%] left-[8%] w-1.5 h-1.5 bg-blue-300/15 rounded-full animate-[float_6s_ease-in-out_infinite_4.5s]" />
        <div className="absolute top-[70%] right-[12%] w-1 h-1 bg-sky-400/25 rounded-full animate-[float_7s_ease-in-out_infinite_3s]" />
        <div className="absolute top-[72%] left-[30%] w-2 h-2 bg-violet-400/10 rounded-full animate-[float_11s_ease-in-out_infinite_0.7s]" />
        <div className="absolute top-[78%] right-[22%] w-1 h-1 bg-blue-400/20 rounded-full animate-[float_5s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[80%] left-[18%] w-1.5 h-1.5 bg-sky-300/15 rounded-full animate-[float_9s_ease-in-out_infinite_3.2s]" />
        <div className="absolute top-[85%] right-[6%] w-1 h-1 bg-violet-300/20 rounded-full animate-[float_8s_ease-in-out_infinite_1.8s]" />
        <div className="absolute top-[88%] left-[40%] w-2 h-2 bg-sky-400/10 rounded-full animate-[float_10s_ease-in-out_infinite_4.2s]" />
        <div className="absolute top-[10%] left-[20%] w-1 h-1 bg-sky-300/15 rounded-full animate-[float_5s_ease-in-out_infinite_3s]" />
        <div className="absolute bottom-[35%] left-[15%] w-1.5 h-1.5 bg-blue-300/10 rounded-full animate-[float_10s_ease-in-out_infinite_1.5s]" />
        <div className="absolute bottom-[10%] right-[35%] w-1 h-1 bg-sky-400/20 rounded-full animate-[float_6s_ease-in-out_infinite_2.8s]" />
        <div className="absolute bottom-[5%] left-[45%] w-1.5 h-1.5 bg-blue-400/15 rounded-full animate-[float_8s_ease-in-out_infinite_0.4s]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(148,163,184,1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Vertical accent line on the left edge */}
        <div className="hidden lg:block absolute left-0 top-0 w-px h-full overflow-hidden">
          <div className="absolute inset-0 bg-zinc-800" />
          <div className="absolute w-full h-[30%] bg-gradient-to-b from-transparent via-sky-400/50 to-transparent animate-[scanlineV_4s_linear_infinite]" />
        </div>

        <div className="w-full max-w-[420px] relative z-10">{children}</div>

        <div className="absolute bottom-5 right-6 flex items-center gap-2.5 z-10">
          <span className="text-xs text-zinc-600 tracking-wide">Desenvolvido por</span>
          <div className="relative">
            <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-sky-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              Resolve IA
            </span>
            <div className="absolute -bottom-1 left-0 w-full h-[2px] overflow-hidden rounded-full">
              <div className="absolute inset-0 bg-zinc-800" />
              <div className="absolute h-full w-[40%] bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-[scanline_2s_linear_infinite]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
