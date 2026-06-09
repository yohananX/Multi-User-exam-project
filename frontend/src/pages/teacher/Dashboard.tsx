import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, MessageSquare, Clock, CheckCircle, Loader2,
  ArrowUpRight, AlertCircle, Activity, BarChart3, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.teacher()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const subjects = data?.subjects || []
  const totalSubjects = subjects.length
  const completedSubjects = subjects.filter((s: any) => s.status === 'completed').length
  const pendingSubjects = totalSubjects - completedSubjects

  const quickActions = [
    { label: 'Upload Exam', icon: Upload, href: '/upload', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'My Uploads', icon: FileText, href: '/uploads', color: 'text-status-processing', bg: 'bg-status-processing/10' },
    { label: 'Messages', icon: MessageSquare, href: '/messages', color: 'text-status-completed', bg: 'bg-status-completed/10' },
  ]

  // Generate mock recent activity from subjects
  const recentActivity = subjects.slice(0, 5).map((s: any) => ({
    id: s.subject_id,
    type: s.status === 'completed' ? 'complete' : 'upload' as const,
    message: s.status === 'completed'
      ? `${s.subject_name} — completed`
      : `${s.subject_name} — awaiting review`,
    class_name: s.class_name,
    status: s.status,
  }))

  return (
    <div className="p-6 space-y-6 max-w-6xl animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Teacher'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your overview for today.
          </p>
        </div>
        <Button onClick={() => navigate('/upload')} className="shadow-lg shadow-primary/20">
          <Upload className="w-4 h-4 mr-2" />
          Upload Exam
        </Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover-effect">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" /> Total Subjects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSubjects}</p>
          </CardContent>
        </Card>

        <Card className="card-hover-effect">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-pending">{pendingSubjects}</p>
          </CardContent>
        </Card>

        <Card className="card-hover-effect">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-completed">{completedSubjects}</p>
          </CardContent>
        </Card>

        <Card className="card-hover-effect">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 card-hover-effect">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/subjects/${item.id}`)}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      item.type === 'complete' ? 'bg-status-completed/10' : 'bg-primary/10',
                    )}>
                      {item.type === 'complete' ? (
                        <CheckCircle className="w-4 h-4 text-status-completed" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.message}</p>
                      <p className="text-xs text-muted-foreground">{item.class_name}</p>
                    </div>
                    <Badge variant={item.status === 'completed' ? 'completed' : 'pending'}>
                      {item.status || 'active'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/upload')}>
                  Upload your first exam
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Upcoming */}
        <div className="space-y-4">
          <Card className="card-hover-effect">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.href)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', action.bg)}>
                    <action.icon className={cn('w-4 h-4', action.color)} />
                  </div>
                  <span className="text-sm font-medium flex-1">{action.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Subjects overview */}
          <Card className="card-hover-effect">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Your Subjects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subjects.length > 0 ? (
                <div className="space-y-1.5">
                  {subjects.slice(0, 5).map((s: any) => (
                    <div
                      key={s.subject_id}
                      onClick={() => navigate(`/subjects/${s.subject_id}`)}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{s.subject_name}</p>
                        <p className="text-2xs text-muted-foreground">{s.class_name}</p>
                      </div>
                      <span className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        s.status === 'completed' ? 'bg-status-completed' : 'bg-status-pending',
                      )} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No subjects assigned yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
