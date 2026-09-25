import React, { useState, useEffect } from 'react';
import { Card } from './ui'; // ใช้ Card จาก UI ของคุณ
import { Lock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { API } from '../utils/constants';

export default function VerifiedPDFUpload({ academicPeriod, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // ดึงรายชื่ออาจารย์ที่มีตารางสอนในเทอมนี้มาเป็นตัวเลือก
  useEffect(() => {
    if (academicPeriod?.academic_year && academicPeriod?.semester) {
      fetch(`${API}/teachers-list?academic_year=${academicPeriod.academic_year}&semester=${academicPeriod.semester}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // เรียงชื่อตัวอักษร
            const sortedTeachers = data.data.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
            setTeachers(sortedTeachers);
          }
        })
        .catch(console.error);
    }
  }, [academicPeriod]);

  const handleUpload = async () => {
    if (!academicPeriod?.academic_year) {
      return alert('กรุณาเลือกปีการศึกษาและภาคเรียนที่แถบด้านบนก่อนครับ');
    }
    if (!selectedTeacher) return alert('กรุณาเลือกชื่ออาจารย์ที่ต้องการล็อคตาราง');
    if (!file) return alert('กรุณาเลือกไฟล์ PDF ยืนยันตารางสอน');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('teacher_name', selectedTeacher);
    formData.append('academic_year', academicPeriod.academic_year);
    formData.append('semester', academicPeriod.semester);

    setIsUploading(true);
    try {
      const res = await fetch(`${API}/upload-verified-pdf`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        alert('✅ ' + data.message);
        setFile(null);
        setSelectedTeacher('');
        // ถ้ามีการส่งฟังก์ชันโหลดตารางใหม่มา ให้เรียกใช้งาน
        if (onUploadSuccess) onUploadSuccess();
      } else {
        alert('❌ ' + data.message);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card style={{ padding: '24px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#1E293B' }}>
        <div style={{ background: '#DCFCE7', padding: '8px', borderRadius: '8px', color: '#16A34A' }}>
          <Lock size={24} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>อัปโหลดเอกสารยืนยันและล็อคตารางสอน</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
            แนบไฟล์ PDF ที่มีลายเซ็นยืนยันจากอาจารย์ เพื่อล็อคตารางสอนไม่ให้ถูกแก้ไขหรือลบ
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        
        {/* เลือกอาจารย์ */}
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>
            1. เลือกบุคลากร
          </label>
          <select 
            value={selectedTeacher} 
            onChange={e => setSelectedTeacher(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#F8FAFC' }}
          >
            <option value="">-- กรุณาเลือกอาจารย์ --</option>
            {teachers.map((t, idx) => (
              <option key={idx} value={t.teacher_name}>{t.teacher_name}</option>
            ))}
          </select>
        </div>

        {/* เลือกไฟล์ PDF */}
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>
            2. แนบไฟล์เอกสาร (PDF)
          </label>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={e => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '9px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#F8FAFC' }}
          />
        </div>

        {/* ปุ่มยืนยัน */}
        <div>
          <button 
            onClick={handleUpload}
            disabled={!file || !selectedTeacher || isUploading}
            style={{ 
              padding: '12px 24px', borderRadius: '8px', border: 'none',
              background: (!file || !selectedTeacher || isUploading) ? '#CBD5E1' : '#16A34A', 
              color: '#ffffff', fontWeight: 'bold', fontSize: '15px', cursor: (!file || !selectedTeacher || isUploading) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
            }}
          >
            {isUploading ? 'กำลังอัปโหลด...' : <><CheckCircle2 size={18} /> ล็อคตารางสอน</>}
          </button>
        </div>

      </div>

      {!academicPeriod?.academic_year && (
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontSize: '13.5px', fontWeight: 'bold' }}>
          <AlertCircle size={16} /> กรุณาเลือกปีการศึกษาและภาคเรียนที่แท็บเมนูด้านบนก่อน
        </div>
      )}
    </Card>
  );
}