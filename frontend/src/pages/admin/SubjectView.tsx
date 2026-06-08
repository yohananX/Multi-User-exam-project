import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Image as ImageIcon, Clock, CheckCircle, Eye, Loader2, Trash2, FileText, Download, ScanText, FileDown, Grid3x3, ChevronDown, ChevronUp } from 'lucide-react';
import { imagesApi, subjectsApi, classesApi } from '../../api/endpoints';
import { downloadFile } from '../../api/client';

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

export default function AdminSubjectView() {
  const { subjectId } = useParams();
  const [images, setImages] = useState<any[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [ocrText, setOcrText] = useState('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrSaved, setOcrSaved] = useState(false);

  const [docxBuilt, setDocxBuilt] = useState(false);
  const [buildingDocx, setBuildingDocx] = useState(false);
  const [docxPreviews, setDocxPreviews] = useState<string[]>([]);
  const [docxPreviewIdx, setDocxPreviewIdx] = useState(0);

  const [imposeSettings, setImposeSettings] = useState({
    cols: 3, rows: 2, margin_mm: 4, gap_mm: 3,
    page_margin_cm: 0.4, split_mode: 'Auto', header_pg2: false,
    manual_scale_a: 0, manual_scale_b: 0,
  });
  const [imposing, setImposing] = useState(false);
  const [imposedReady, setImposedReady] = useState(false);
  const [imposePreviews, setImposePreviews] = useState<string[]>([]);
  const [imposePreviewIdx, setImposePreviewIdx] = useState(0);
  const [processingAll, setProcessingAll] = useState(false);
  const [panelOpen, setPanelOpen] = useState<string | null>(null);

  const apiKey = (window as any).__GEMINI_API_KEY__ || '';

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
      setDocxBuilt(!!subj?.docx_path);
      setImposedReady(!!subj?.imposed_pdf_path);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [subjectId]);

  const handleConvert = async (id: number) => {
    setConverting(prev => new Set(prev).add(id));
    try {
      await imagesApi.convert(id);
      fetchData();
    } catch (e) { console.error(e);
    } finally {
      setConverting(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleConvertAll = async () => {
    if (!subjectId) return;
    try { await imagesApi.convertAll(Number(subjectId)); fetchData(); } catch (e) { console.error(e); }
  };

  const handleExportPdf = async () => {
    if (!subjectId) return;
    setExporting(true);
    try {
      await imagesApi.exportPdf(Number(subjectId));
      const { data } = await imagesApi.downloadPdf(Number(subjectId));
      downloadFile(data.url, data.filename);
    } catch (e) { console.error(e);
    } finally { setExporting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this image?')) return;
    try { await imagesApi.delete(id); fetchData(); } catch (e) { console.error(e); }
  };

  const handleOcr = async () => {
    if (!subjectId) return;
    setOcrRunning(true);
    try {
      const res = await imagesApi.ocr(Number(subjectId), apiKey);
      setOcrText(res.data.ocr_text);
      setOcrSaved(true);
    } catch (e: any) { alert(e.response?.data?.detail || 'OCR failed');
    } finally { setOcrRunning(false); }
  };

  const handleSaveOcrText = async () => {
    if (!subjectId) return;
    try {
      await imagesApi.updateOcrText(Number(subjectId), ocrText);
      setOcrSaved(true);
    } catch (e: any) { alert(e.response?.data?.detail || 'Save failed'); }
  };

  const handleBuildDocx = async () => {
    if (!subjectId) return;
    setBuildingDocx(true);
    try {
      const res = await imagesApi.buildDocx(Number(subjectId));
      setDocxBuilt(true);
      setDocxPreviews(res.data.previews || []);
      setDocxPreviewIdx(0);
    } catch (e: any) { alert(e.response?.data?.detail || 'Build failed');
    } finally { setBuildingDocx(false); }
  };

  const handleImpose = async () => {
    if (!subjectId) return;
    setImposing(true);
    try {
      const res = await imagesApi.impose(Number(subjectId), imposeSettings);
      setImposedReady(true);
      setImposePreviews(res.data.previews || []);
      setImposePreviewIdx(0);
    } catch (e: any) { alert(e.response?.data?.detail || 'Impose failed');
    } finally { setImposing(false); }
  };

  const handleToggleStatus = async () => {
    if (!subjectId || !subject) return;
    const newStatus = subject.status === 'completed' ? 'active' : 'completed';
    try {
      await subjectsApi.updateStatus(Number(subjectId), newStatus);
      setSubject({ ...subject, status: newStatus });
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleProcessAll = async () => {
    if (!subjectId) return;
    setProcessingAll(true);
    try {
      const ocrRes = await imagesApi.ocr(Number(subjectId), apiKey);
      setOcrText(ocrRes.data.ocr_text);
      setOcrSaved(true);
      const docxRes = await imagesApi.buildDocx(Number(subjectId));
      setDocxBuilt(true);
      setDocxPreviews(docxRes.data.previews || []);
      setDocxPreviewIdx(0);
      const imposeRes = await imagesApi.impose(Number(subjectId), imposeSettings);
      setImposedReady(true);
      setImposePreviews(imposeRes.data.previews || []);
      setImposePreviewIdx(0);
      const { data: dl } = await imagesApi.downloadImposed(Number(subjectId));
      downloadFile(dl.url, dl.filename);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Process All failed at some step');
    } finally { setProcessingAll(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const pendingCount = images.filter(i => i.status === 'pending').length;
  const completedCount = images.filter(i => i.status === 'completed').length;

  const PanelToggle = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button onClick={() => setPanelOpen(panelOpen === id ? null : id)}
      className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg card-hover"
      style={{ color: 'var(--text-primary)', background: panelOpen === id ? 'var(--accent-muted)' : 'transparent' }}
    >
      <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
      {panelOpen === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  const slider = (label: string, key: string, min: number, max: number, step: number) => (
    <div>
      <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}: {String((imposeSettings as any)[key])}</label>
      <input type="range" min={min} max={max} step={step} value={(imposeSettings as any)[key]}
        onChange={e => setImposeSettings({ ...imposeSettings, [key]: Number(e.target.value) })}
        className="w-full" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{subject?.name || 'Subject'}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{className} · {images.length} image{images.length !== 1 ? 's' : ''} · {completedCount} completed</p>
          {subject?.status === 'completed' && (
            <span className="text-xs px-2.5 py-0.5 rounded-full mt-1 inline-block status-completed">Complete</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button onClick={handleProcessAll} disabled={processingAll}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
              style={{ background: '#8b5cf6' }}
            >
              {processingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
              {processingAll ? 'Processing...' : 'Process All'}
            </button>
          )}
          {pendingCount > 0 && (
            <button onClick={handleConvertAll} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
              <FileText className="w-4 h-4" /> Convert All ({pendingCount})
            </button>
          )}
          {completedCount > 0 && (
            <button onClick={handleExportPdf} disabled={exporting}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
              style={{ background: '#10b981' }}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting...' : 'Download PDF'}
            </button>
          )}
          {subject && (
            <button onClick={handleToggleStatus}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
              style={{ background: subject.status === 'completed' ? '#6b7280' : '#22c55e' }}
            >
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
              {img.file_path ? (
                <img src={`/api/images/${img.id}/file`} alt={img.title}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => window.open(`/api/images/${img.id}/file`, '_blank')}
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
              {img.file_path && (
                <a href={`/api/images/${img.id}/file`} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-surface-hover" style={{ color: 'var(--text-tertiary)' }}
                  title="View image">
                  <Eye className="w-4 h-4" />
                </a>
              )}
              {img.status === 'pending' && (
                <button onClick={() => handleConvert(img.id)} disabled={converting.has(img.id)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50">
                  {converting.has(img.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                  Convert
                </button>
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
                  <span>Images: {images.length} · Gemini API</span>
                </div>
                <button onClick={handleOcr} disabled={ocrRunning || images.length === 0}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                  {ocrRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                  {ocrRunning ? 'Running OCR...' : 'Run OCR'}
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
                <div className="flex items-center gap-2">
                  <button onClick={handleBuildDocx} disabled={buildingDocx || !ocrText.trim()}
                    className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                    {buildingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {buildingDocx ? 'Building...' : 'Build DOCX'}
                  </button>
                  {docxBuilt && (
                    <button onClick={async () => { const { data } = await imagesApi.downloadDocx(Number(subjectId)); downloadFile(data.url, data.filename); }}
                      className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
                      style={{ background: '#10b981' }}>
                      <Download className="w-4 h-4" /> Download DOCX
                    </button>
                  )}
                </div>
                {docxPreviews.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <button onClick={() => setDocxPreviewIdx(i => (i - 1 + docxPreviews.length) % docxPreviews.length)}
                        className="text-xs px-3 py-1 rounded-lg border" style={{ color: 'var(--text-secondary)' }}>Prev</button>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Page {docxPreviewIdx + 1} / {docxPreviews.length}</span>
                      <button onClick={() => setDocxPreviewIdx(i => (i + 1) % docxPreviews.length)}
                        className="text-xs px-3 py-1 rounded-lg border" style={{ color: 'var(--text-secondary)' }}>Next</button>
                    </div>
                    <img src={`data:image/png;base64,${docxPreviews[docxPreviewIdx]}`} alt="DOCX preview"
                      className="w-full rounded-lg border" style={{ borderColor: 'var(--border)' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <PanelToggle id="impose" icon={Grid3x3} label="3. Impose — Create grid PDF for printing" />
            {panelOpen === 'impose' && (
              <div className="p-4 space-y-4">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Split into Section A/B, auto-scale fonts, and arrange in a grid on landscape A4 for duplex printing.</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Grid Preset</label>
                    <div className="flex gap-2 mt-1">
                      {[
                        { label: '6-Up (3x2)', c: 3, r: 2 },
                        { label: '4-Up (2x2)', c: 2, r: 2 },
                        { label: '2-Up (2x1)', c: 2, r: 1 },
                      ].map(p => (
                        <button key={p.label} onClick={() => setImposeSettings({ ...imposeSettings, cols: p.c, rows: p.r })}
                          className="text-xs py-1.5 px-3 rounded-lg border"
                          style={{ background: imposeSettings.cols === p.c && imposeSettings.rows === p.r ? 'var(--accent)' : 'var(--surface-hover)', color: imposeSettings.cols === p.c && imposeSettings.rows === p.r ? 'white' : 'var(--text-secondary)' }}
                        >{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Section Split</label>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => setImposeSettings({ ...imposeSettings, split_mode: 'Auto' })}
                        className="text-xs py-1.5 px-3 rounded-lg border"
                        style={{ background: imposeSettings.split_mode === 'Auto' ? 'var(--accent)' : 'var(--surface-hover)', color: imposeSettings.split_mode === 'Auto' ? 'white' : 'var(--text-secondary)' }}>Auto</button>
                      <button onClick={() => setImposeSettings({ ...imposeSettings, split_mode: 'No split' })}
                        className="text-xs py-1.5 px-3 rounded-lg border"
                        style={{ background: imposeSettings.split_mode === 'No split' ? 'var(--accent)' : 'var(--surface-hover)', color: imposeSettings.split_mode === 'No split' ? 'white' : 'var(--text-secondary)' }}>No Split</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {slider('Columns', 'cols', 1, 6, 1)}
                  {slider('Rows', 'rows', 1, 6, 1)}
                  {slider('Margin (mm)', 'margin_mm', 0, 15, 0.5)}
                  {slider('Gap (mm)', 'gap_mm', 0, 10, 0.5)}
                  {slider('DOCX margin (cm)', 'page_margin_cm', 0.2, 1.5, 0.1)}
                  {slider('Scale A (0=auto)', 'manual_scale_a', 0, 1, 0.05)}
                  {slider('Scale B (0=auto)', 'manual_scale_b', 0, 1, 0.05)}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={imposeSettings.header_pg2}
                    onChange={e => setImposeSettings({ ...imposeSettings, header_pg2: e.target.checked })} />
                  Include header on page 2
                </label>

                <div className="flex items-center gap-2">
                  <button onClick={handleImpose} disabled={imposing || !docxBuilt}
                    className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50">
                    {imposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3x3 className="w-4 h-4" />}
                    {imposing ? 'Generating...' : 'Generate Imposed PDF'}
                  </button>
                  {imposedReady && (
                    <button onClick={async () => { const { data } = await imagesApi.downloadImposed(Number(subjectId)); downloadFile(data.url, data.filename); }}
                      className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
                      style={{ background: '#10b981' }}>
                      <Download className="w-4 h-4" /> Download Imposed PDF
                    </button>
                  )}
                </div>
                {imposePreviews.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <button onClick={() => setImposePreviewIdx(i => (i - 1 + imposePreviews.length) % imposePreviews.length)}
                        className="text-xs px-3 py-1 rounded-lg border" style={{ color: 'var(--text-secondary)' }}>Prev</button>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Page {imposePreviewIdx + 1} / {imposePreviews.length}</span>
                      <button onClick={() => setImposePreviewIdx(i => (i + 1) % imposePreviews.length)}
                        className="text-xs px-3 py-1 rounded-lg border" style={{ color: 'var(--text-secondary)' }}>Next</button>
                    </div>
                    <img src={`data:image/png;base64,${imposePreviews[imposePreviewIdx]}`} alt="Imposed preview"
                      className="w-full rounded-lg border" style={{ borderColor: 'var(--border)' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}