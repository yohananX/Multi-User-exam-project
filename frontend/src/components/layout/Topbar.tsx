import { Bell, Search, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title?: string
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export function Topbar({ title, onToggleSidebar, sidebarCollapsed }: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-5 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="text-muted-foreground">
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        )}
        {title && (
          <h1 className="text-sm font-semibold">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-xs rounded-lg"
          />
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </Button>
      </div>
    </header>
  )
}
