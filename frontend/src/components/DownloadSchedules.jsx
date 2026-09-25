import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { 
  FileSpreadsheet, Download, CalendarDays, LoaderCircle, 
  ChevronLeft, ChevronRight, BookOpen, UserCheck, AlertCircle, Filter
} from 'lucide-react';

export default function DownloadSchedules({ academicPeriod }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🌟 States สำหรับการกรองด้วยปุ่มกด
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCurriculum, setSelectedCurriculum] = useState('all');
  
  // States สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // โหลดข้อมูลไฟล์ทั้งหมดในปี/เทอม นั้นๆ
  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (academicPeriod?.academic_year) queryParams.append('academic_year', academicPeriod.academic_year);
        if (academicPeriod?.semester) queryParams.append('semester', academicPeriod.semester);

        const response = await fetch(`${API}/academic-uploads?${queryParams.toString()}`);
        const json = await response.json();
        
        if (json.success) {
          setFiles(json.data || []);
        }
      } catch (error) {
        console.error("ดึงข้อมูลไฟล์ไม่สำเร็จ:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [academicPeriod]);

  // 🌟 ดึงรายชื่อ "หลักสูตร" ที่มีอยู่จริงในไฟล์ทั้งหมดแบบไม่ซ้ำกัน
  const uniqueCurriculums = [...new Set(files.map(f => f.curriculum || f.branch || 'ไม่ระบุหลักสูตร'))].filter(Boolean);

  // 🌟 ฟังก์ชันกรองข้อมูลตามปุ่มที่เลือก
  const filteredFiles = files.filter(file => {
    const matchType = selectedType === 'all' || (file.schedule_type || 'ทั่วไป') === selectedType;
    const matchCurriculum = selectedCurriculum === 'all' || (file.curriculum || file.branch || 'ไม่ระบุหลักสูตร') === selectedCurriculum;
    
    return matchType && matchCurriculum;
  });

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const currentData = filteredFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // รีเซ็ตหน้ากลับไปที่ 1 เมื่อมีการเปลี่ยนตัวกรอง หรือเปลี่ยนปีการศึกษา
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedCurriculum, academicPeriod]);

  return (
    <Card style={{ padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginTop: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: '12px', color: '#1B5E20' }}>
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#1B5E20', fontSize: '18px', fontWeight: 'bold' }}>ดาวน์โหลดไฟล์ตารางสอน</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>ดาวน์โหลดไฟล์ต้นฉบับ Excel ที่ถูกนำเข้าสู่ระบบแล้ว</p>
          </div>
        </div>
        
        {/* ป้ายแสดงผลว่ากำลังดูปีไหนอยู่ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '50px' }}>
          <CalendarDays size={16} color="#64748B" />
          <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
            ข้อมูลปีการศึกษา <b style={{ color: '#1B5E20' }}>{academicPeriod?.academic_year || '-'}</b> / เทอม <b style={{ color: '#1B5E20' }}>{academicPeriod?.semester || '-'}</b>
          </span>
        </div>
      </div>

      {/* 🌟 ปุ่มตัวกรองข้อมูล (Filters) 🌟 */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        
        {/* แถวที่ 1: ตัวกรองประเภท */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: 'bold', fontSize: '14px', width: '90px' }}>
            <Filter size={16} /> ประเภท :
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'ดูทั้งหมด' },
              { id: 'ตารางสอน', label: 'เฉพาะตารางสอน' },
              { id: 'ตารางเรียน', label: 'เฉพาะตารางเรียน' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                style={{
                  padding: '6px 16px', borderRadius: '50px', fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: selectedType === type.id ? '#1B5E20' : '#ffffff',
                  color: selectedType === type.id ? '#ffffff' : '#64748B',
                  border: `1px solid ${selectedType === type.id ? '#1B5E20' : '#CBD5E1'}`,
                  boxShadow: selectedType === type.id ? '0 2px 8px rgba(27,94,32,0.2)' : 'none'
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* แถวที่ 2: ตัวกรองหลักสูตร */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: 'bold', fontSize: '14px', width: '90px', marginTop: '6px' }}>
            <BookOpen size={16} /> หลักสูตร :
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            <button
              onClick={() => setSelectedCurriculum('all')}
              style={{
                padding: '6px 16px', borderRadius: '50px', fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                background: selectedCurriculum === 'all' ? '#16A34A' : '#ffffff',
                color: selectedCurriculum === 'all' ? '#ffffff' : '#64748B',
                border: `1px solid ${selectedCurriculum === 'all' ? '#16A34A' : '#CBD5E1'}`,
                boxShadow: selectedCurriculum === 'all' ? '0 2px 8px rgba(22,163,74,0.2)' : 'none'
              }}
            >
              ดูทั้งหมด
            </button>
            
            {uniqueCurriculums.map(curr => (
              <button
                key={curr}
                onClick={() => setSelectedCurriculum(curr)}
                style={{
                  padding: '6px 16px', borderRadius: '50px', fontSize: '13.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: selectedCurriculum === curr ? '#16A34A' : '#ffffff',
                  color: selectedCurriculum === curr ? '#ffffff' : '#64748B',
                  border: `1px solid ${selectedCurriculum === curr ? '#16A34A' : '#CBD5E1'}`,
                  boxShadow: selectedCurriculum === curr ? '0 2px 8px rgba(22,163,74,0.2)' : 'none'
                }}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ตารางแสดงไฟล์ */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
          <LoaderCircle size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          กำลังโหลดรายการไฟล์...
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14.5px', minWidth: '800px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', width: '40%' }}>ชื่อไฟล์เอกสาร</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', textAlign: 'center' }}>ประเภท</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold' }}>หลักสูตร/สาขา</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold' }}>วันที่อัปโหลด</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', textAlign: 'center' }}>ดาวน์โหลด</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((file) => (
                <tr key={file.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  
                  <td style={{ padding: '16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileSpreadsheet size={18} color="#16A34A" />
                      <span style={{ fontWeight: '600', color: '#0F172A' }}>{file.original_name}</span>
                    </div>
                  </td>

                  <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                    {file.schedule_type === 'ตารางสอน' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                        <UserCheck size={14} /> ตารางสอน
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                        <BookOpen size={14} /> ตารางเรียน
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '16px 14px', color: '#475569' }}>
                    {file.curriculum || file.branch || 'ไม่ระบุหลักสูตร'}
                    {file.year_level && <span style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginTop: '2px' }}>{file.year_level}</span>}
                  </td>

                  <td style={{ padding: '16px 14px', color: '#64748B', fontSize: '13.5px' }}>
                    {new Date(file.uploaded_at).toLocaleString('th-TH', { 
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })} น.
                  </td>

                  <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                    <a 
                      href={`${API.replace('/api', '')}${file.relative_path}`} 
                      download target="_blank" rel="noreferrer"
                      style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#1B5E20', color: '#ffffff', 
                        padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(27,94,32,0.2)' 
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <Download size={14} /> โหลดไฟล์
                    </a>
                  </td>

                </tr>
              ))}
              {currentData.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    <AlertCircle size={32} opacity={0.5} style={{ margin: '0 auto 12px' }} />
                    ไม่พบไฟล์ที่ตรงกับตัวกรองที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ color: '#64748B', fontSize: '14px' }}>
            แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, filteredFiles.length)} จากทั้งหมด {filteredFiles.length} รายการ
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '14px' }}>
              <ChevronLeft size={16} /> ก่อนหน้า
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)}
                style={{ width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: currentPage === page ? '#1B5E20' : '#F1F5F9', color: currentPage === page ? 'white' : '#64748B', transition: 'all 0.2s' }}>
                {page}
              </button>
            ))}
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '14px' }}>
              ถัดไป <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </Card>
  );
}