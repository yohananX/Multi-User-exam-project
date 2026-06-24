import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLDivElement>(null)

  // Reset scroll on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* ── Animated gradient background (30s slow drift) ── */}
      <div
        className="fixed inset-0 bg-gradient-to-br from-background via-accent/[0.03] to-[hsl(262_80%_50%/0.04)] pointer-events-none"
        style={{
          backgroundSize: '400% 400%',
          animation: 'gradientShift 30s ease infinite',
        }}
      />

      {/* ── Background decorative orbs ── */}
      <div
        className="fixed -top-[30vh] -right-[20vw] w-[60vw] h-[60vh] bg-accent/[0.04] rounded-full blur-[120px] pointer-events-none"
        style={{ animation: 'orbFloat 40s ease-in-out infinite' }}
      />
      <div
        className="fixed -bottom-[20vh] -left-[15vw] w-[50vw] h-[50vh] bg-purple-500/[0.03] rounded-full blur-[120px] pointer-events-none"
        style={{ animation: 'orbFloat 35s ease-in-out infinite reverse' }}
      />
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(5%, 3%) scale(1.05); }
          50% { transform: translate(-3%, -2%) scale(0.95); }
          75% { transform: translate(4%, -4%) scale(1.02); }
        }
      `}</style>

      {/* ── Sidebar ── */}
      <Sidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* ── Main panel with enhanced glass effect ── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 lg:ml-[220px]">
        <div className="relative flex flex-col flex-1 bg-surface/60 backdrop-blur-2xl shadow-xl lg:shadow-2xl lg:rounded-l-[28px] lg:border-l lg:border-border/20 overflow-hidden">
          {/* Subtle inner highlight for depth */}
          <div className="absolute inset-0 pointer-events-none rounded-l-[28px] shadow-[inset_0_1px_0_hsl(var(--border)/0.08)]" />
          <Topbar onMenuToggle={() => setMobileSidebarOpen(true)} />
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto p-5 lg:p-8"
          >
            <div
              className="animate-fadeIn"
              key={location.pathname}
              style={{ animationDuration: '300ms' }}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
