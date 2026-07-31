import React, { useState } from 'react';
import { Card, SectionTitle, Btn } from './ui';

export default function UploadSection() {
  // 1. State สำหรับจัดการไฟล์และสถานะการโหลด
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 2. ฟังก์ชันจัดการการอัปโหลดไฟล์
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert('กรุณาเลือกไฟล์ Excel ');

    // ใช้ FormData เพื่อแพ็คไฟล์ส่งไปให้ Backend
    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    setUploadMsg('กำลังอ่านและบันทึกข้อมูลตาราง...');

    try {
      const response = await fetch('http://localhost:3001/api/upload-excel', {
        method: 'POST',
        body: formData // ส่งไฟล์เข้า API
      });
      const data = await response.json();
      
      // แสดงข้อความผลลัพธ์
      setUploadMsg(data.success ? '✅ ' + data.message : '❌ ' + data.message);
      
      // เคลียร์ไฟล์ออกเมื่ออัปโหลดสำเร็จ จะได้พร้อมอัปโหลดไฟล์ต่อไป
      if (data.success) {
        setFile(null);
        e.target.reset(); // รีเซ็ตหน้าตาช่องเลือกไฟล์
      }
    } catch (error) {
      setUploadMsg('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card style={{ marginBottom: '24px', border: '1.5px solid #A5D6A7', background: '#FAFFFE' }}>
      <SectionTitle icon="" title="ส่วนจัดการของผู้ดูแลระบบ: นำเข้าข้อมูลตารางเรียน/ตารางสอน" />
      
      {/* คำแนะนำสำหรับแอดมิน เพื่อลดความผิดพลาดในการอัปโหลดไฟล์ */}
      <div style={{ padding: '12px', background: '#E8F5E9', borderRadius: '8px', color: '#1B5E20', fontSize: '13px', marginBottom: '16px' }}>
        <strong> ข้อกำหนดไฟล์ Excel (.xlsx):</strong> 
        <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
          {/* รหัสวิชา | ชื่ออาจารย์ | รหัสห้อง | กลุ่มนักศึกษา | วัน | เวลาเริ่ม | เวลาเลิก */}
        </code>
      </div>

      <form onSubmit={handleFileUpload} style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={(e) => setFile(e.target.files[0])} 
          style={{ 
            padding: '10px', 
            border: '2px dashed #81C784', 
            borderRadius: '8px',
            background: '#fff',
            color: '#2E7D32',
            flexGrow: 1,
            cursor: 'pointer',
            fontFamily: 'Sarabun, sans-serif'
          }} 
        />
        <Btn type="submit" color="#1976D2" disabled={isLoading || !file}>
          {isLoading ? 'กำลังอัปโหลด...' : 'อัปโหลดเข้าระบบ'}
        </Btn>
      </form>

      {/* กล่องแสดงข้อความสำเร็จหรือผิดพลาด */}
      {uploadMsg && (
        <div style={{ 
          marginTop: '16px', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          background: uploadMsg.includes('✅') ? '#E8F5E9' : '#FFEBEE', 
          color: uploadMsg.includes('✅') ? '#1B5E20' : '#C62828', 
        }}>
          {uploadMsg}
        </div>
      )}
    </Card>
  );
}