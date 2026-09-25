import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { UploadCloud, FileSpreadsheet, LoaderCircle, CheckCircle2, AlertCircle, ExternalLink, CalendarDays, Lock, FileText, ChevronLeft, ChevronRight, ShieldCheck, Trash2, Filter } from 'lucide-react';

// ========================================================
// 🌟 1. Component ย่อยสำหรับ "อัปโหลด PDF ยืนยันตาราง"
// ========================================================
// 🌟 รับค่า refreshTrigger เข้ามาเพื่อสั่งให้อัปเดตข้อมูล
function VerifiedPDFUpload({ academicPeriod, refreshTrigger }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); 
  
  const [teachers, setTeachers] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [verifiedList, setVerifiedList] = useState([]); 
  
  const [isConfirm, setIsConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const [verifiedCurriculumFilter, setVerifiedCurriculumFilter] = useState('ทั้งหมด');
  const [verifiedPage, setVerifiedPage] = useState(1);
  const VERIFIED_ITEMS_PER_PAGE = 5;

  const loadData = () => {
    if (academicPeriod?.academic_year && academicPeriod?.semester) {
      const timestamp = new Date().getTime(); 
      
      // ดึงข้อมูลรายชื่ออาจารย์ใหม่
      fetch(`${API}/teachers-list?academic_year=${academicPeriod.academic_year}&semester=${academicPeriod.semester}&_t=${timestamp}`)
        .then(res => res.json())
        .then(data => { if (data.success) setTeachers(data.data); })
        .catch(console.error);

      // ดึงข้อมูลประวัติคนที่ยืนยันแล้ว
      fetch(`${API}/verified-schedules?academic_year=${academicPeriod.academic_year}&semester=${academicPeriod.semester}&_t=${timestamp}`)
        .then(res => res.json())
        .then(data => { if (data.success) setVerifiedList(data.data); })
        .catch(console.error);
    }
  };

  // 🌟 ดึงข้อมูลใหม่ทันทีที่มีการอัปโหลด Excel หรือลบ Excel (refreshTrigger เปลี่ยนค่า)
  useEffect(() => {
    loadData();
  }, [academicPeriod, refreshTrigger]);

  // รีเซ็ตฟอร์ม เฉพาะตอนที่เปลี่ยนปีการศึกษา/เทอม เท่านั้น
  useEffect(() => {
    setSelectedCurriculum('');
    setSelectedTeacher('');
    setFile(null);
    setPreviewUrl(null);
    setIsConfirm(false);
    setVerifiedCurriculumFilter('ทั้งหมด');
    setVerifiedPage(1);
  }, [academicPeriod?.academic_year, academicPeriod?.semester]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url); 
    } else {
        setPreviewUrl(null);
    }
  };

  const curriculums = useMemo(() => {
    const list = teachers.map(t => t.curriculum).filter(Boolean);
    return [...new Set(list)].sort();
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    if (!selectedCurriculum) return [];
    return teachers.filter(t => t.curriculum === selectedCurriculum).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
  }, [teachers, selectedCurriculum]);

  const verifiedCurriculumsFilterList = useMemo(() => {
    const list = verifiedList.map(v => v.curriculum).filter(Boolean);
    return ['ทั้งหมด', ...new Set(list)].sort();
  }, [verifiedList]);

  const filteredVerifiedList = useMemo(() => {
    return verifiedList.filter(v => verifiedCurriculumFilter === 'ทั้งหมด' || v.curriculum === verifiedCurriculumFilter);
  }, [verifiedList, verifiedCurriculumFilter]);

  const totalVerifiedPages = Math.ceil(filteredVerifiedList.length / VERIFIED_ITEMS_PER_PAGE);
  const paginatedVerifiedList = useMemo(() => {
    const startIndex = (verifiedPage - 1) * VERIFIED_ITEMS_PER_PAGE;
    return filteredVerifiedList.slice(startIndex, startIndex + VERIFIED_ITEMS_PER_PAGE);
  }, [filteredVerifiedList, verifiedPage]);

  useEffect(() => { setVerifiedPage(1); }, [verifiedCurriculumFilter]);

  const handleUpload = async () => {
    if (!academicPeriod?.academic_year) return alert('กรุณาเลือกปีการศึกษาด้านบนก่อนครับ');
    if (!selectedTeacher || !file) return;
    if (!isConfirm) return alert('กรุณาติ๊กยืนยันความถูกต้องก่อนทำการล็อคตารางสอน');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('teacher_name', selectedTeacher);
    formData.append('academic_year', academicPeriod.academic_year);
    formData.append('semester', academicPeriod.semester);

    setIsUploading(true);
    try {
      const res = await fetch(`${API}/upload-verified-pdf`, { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        alert('✅ ' + data.message);
        
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl); 
        setPreviewUrl(null);
        setSelectedCurriculum('');
        setSelectedTeacher('');
        setIsConfirm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        loadData(); 
      } else {
        alert('❌ ' + data.message); 
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePDF = async (teacherName) => {
    if (!window.confirm(`⚠️ คำเตือน: คุณต้องการลบไฟล์หลักฐานของ "${teacherName}" ใช่หรือไม่?\n\nเมื่อลบแล้ว ตารางสอนนี้จะถูกปลดล็อคและสามารถแก้ไขข้อมูลได้อีกครั้ง`)) return;

    try {
        const res = await fetch(`${API}/verified-schedules?teacher_name=${encodeURIComponent(teacherName)}&academic_year=${academicPeriod.academic_year}&semester=${academicPeriod.semester}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ ลบไฟล์หลักฐานสำเร็จ');
            loadData();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  return (
    <div style={{ padding: '28px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: '#1E293B', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
        <div style={{ background: '#DCFCE7', padding: '10px', borderRadius: '10px', color: '#16A34A' }}>
          <ShieldCheck size={26} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>เอกสารยืนยันตารางสอน (PDF)</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
            อัปโหลดตารางสอน ปีการศึกษา <strong style={{ color: '#16A34A' }}>{academicPeriod?.academic_year || '-'}</strong> 
          </p>
        </div>
      </div>

      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>1. เลือกหลักสูตร</label>
            <select value={selectedCurriculum} onChange={e => { setSelectedCurriculum(e.target.value); setSelectedTeacher(''); }} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#F8FAFC', cursor: 'pointer' }}>
              <option value="">-- ระบุหลักสูตร --</option>
              {curriculums.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>2. เลือกบุคลากร</label>
            <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} disabled={!selectedCurriculum} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: selectedCurriculum ? '#F8FAFC' : '#E2E8F0', cursor: selectedCurriculum ? 'pointer' : 'not-allowed' }}>
              <option value="">{selectedCurriculum ? '-- เลือกอาจารย์ --' : 'กรุณาเลือกหลักสูตรก่อน'}</option>
              {filteredTeachers.map((t, idx) => <option key={idx} value={t.teacher_name}>{t.teacher_name}</option>)}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>3. แนบไฟล์ (PDF)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} disabled={!selectedTeacher} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: selectedTeacher ? 'pointer' : 'not-allowed', zIndex: 2, top: 0, left: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', border: '1px dashed #CBD5E1', background: selectedTeacher ? '#F8FAFC' : '#E2E8F0', color: file ? '#16A34A' : '#64748B', position: 'relative', zIndex: 1, height: '42px', boxSizing: 'border-box' }}>
                        <FileText size={18} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file ? file.name : 'คลิกเลือกไฟล์ PDF...'}</span>
                    </div>
                </div>

                {previewUrl && (
                    <a 
                      href={previewUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', padding: '0 16px', background: '#DBEAFE', color: '#1E3A8A', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #BFDBFE', transition: '0.2s', zIndex: 3 }}
                      onMouseOver={e => e.currentTarget.style.background = '#BFDBFE'} onMouseOut={e => e.currentTarget.style.background = '#DBEAFE'}
                    >
                      <ExternalLink size={16} /> ดูไฟล์
                    </a>
                )}
            </div>
          </div>
        </div>

        {file && selectedTeacher && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isConfirm} 
                onChange={e => setIsConfirm(e.target.checked)} 
                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: '#854D0E', fontWeight: '600', lineHeight: '1.5' }}>
                ข้าพเจ้าตรวจสอบแล้วว่าไฟล์นี้เป็นตารางสอนของ <u>{selectedTeacher}</u> ถูกต้องตามปีการศึกษา<br/>
                และขอยืนยันเพื่อ <b>"ล็อคตารางสอน"</b> ไม่ให้แก้ไขได้อีก
              </span>
            </label>
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button onClick={handleUpload} disabled={!file || !selectedTeacher || !isConfirm || isUploading} style={{ padding: '12px 28px', borderRadius: '8px', border: 'none', background: (!file || !selectedTeacher || !isConfirm || isUploading) ? '#CBD5E1' : '#16A34A', color: '#ffffff', fontWeight: 'bold', fontSize: '15px', cursor: (!file || !selectedTeacher || !isConfirm || isUploading) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
            {isUploading ? <><LoaderCircle size={18} style={{ animation: 'spin 1s linear infinite' }} /> กำลังตรวจสอบและล็อค...</> : <><Lock size={18} /> ล็อคตารางสอน</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, color: '#1E293B', fontSize: '16px' }}>บุคลากรที่ยืนยันตารางสอนแล้ว (มีไฟล์หลักฐาน)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="#64748B" />
          <select value={verifiedCurriculumFilter} onChange={e => setVerifiedCurriculumFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', background: '#ffffff', cursor: 'pointer' }}>
            {verifiedCurriculumsFilterList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {paginatedVerifiedList.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', background: '#ffffff', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
            <FileText size={28} opacity={0.5} style={{ margin: '0 auto 8px' }} />
            {verifiedList.length === 0 ? 'ยังไม่มีบุคลากรที่ได้รับการล็อคตารางสอนในเทอมนี้' : 'ไม่พบข้อมูลในหลักสูตรที่เลือก'}
          </div>
        ) : paginatedVerifiedList.map((v, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '10px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Lock size={18} color="#16A34A" />
              <div>
                <strong style={{ display: 'block', fontSize: '14.5px', color: '#1E293B' }}>{v.teacher_name}</strong>
                <span style={{ fontSize: '13px', color: '#64748B' }}>{v.curriculum || 'ไม่ระบุหลักสูตร'}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {v.verified_pdf_path && (
                <a 
                  href={`${API.replace('/api', '')}${v.verified_pdf_path}`} target="_blank" rel="noreferrer" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#F1F5F9', color: '#0F172A', borderRadius: '8px', fontSize: '13.5px', fontWeight: 'bold', textDecoration: 'none', transition: '0.2s', border: '1px solid #E2E8F0' }}
                  onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; }}
                  onMouseOut={e => { e.currentTarget.style.background = '#F1F5F9'; }}
                >
                  <FileText size={16} /> ดูไฟล์หลักฐาน
                </a>
              )}
              <button 
                onClick={() => handleDeletePDF(v.teacher_name)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                onMouseOver={e => { e.currentTarget.style.background = '#FEE2E2'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                title="ลบไฟล์เอกสารนี้"
              >
                <Trash2 size={16} /> ลบ
              </button>
            </div>

          </div>
        ))}
      </div>

      {totalVerifiedPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setVerifiedPage(p => Math.max(p - 1, 1))} disabled={verifiedPage === 1} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: verifiedPage === 1 ? 'not-allowed' : 'pointer', color: verifiedPage === 1 ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '13px' }}>
            <ChevronLeft size={16} /> กลับ
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: totalVerifiedPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setVerifiedPage(page)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', background: verifiedPage === page ? '#1B5E20' : '#fff', color: verifiedPage === page ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                {page}
              </button>
            ))}
          </div>
          <button onClick={() => setVerifiedPage(p => Math.min(p + 1, totalVerifiedPages))} disabled={verifiedPage === totalVerifiedPages} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: verifiedPage === totalVerifiedPages ? 'not-allowed' : 'pointer', color: verifiedPage === totalVerifiedPages ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '13px' }}>
            ถัดไป <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}


// ========================================================
// 🌟 2. Component หลัก (UploadSection)
// ========================================================
export default function UploadSection({ academicPeriod }) {
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [storedFiles, setStoredFiles] = useState([]);
  
  // 🌟 เพิ่ม State สำหรับบอกกล่อง PDF ให้โหลดใหม่
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const loadStoredFiles = (period) => {
    if (!period?.academic_year || !period?.semester) {
      setStoredFiles([]);
      return;
    }
    const timestamp = new Date().getTime(); 
    const query = new URLSearchParams({ ...period, _t: timestamp });
    
    fetch(`${API}/academic-uploads?${query.toString()}`)
      .then(response => response.json())
      .then(json => { 
        if (json.success) {
          setStoredFiles(json.data || []);
          setCurrentPage(1); 
        }
      })
      .catch(() => setStoredFiles([]));
  };

  useEffect(() => {
    loadStoredFiles(academicPeriod);
  }, [academicPeriod]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert('กรุณาเลือกไฟล์ Excel');

    if (!academicPeriod?.academic_year || !academicPeriod?.semester) {
      setUploadMsg({ type: 'error', text: 'กรุณาตั้งค่าปีการศึกษาบนเมนูด้านบนก่อนนำเข้าข้อมูล' });
      return;
    }

    const formData = new FormData();
    formData.append('academic_year', academicPeriod.academic_year);
    formData.append('semester', academicPeriod.semester);
    formData.append('file', file);

    setIsLoading(true);
    setUploadMsg({ type: 'info', text: 'กำลังอ่านและบันทึกข้อมูลตารางลงฐานข้อมูล...' });

    try {
      const response = await fetch(`${API}/upload-excel`, { method: 'POST', body: formData });
      const data = await response.json();
      
      setUploadMsg({ type: data.success ? 'success' : 'error', text: data.message });
      if (data.success) {
        setFile(null);
        e.target.reset();
        loadStoredFiles(academicPeriod);
        
        // 🌟 สั่งให้กล่อง PDF โหลดข้อมูลใหม่ทันที
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      setUploadMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUpload = async (id, fileName) => {
    if (!window.confirm(`คุณต้องการลบประวัติและไฟล์ "${fileName}" ออกจากระบบใช่หรือไม่?\n(คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้)`)) return;

    try {
      const response = await fetch(`${API}/academic-uploads/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        alert('🗑️ ลบไฟล์สำเร็จ');
        loadStoredFiles(academicPeriod);
        
        // 🌟 สั่งให้กล่อง PDF โหลดข้อมูลใหม่ทันทีเผื่อรายชื่ออาจารย์หายไป
        setRefreshTrigger(prev => prev + 1);
      } else {
        alert('❌ ' + data.message);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const totalPages = Math.ceil(storedFiles.length / ITEMS_PER_PAGE);
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return storedFiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [storedFiles, currentPage]);

  return (
    <Card style={{ padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginTop: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: '12px', color: '#1B5E20' }}>
            <UploadCloud size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#1B5E20', fontSize: '18px', fontWeight: 'bold' }}>นำเข้าข้อมูลตารางเรียน / ตารางสอน (Excel)</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>อัปโหลดไฟล์ Excel เพื่อนำข้อมูลวิชาเข้าสู่ฐานข้อมูลระบบ</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '50px' }}>
          <CalendarDays size={16} color="#64748B" />
          <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
            ทำงานบน ปี <b style={{ color: '#1B5E20' }}>{academicPeriod?.academic_year || '-'}</b> / เทอม <b style={{ color: '#1B5E20' }}>{academicPeriod?.semester || '-'}</b>
          </span>
        </div>
      </div>

      <form onSubmit={handleFileUpload} style={{ display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input type="file" accept=".xlsx, .xls" required onChange={(e) => setFile(e.target.files[0])} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '2px dashed #94A3B8', borderRadius: '12px', background: '#F8FAFC', color: file ? '#1B5E20' : '#64748B', transition: 'all 0.2s', height: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
            <FileSpreadsheet size={20} color={file ? '#16A34A' : '#94A3B8'} />
            <span style={{ fontWeight: '500', fontSize: '14.5px' }}>{file ? file.name : 'คลิกหรือลากไฟล์ Excel มาวางที่นี่...'}</span>
          </div>
        </div>

        <button type="submit" disabled={isLoading || !file || !academicPeriod?.academic_year} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: (!file || isLoading || !academicPeriod?.academic_year) ? '#CBD5E1' : '#1B5E20', color: '#ffffff', border: 'none', padding: '0 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: (!file || isLoading || !academicPeriod?.academic_year) ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
          {isLoading ? <><LoaderCircle size={18} style={{ animation: 'spin 1s linear infinite' }} /> กำลังอัปโหลด...</> : <><UploadCloud size={18} /> อัปโหลดเข้าสู่ระบบ</>}
        </button>
      </form>

      {uploadMsg.text && (
        <div style={{ padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: '600', background: uploadMsg.type === 'success' ? '#F0FDF4' : uploadMsg.type === 'error' ? '#FEF2F2' : '#F0F9FF', color: uploadMsg.type === 'success' ? '#166534' : uploadMsg.type === 'error' ? '#991B1B' : '#0369A1', border: `1px solid ${uploadMsg.type === 'success' ? '#BBF7D0' : uploadMsg.type === 'error' ? '#FECACA' : '#BAE6FD'}` }}>
          {uploadMsg.type === 'success' ? <CheckCircle2 size={18} /> : uploadMsg.type === 'error' ? <AlertCircle size={18} /> : <LoaderCircle size={18} style={{ animation: 'spin 1s linear infinite' }} />}
          {uploadMsg.text}
        </div>
      )}

      <h3 style={{ margin: '0 0 16px 0', color: '#1E293B', fontSize: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>ประวัติการอัปโหลด Excel (ปีการศึกษาปัจจุบัน)</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {storedFiles.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
            <FileSpreadsheet size={32} opacity={0.5} style={{ margin: '0 auto 8px' }} />
            ยังไม่มีไฟล์ถูกนำเข้าในปีการศึกษาและภาคเรียนนี้
          </div>
        ) : paginatedFiles.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.borderColor = '#1B5E20'} onMouseOut={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            
            <a href={`${API.replace('/api', '')}${item.relative_path}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#1E293B', flex: 1 }}>
              <FileSpreadsheet size={20} color="#16A34A" />
              <div>
                <strong style={{ display: 'block', fontSize: '14.5px', marginBottom: '4px' }}>{item.original_name}</strong>
                <div style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ background: item.schedule_type === 'ตารางสอน' ? '#ECFDF5' : '#EFF6FF', color: item.schedule_type === 'ตารางสอน' ? '#047857' : '#1D4ED8', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{item.schedule_type || 'ทั่วไป'}</span>
                  <span style={{ color: '#64748B' }}>{item.curriculum || 'ไม่ระบุหลักสูตร'} {item.year_level ? `(${item.year_level})` : ''}</span>
                </div>
              </div>
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#64748B', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={14} /> {new Date(item.uploaded_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.</span>
              <button 
                onClick={() => handleDeleteUpload(item.id, item.original_name)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#FEE2E2'} onMouseOut={e => e.currentTarget.style.background = '#FEF2F2'}
                title="ลบไฟล์และประวัติการอัปโหลดนี้"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
          <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#94A3B8' : '#1E293B', fontWeight: 'bold' }}><ChevronLeft size={16} /> กลับ</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: currentPage === page ? '#1B5E20' : '#fff', color: currentPage === page ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer' }}>{page}</button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#94A3B8' : '#1E293B', fontWeight: 'bold' }}>ถัดไป <ChevronRight size={16} /></button>
        </div>
      )}

      {/* 🌟 ส่งตัวแปรเชื่อมโยง (Trigger) ไปให้กล่อง PDF */}
      <VerifiedPDFUpload academicPeriod={academicPeriod} refreshTrigger={refreshTrigger} />

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </Card>
  );
}