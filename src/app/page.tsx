import SearchForm from '@/components/SearchForm';
import { BusFront, Map } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 flex flex-col items-center p-4 sm:p-8 md:p-12 selection:bg-zinc-200 dark:selection:bg-zinc-800 overflow-x-hidden">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 md:gap-12 relative z-10">
        
        {/* Header */}
        <header className="flex flex-col gap-2 items-center text-center mt-4 md:mt-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl shadow-xl shadow-zinc-900/20 dark:shadow-white/10">
              <BusFront size={28} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Kolkata Travel Router</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto balance text-balance">
            Find the fastest bus routes and metro connections across the city of joy.
          </p>
        </header>

        {/* Main Search Interface */}
        <div className="w-full relative z-20">
          <SearchForm />
        </div>
        
        {/* Footer */}
        <footer className="mt-auto pt-16 pb-8 text-center text-sm text-muted-foreground">
          <p>Made with Next.js and Tailwind CSS.</p>
        </footer>

      </div>
      
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-lighten" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-purple-500/5 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-lighten" />
      </div>
    </main>
  );
}
