import React, { useState, useEffect } from 'react'
import { Card, SectionTitle, Btn, Input } from './ui'

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    academic_year: '',
    semester: '',
    allow_booking: true,
    allow_search: true
  })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 1. ดึงข้อมูลจาก Local Storage ตอนเปิดหน้าเว็บ
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('system_settings')
      if (savedSettings) {
        const parsedData = JSON.parse(savedSettings)
        setSettings({
          academic_year: parsedData.academic_year || '',
          semester: parsedData.semester || '',
          allow_booking: parsedData.allow_booking !== false,
          allow_search: parsedData.allow_search !== false
        })
      }
    } catch (error) {
      console.error('ไม่สามารถโหลดข้อมูลจาก Local Storage ได้')
    }
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    })
    setMessage('')
    setMessageType('')
  }

  // 2. บันทึกข้อมูลลง Local Storage เมื่อกดปุ่ม
  const handleSave = () => {
    setIsLoading(true)
    setMessage('กำลังบันทึก...')
    setMessageType('info')

    // ใช้ setTimeout เพื่อจำลองการโหลดเล็กน้อยให้ระบบดูมีการประมวลผล
    setTimeout(() => {
      try {
        localStorage.setItem('system_settings', JSON.stringify(settings))
        setMessage('บันทึกการตั้งค่าลงในระบบเรียบร้อยแล้ว')
        setMessageType('success')
      } catch (error) {
        setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        setMessageType('error')
      } finally {
        setIsLoading(false)
      }
    }, 500)
  }

  return (
    <Card style={{ marginBottom: '24px' }}>
      <SectionTitle icon="" title="ตั้งค่าระบบ" />
      
      <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ส่วนที่ 1: ตั้งค่าภาคการศึกษา */}
        <div style={{ border: '1px solid #E0E0E0', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#1565C0' }}>ตั้งค่าภาคการศึกษาปัจจุบัน</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input label="ปีการศึกษา" name="academic_year" value={settings.academic_year} onChange={handleChange} placeholder="เช่น 2569" />
            <Input label="ภาคเรียนที่" name="semester" value={settings.semester} onChange={handleChange} placeholder="เช่น 1 หรือ 2" />
          </div>
        </div>

        {/* ส่วนที่ 2: ตั้งค่าระบบทั่วไป */}
        <div style={{ border: '1px solid #E0E0E0', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#E65100' }}>การควบคุมระบบ</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F5F5F5' }}>
            <span style={{ fontWeight: 500, color: '#424242' }}>เปิดรับคำขอสอนชดเชยจากเจ้าหน้าที่</span>
            <input type="checkbox" name="allow_booking" checked={settings.allow_booking} onChange={handleChange} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <span style={{ fontWeight: 500, color: '#424242' }}>เปิดระบบค้นหาตารางเรียนสำหรับนักศึกษาทั่วไป</span>
            <input type="checkbox" name="allow_search" checked={settings.allow_search} onChange={handleChange} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
          </div>
        </div>

        {/* ส่วนแสดงข้อความแจ้งเตือนและปุ่มบันทึก */}
        {message && (
          <div style={{ fontWeight: 'bold', color: messageType === 'success' ? '#2E7D32' : (messageType === 'error' ? '#C62828' : '#1565C0') }}>
            {message}
          </div>
        )}
        
        <Btn onClick={handleSave} disabled={isLoading} color="#2E7D32" style={{ marginTop: '10px' }}>
          {isLoading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
        </Btn>

      </div>
    </Card>
  )
}