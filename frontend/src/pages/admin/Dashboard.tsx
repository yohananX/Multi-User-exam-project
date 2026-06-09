import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, FileText, CheckCircle, Clock, AlertCircle, Loader2,
  Activity, BarChart3, TrendingUp, School,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.admin()
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

  const stats = [
    { label: 'Total Submissions', value: data?.total_images || 0, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Pending Review', value: data?.pending || 0, icon: Clock, color: 'text-status-pending', bg: 'bg-status-pending/10' },
    { label: 'Processing', value: data?.in_review || 0, icon: AlertCircle, color: 'text-status-processing', bg: 'bg-status-processing/10' },
    { label: 'Completed', value: data?.completed || 0, icon: CheckCircle, color: 'text-status-completed', bg: 'bg-status-completed/10' },
    { label: 'Teachers', value: data?.total_teachers || 0, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Subjects', value: data?.total_subjects || 0, icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            School-wide overview and submission management.
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="card-hover-effect">
              <CardHeader className="pb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-1', s.bg)}>
                  <Icon className={cn('w-4 h-4', s.color)} />
                </div>
                <CardDescription className="text-xs font-medium">{s.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent uploads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2 card-hover-effect">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recent_uploads?.length > 0 ? (
              <div className="space-y-1">
                {data.recent_uploads.map((u: any) => (
                  <div
                    key={u.id}
                    onClick={() => navigate(`/admin/subjects/${u.subject_id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.class_name} · {u.subject_name}
                      </p>
                    </div>
                    <Badge variant={u.status === 'completed' ? 'completed' : 'pending'}>
                      {u.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent uploads</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
