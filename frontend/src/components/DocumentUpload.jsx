import React, { useState, useEffect } from 'react';
import { Card, Btn } from './ui';
import { 
  CheckCircle2, FileUp, LoaderCircle, UploadCloud, FileText, 
  Calendar, Clock, MapPin, AlertCircle, ExternalLink 
} from 'lucide-react';
import { API } from '../utils/constants';

export default function DocumentUpload({ schedules, onUploadSuccess }) {
  // 1. จัดการข้อมูลและแยกประเภท
  const approvedSchedules = schedules.filter(s => s.status === 'อนุมัติแล้ว');
  const pendingDocs = approvedSchedules.filter(s => !s.document_path);
  const completedDocs = approvedSchedules.filter(s => s.document_path);

  // 2. States สำหรับ แท็บ, การแบ่งหน้า, และการอัปโหลด
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // เปลี่ยนจำนวนรายการต่อหน้าได้ที่นี่

  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' | 'error'

  // รีเซ็ตหน้ากลับไปที่ 1 เมื่อเปลี่ยนแท็บ
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // คำนวณข้อมูลที่จะแสดงในหน้านั้นๆ
  const displayedData = activeTab === 'pending' ? pendingDocs : completedDocs;
  const totalPages = Math.ceil(displayedData.length / itemsPerPage);
  const currentData = displayedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFileChange = (id, event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [id]: file }));
    }
  };

  const handleUpload = async (id) => {
    const file = selectedFiles[id];
    if (!file) return alert('กรุณาเลือกไฟล์เอกสาร');

    setUploadingId(id);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('document', file);
      const response = await fetch(`${API}/schedules/${id}/document`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'อัปโหลดไม่สำเร็จ');
      
      setMessage(data.message);
      setMessageType('success');
      setSelectedFiles(prev => ({ ...prev, [id]: null }));
      if (onUploadSuccess) onUploadSuccess();

    } catch (error) {
      setMessage(error.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
      setMessageType('error');
    } finally {
      setUploadingId(null);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr.slice(0, 5);
  };

  return (
    <Card style={{ marginTop: '24px', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: '12px', color: '#1B5E20' }}>
            <UploadCloud size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#1B5E20', fontSize: '18px', fontWeight: 'bold' }}>แนบเอกสารอนุมัติ</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>อัปโหลดหลักฐานการเซ็นสำหรับคำขอที่อนุมัติแล้ว</p>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #F1F5F9' }}>
        <button 
          onClick={() => setActiveTab('pending')}
          style={{
            background: 'none', border: 'none', padding: '10px 16px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
            color: activeTab === 'pending' ? '#1B5E20' : '#64748B',
            borderBottom: activeTab === 'pending' ? '3px solid #1B5E20' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          รอแนบเอกสาร 
          <span style={{ background: activeTab === 'pending' ? '#E8F5E9' : '#F1F5F9', color: activeTab === 'pending' ? '#1B5E20' : '#64748B', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
            {pendingDocs.length}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          style={{
            background: 'none', border: 'none', padding: '10px 16px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
            color: activeTab === 'completed' ? '#1B5E20' : '#64748B',
            borderBottom: activeTab === 'completed' ? '3px solid #1B5E20' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          แนบเอกสารแล้ว
          <span style={{ background: activeTab === 'completed' ? '#E8F5E9' : '#F1F5F9', color: activeTab === 'completed' ? '#1B5E20' : '#64748B', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
            {completedDocs.length}
          </span>
        </button>
      </div>
      
      {/* Alert Message */}
      {message && (
        <div style={{ 
          padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: '500',
          background: messageType === 'success' ? '#F0FDF4' : '#FEF2F2',
          color: messageType === 'success' ? '#166534' : '#991B1B',
          border: `1px solid ${messageType === 'success' ? '#BBF7D0' : '#FECACA'}`
        }}>
          {messageType === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message}
        </div>
      )}

      {/* Table Section */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14.5px', minWidth: '850px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left', fontSize: '13.5px' }}>
              <th style={{ padding: '16px', borderBottom: '2px solid #E2E8F0', fontWeight: '600' }}>ข้อมูลรายวิชา</th>
              <th style={{ padding: '16px', borderBottom: '2px solid #E2E8F0', fontWeight: '600' }}>อาจารย์ผู้สอน / กลุ่มเรียน</th>
              <th style={{ padding: '16px', borderBottom: '2px solid #E2E8F0', fontWeight: '600' }}>วัน / เวลา / สถานที่</th>
              <th style={{ padding: '16px', borderBottom: '2px solid #E2E8F0', fontWeight: '600', textAlign: 'center' }}>จัดการเอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <FileText size={32} opacity={0.5} />
                    <span>ไม่มีข้อมูลในหมวดหมู่นี้</span>
                  </div>
                </td>
              </tr>
            ) : (
              currentData.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ background: '#E8F5E9', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', width: 'fit-content' }}>
                        {item.subject_code}
                      </span>
                      <span style={{ color: '#334155', fontWeight: '500', fontSize: '14px' }}>
                        {item.subject_name || 'ไม่ระบุชื่อวิชา'}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: '#1E293B', fontWeight: '600' }}>{item.teacher_name}</span>
                      <span style={{ color: '#64748B', fontSize: '13px' }}>กลุ่ม: {item.student_group || '-'}</span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ color: '#0F172A', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="#64748B" /> {new Date(item.class_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748B' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {formatTime(item.start_time)} - {formatTime(item.end_time)} น.</span>
                        <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> {item.room_id || 'ไม่ระบุ'}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                      
                      {item.document_path && (
                         <a href={`${API.replace('/api', '')}${item.document_path}`} target="_blank" rel="noopener noreferrer" 
                            style={{ fontSize: '12px', color: '#0284C7', textDecoration: 'none', background: '#E0F2FE', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #BAE6FD' }}>
                           <ExternalLink size={12} /> ดูเอกสารปัจจุบัน
                         </a>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#ffffff', border: '1px dashed #94A3B8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: selectedFiles[item.id] ? '#166534' : '#64748B', transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#1B5E20'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#94A3B8'}
                        >
                          <FileUp size={16} color={selectedFiles[item.id] ? '#16A34A' : '#94A3B8'} />
                          {selectedFiles[item.id] ? selectedFiles[item.id].name : (item.document_path ? 'แนบไฟล์ใหม่' : 'เลือกไฟล์')}
                          <input 
                            type="file" accept=".pdf, image/png, image/jpeg" style={{ display: 'none' }}
                            onChange={(e) => handleFileChange(item.id, e)}
                          />
                        </label>
                        
                        <button 
                          onClick={() => handleUpload(item.id)}
                          disabled={uploadingId === item.id || !selectedFiles[item.id]}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px', background: (!selectedFiles[item.id] || uploadingId === item.id) ? '#CBD5E1' : '#1B5E20', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: (!selectedFiles[item.id] || uploadingId === item.id) ? 'not-allowed' : 'pointer', transition: 'background 0.2s'
                          }}
                        >
                          {uploadingId === item.id ? <><LoaderCircle size={14} style={{ animation: 'spin 1s linear infinite' }} /> โหลด...</> : 'อัปโหลด'}
                        </button>
                      </div>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#94A3B8' : '#1E293B' }}
          >
            ก่อนหน้า
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button 
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                background: currentPage === page ? '#1B5E20' : '#F1F5F9',
                color: currentPage === page ? 'white' : '#64748B'
              }}
            >
              {page}
            </button>
          ))}

          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#94A3B8' : '#1E293B' }}
          >
            ถัดไป
          </button>
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </Card>
  );
}