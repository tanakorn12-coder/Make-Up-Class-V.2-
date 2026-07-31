import React, { useState } from 'react';
import { Card, SectionTitle, Btn } from './ui';

export default function DocumentUpload({ schedules, onUploadSuccess }) {
  // 1. กรองเฉพาะรายการที่ "อนุมัติแล้ว" เพื่อนำมาแนบเอกสารหลักฐาน
  const approvedSchedules = schedules.filter(s => s.status === 'อนุมัติแล้ว');

  // 2. State สำหรับเก็บไฟล์ที่เลือก (แยกตาม ID ของคำขอ) และสถานะการโหลด
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  // ฟังก์ชันเมื่อมีการเลือกไฟล์
  const handleFileChange = (id, event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [id]: file }));
    }
  };

  // ฟังก์ชันส่งไฟล์ไปบันทึก (จำลองการส่งเข้า API)
  const handleUpload = async (id) => {
    const file = selectedFiles[id];
    if (!file) return alert('กรุณาเลือกไฟล์เอกสาร');

    setUploadingId(id);

    try {
      // 📝 โค้ดสำหรับส่งไป Backend (เตรียมไว้ให้ใช้งานจริง)
      /*
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch(`http://localhost:3001/api/schedules/${id}/document`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      */

      // จำลองการดีเลย์ของการอัปโหลด 1 วินาที
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`อัพโหลดเอกสารสำหรับรหัสคำขอ ${id} สำเร็จ!`);
      
      // เคลียร์ไฟล์ที่อัปโหลดแล้วออก
      setSelectedFiles(prev => ({ ...prev, [id]: null }));
      if (onUploadSuccess) onUploadSuccess();

    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัพโหลดไฟล์');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Card style={{ marginTop: '24px' }}>
      <SectionTitle icon="" title="อัพโหลดเอกสารอนุมัติ (หลักฐานการเซ็น)" />
      
      <p style={{ fontSize: '14px', color: '#616161', marginBottom: '20px' }}>
        * กรุณาแนบไฟล์สแกน (PDF หรือรูปภาพ) ของใบคำขอที่ได้รับการลงนามอนุมัติจากผู้บริหารเรียบร้อยแล้ว
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#F1F8E9', color: '#2E7D32', textAlign: 'left' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #C8E6C9' }}>วันที่สอน</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #C8E6C9' }}>อาจารย์</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #C8E6C9' }}>ห้องเรียน</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #C8E6C9', textAlign: 'center' }}>แนบไฟล์เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {approvedSchedules.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#9E9E9E' }}>
                  ไม่มีรายการที่รอแนบเอกสารในขณะนี้
                </td>
              </tr>
            ) : (
              approvedSchedules.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #EEEEEE' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {new Date(item.class_date).toLocaleDateString('th-TH')}
                  </td>
                  <td style={{ padding: '12px' }}>{item.teacher_name}</td>
                  <td style={{ padding: '12px' }}>{item.room_id}</td>
                  
                  <td style={{ padding: '12px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                    {/* ช่องเลือกไฟล์ */}
                    <input 
                      type="file" 
                      accept=".pdf, image/png, image/jpeg" 
                      onChange={(e) => handleFileChange(item.id, e)}
                      style={{ 
                        fontSize: '12px', 
                        padding: '6px', 
                        border: '1px solid #E0E0E0', 
                        borderRadius: '4px',
                        maxWidth: '200px'
                      }} 
                    />
                    
                    {/* ปุ่มอัปโหลด */}
                    <Btn 
                      small 
                      color="#0288D1" 
                      onClick={() => handleUpload(item.id)}
                      disabled={uploadingId === item.id || !selectedFiles[item.id]}
                    >
                      {uploadingId === item.id ? 'กำลังโหลด...' : 'อัพโหลด'}
                    </Btn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}