import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, Image as ImageIcon, Loader2, Clock, CheckCircle, Eye, Check } from 'lucide-react';
import { imagesApi, subjectsApi, classesApi } from '../../api/endpoints';
import { supabase, BUCKET_UPLOADS } from '../../lib/supabase';

const statusStyles: Record<string, string> = {
  pending: 'status-pending',
  in_review: 'status-in_review',
  completed: 'status-completed',
};
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  completed: 'Completed',
};
const statusIcons: Record<string, any> = {
  pending: Clock,
  in_review: Eye,
  completed: CheckCircle,
};

export default function TeacherSubjectView() {
  const { subjectId } = useParams();
  const [images, setImages] = useState<any[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    if (!subjectId) return;
    setLoading(true);
    Promise.all([
      imagesApi.bySubject(Number(subjectId)),
      subjectsApi.list(),
      classesApi.list(),
    ]).then(([i, s, c]) => {
      setImages(i.data);
      const subj = s.data.find((x: any) => x.id === Number(subjectId));
      setSubject(subj);
      setClasses(c.data);
      i.data.forEach((img: any) => {
        if (img.file_path) {
          supabase.storage.from(BUCKET_UPLOADS).createSignedUrl(img.file_path, 3600).then(({ data }) => {
            if (data?.signedUrl) setImageUrls(prev => ({ ...prev, [img.id]: data.signedUrl }));
          });
        }
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [subjectId]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !subject || !subjectId) return;
    setUploading(true);
    setSuccessCount(0);
    try {
      await imagesApi.uploadMultiple(subject.class_id, Number(subjectId), Array.from(files));
      setSuccessCount(files.length);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const className = classes.find(c => c.id === subject?.class_id)?.name || '';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{subject?.name || 'Subject'}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{className} · {images.length} image{images.length !== 1 ? 's' : ''}</p>
        </div>
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : successCount > 0 ? (
            <Check className="w-4 h-4" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Uploading...' : successCount > 0 ? `${successCount} Uploaded` : 'Add Images'}
        </button>
      </div>

      <div className="space-y-2">
        {images.map((img: any) => {
          const StatIcon = statusIcons[img.status] || Clock;
          return (
            <div key={img.id} className="card p-4 card-hover flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--accent-muted)' }}>
                {imageUrls[img.id] ? (
                  <img src={imageUrls[img.id]!} alt={img.title} className="w-full h-full object-cover"
                    onClick={() => window.open(imageUrls[img.id]!, '_blank')}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <ImageIcon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{String(img.number).padStart(3, '0')}</span>
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{img.title}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(img.created_at).toLocaleDateString()} · by {img.uploaded_by || 'Unknown'}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[img.status] || ''}`}>
                <StatIcon className="w-3.5 h-3.5" />
                {statusLabels[img.status] || img.status}
              </div>
            </div>
          );
        })}
        {images.length === 0 && (
          <div className="card p-12 text-center">
            <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No images uploaded yet</p>
            <button onClick={() => fileRef.current?.click()} className="btn-primary mt-4 py-2 px-4 text-sm">Upload Images</button>
          </div>
        )}
      </div>
    </div>
  );
}
