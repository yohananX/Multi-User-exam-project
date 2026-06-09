import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Image as ImageIcon, Clock, CheckCircle, Eye, Loader2, Trash2, FileText, Download, ScanText, FileDown, Grid3x3, ChevronDown, ChevronUp } from 'lucide-react';
import { imagesApi, subjectsApi, classesApi } from '../../api/endpoints';
import { downloadFile } from '../../api/client';
import { supabase, BUCKET_UPLOADS, BUCKET_GENERATED } from '../../lib/supabase';

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

async function getSignedUrl(bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

export default function AdminSubjectView() {
  const { subjectId } = useParams();
  const [images, setImages] = useState<any[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [ocrText, setOcrText] = useState('');
  const [ocrSaved, setOcrSaved] = useState(false);

  const [buildTriggering, setBuildTriggering] = useState(false);
  const [imposeTriggering, setImposeTriggering] = useState(false);
  const [triggerOcr, setTriggerOcr] = useState(false);

  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});
  const [docxUrl, setDocxUrl] = useState<string | null>(null);
  const [imposedUrl, setImposedUrl] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState<string | null>(null);

  const fetchData = () => {
    if (!subjectId) return;
    setLoading(true);
    Promise.all([
      imagesApi.bySubject(Number(subjectId)),
      subjectsApi.list(),
      classesApi.list(),
      imagesApi.getOcrText(Number(subjectId)),
    ]).then(([i, s, c, ocr]) => {
      setImages(i.data);
      const subj = s.data.find((x: any) => x.id === Number(subjectId));
      setSubject(subj);
      if (subj) {
        const cls = c.data.find((x: any) => x.id === subj.class_id);
        if (cls) setClassName(cls.name);
      }
      setOcrText(ocr.data?.ocr_text || '');

      // Resolve signed URLs for images
      i.data.forEach((img: any) => {
        if (img.file_path) {
          getSignedUrl(BUCKET_UPLOADS, img.file_path).then(url => {
            if (url) setImageUrls(prev => ({ ...prev, [img.id]: url }));
          });
        }
      });

      // Resolve docx/imposed signed URLs
      if (subj?.docx_path) getSignedUrl(BUCKET_GENERATED, subj.docx_path).then(setDocxUrl);
      if (subj?.imposed_pdf_path) getSignedUrl(BUCKET_GENERATED, subj.imposed_pdf_path).then(setImposedUrl);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [subjectId]);

  const handleOcr = async () => {
    if (!subjectId) return;
    setTriggerOcr(true);
    try {
      await imagesApi.ocr(Number(subjectId));
      alert('OCR queued for processing. Check back shortly.');
    } catch (e: any) {
      alert(e?.message || 'OCR failed');
    } finally {
      setTriggerOcr(false);
    }
  };

  const handleSaveOcrText = async () => {
    if (!subjectId) return;
    try {
      await imagesApi.updateOcrText(Number(subjectId), ocrText);
      setOcrSaved(true);
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    }
  };

  const handleBuildDocx = async () => {
    if (!subjectId) return;
    setBuildTriggering(true);
    try {
      await imagesApi.buildDocx(Number(subjectId));
      alert('DOCX generation queued. Check back shortly.');
    } catch (e: any) {
      alert(e?.message || 'Build failed');
    } finally {
      setBuildTriggering(false);
    }
  };

  const handleImpose = async () => {
    if (!subjectId) return;
    setImposeTriggering(true);
    try {
      await imagesApi.impose(Number(subjectId));
      alert('Imposition queued. Check back shortly.');
    } catch (e: any) {
      alert(e?.message || 'Impose failed');
    } finally {
      setImposeTriggering(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this image?')) return;
    try { await imagesApi.delete(id); fetchData(); } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async () => {
    if (!subjectId || !subject) return;
    const newStatus = subject.status === 'completed' ? 'active' : 'completed';
    try {
      await subjectsApi.updateStatus(Number(subjectId), newStatus);
      setSubject({ ...subject, status: newStatus });
    } catch (e: any) {
      alert(e?.message || 'Failed to update status');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const PanelToggle = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button onClick={() => setPanelOpen(panelOpen === id ? null : id)}
      className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg card-hover"
      style={{ color: 'var(--text-primary)', background: panelOpen === id ? 'var(--accent-muted)' : 'transparent' }}
    >
      <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
      {panelOpen === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{subject?.name || 'Subject'}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{className} · {images.length} image{images.length !== 1 ? 's' : ''}</p>
          {subject?.status === 'completed' && (
            <span className="text-xs px-2.5 py-0.5 rounded-full mt-1 inline-block status-completed">Complete</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {imposedUrl && (
            <button onClick={() => downloadFile(imposedUrl, `${subject?.name || 'exam'}_imposed.pdf`)}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm" style={{ background: '#10b981' }}>
              <Download className="w-4 h-4" /> Download Imposed PDF
            </button>
          )}
          {docxUrl && (
            <button onClick={() => downloadFile(docxUrl, `${subject?.name || 'exam'}.docx`)}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm" style={{ background: '#3b82f6' }}>
              <Download className="w-4 h-4" /> Download DOCX
            </button>
          )}
          {subject && (
            <button onClick={handleToggleStatus}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
              style={{ background: subject.status === 'completed' ? '#6b7280' : '#22c55e' }}>
              <CheckCircle className="w-4 h-4" />
              {subject.status === 'completed' ? 'Mark Active' : 'Mark Complete'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {images.map((img: any) => (
          <div key={img.id} className="card p-4 card-hover flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: 'var(--accent-muted)' }}>
              {imageUrls[img.id] ? (
                <img src={imageUrls[img.id]!} alt={img.title}
                  className="w-full h-full object-cover cursor-pointer"
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
                {new Date(img.created_at).toLocaleDateString()} · by user #{img.uploaded_by}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[img.status] || ''}`}>
              {img.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
              {img.status === 'in_review' && <Eye className="w-3.5 h-3.5" />}
              {img.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
              {statusLabels[img.status] || img.status}
            </div>
            <div className="flex items-center gap-1">
              {imageUrls[img.id] && (
                <a href={imageUrls[img.id]!} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-surface-hover" style={{ color: 'var(--text-tertiary)' }}
                  title="View image">
                  <Eye className="w-4 h-4" />
                </a>
              )}
              <button onClick={() => handleDelete(img.id)} className="p-1.5 rounded-lg hover:bg-surface-hover" style={{ color: 'var(--text-tertiary)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {images.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No images for this subject</p>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>OCR & Impose Pipeline</h2>
        </div>

        <div className="divide-y divide-border">
          <div>
            <PanelToggle id="ocr" icon={ScanText} label="1. OCR — Transcribe images to text" />
            {panelOpen === 'ocr' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Images: {images.length} · Gemini API via worker</span>
                </div>
                <button onClick={handleOcr} disabled={triggerOcr || images.length === 0}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                  {triggerOcr ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                  {triggerOcr ? 'Queueing...' : 'Queue OCR'}
                </button>
                <textarea value={ocrText} onChange={e => { setOcrText(e.target.value); setOcrSaved(false); }}
                  className="input-dark w-full h-64 text-xs font-mono" placeholder="OCR text will appear here..." />
                <div className="flex gap-2">
                  <button onClick={handleSaveOcrText} disabled={ocrSaved}
                    className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                    {ocrSaved ? 'Saved' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <PanelToggle id="build" icon={FileDown} label="2. Build DOCX — Create formatted Word document" />
            {panelOpen === 'build' && (
              <div className="p-4 space-y-3">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Build a formatted .docx from the OCR text with proper headers, sections, and Times New Roman layout.</p>
                <button onClick={handleBuildDocx} disabled={buildTriggering || !ocrText.trim()}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                  {buildTriggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {buildTriggering ? 'Queueing...' : 'Queue DOCX Build'}
                </button>
              </div>
            )}
          </div>

          <div>
            <PanelToggle id="impose" icon={Grid3x3} label="3. Impose — Create grid PDF for printing" />
            {panelOpen === 'impose' && (
              <div className="p-4 space-y-4">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Split into Section A/B, auto-scale fonts, and arrange in a grid on landscape A4 for duplex printing.</p>
                <button onClick={handleImpose} disabled={imposeTriggering || !docxUrl}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                  {imposeTriggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3x3 className="w-4 h-4" />}
                  {imposeTriggering ? 'Queueing...' : 'Queue Imposition'}
                </button>
                {imposedUrl && (
                  <button onClick={() => downloadFile(imposedUrl, `${subject?.name || 'exam'}_imposed.pdf`)}
                    className="btn-primary flex items-center gap-2 py-2 px-4 text-sm" style={{ background: '#10b981' }}>
                    <Download className="w-4 h-4" /> Download Imposed PDF
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
