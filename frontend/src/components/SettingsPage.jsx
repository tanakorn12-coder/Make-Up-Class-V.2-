import React, { useState } from 'react'
import { Card, SectionTitle, Btn, Input } from './ui'

export default function SettingsPage() {
  // 1. State สำหรับภาคการศึกษา
  const [semesters, setSemesters] = useState([
    { id: 1, term: '1', year: '2568', isCurrent: false },
    { id: 2, term: '2', year: '2568', isCurrent: true },
  ])
  const [newSemester, setNewSemester] = useState({ term: '', year: '' })

  // 2. State สำหรับรายวิชา
  const [subjects, setSubjects] = useState([
    { id: 1, code: 'BSCCT303', name: 'System Analysis and Design', credit: 3 },
    { id: 2, code: 'BSCCT601', name: 'Web Technology', credit: 3 },
  ])
  const [newSubject, setNewSubject] = useState({ code: '', name: '', credit: '' })

  // ฟังก์ชันเพิ่มภาคการศึกษา
  const handleAddSemester = (e) => {
    e.preventDefault()
    if (!newSemester.term || !newSemester.year) return
    const id = Date.now()
    setSemesters([...semesters, { id, ...newSemester, isCurrent: false }])
    setNewSemester({ term: '', year: '' })
  }

  // ฟังก์ชันตั้งเป็นภาคเรียนปัจจุบัน
  const handleSetCurrentSemester = (id) => {
    setSemesters(semesters.map(s => ({ ...s, isCurrent: s.id === id })))
  }

  // ฟังก์ชันเพิ่มรายวิชา
  const handleAddSubject = (e) => {
    e.preventDefault()
    if (!newSubject.code || !newSubject.name) return
    const id = Date.now()
    setSubjects([...subjects, { id, ...newSubject }])
    setNewSubject({ code: '', name: '', credit: '' })
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      
      {/* ── ส่วนที่ 1: จัดการภาคการศึกษา ── */}
      <Card>
        <SectionTitle icon="📅" title="จัดการภาคการศึกษา และ ปีการศึกษา" />
        
        <form onSubmit={handleAddSemester} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <Input 
              label="ภาคเรียน (เช่น 1, 2, 3)" 
              value={newSemester.term} 
              onChange={e => setNewSemester({...newSemester, term: e.target.value})} 
              placeholder="ระบุภาคเรียน" required 
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input 
              label="ปีการศึกษา (เช่น 2568)" 
              value={newSemester.year} 
              onChange={e => setNewSemester({...newSemester, year: e.target.value})} 
              placeholder="ระบุปีการศึกษา" required 
            />
          </div>
          <Btn type="submit" color="#1976D2">➕ เพิ่มข้อมูล</Btn>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#E8F5E9', color: '#2E7D32', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderRadius: '8px 0 0 0' }}>ภาคเรียน/ปีการศึกษา</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>สถานะ</th>
              <th style={{ padding: '10px', textAlign: 'center', borderRadius: '0 8px 0 0' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {semesters.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F1F8E9' }}>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>{s.term} / {s.year}</td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  {s.isCurrent ? (
                    <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '4px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 'bold' }}>เทอมปัจจุบัน</span>
                  ) : (
                    <span style={{ color: '#9E9E9E', fontSize: 12 }}>-</span>
                  )}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  {!s.isCurrent && (
                    <Btn small outline color="#F57C00" onClick={() => handleSetCurrentSemester(s.id)}>
                      ตั้งเป็นเทอมปัจจุบัน
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── ส่วนที่ 2: จัดการรายวิชา ── */}
      <Card>
        <SectionTitle icon="📚" title="จัดการข้อมูลรายวิชา" />
        
        <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <Input 
              label="รหัสวิชา" 
              value={newSubject.code} 
              onChange={e => setNewSubject({...newSubject, code: e.target.value})} 
              placeholder="เช่น BSCCT303" required 
            />
          </div>
          <div style={{ flex: 2 }}>
            <Input 
              label="ชื่อวิชา" 
              value={newSubject.name} 
              onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
              placeholder="เช่น System Analysis and Design" required 
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input 
              label="หน่วยกิต" 
              type="number"
              value={newSubject.credit} 
              onChange={e => setNewSubject({...newSubject, credit: e.target.value})} 
              placeholder="เช่น 3" required 
            />
          </div>
          <Btn type="submit" color="#2E7D32">➕ เพิ่มรายวิชา</Btn>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F1F8E9', color: '#2E7D32', textAlign: 'left' }}>
                <th style={{ padding: '10px', borderRadius: '8px 0 0 0' }}>รหัสวิชา</th>
                <th style={{ padding: '10px' }}>ชื่อวิชา</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>หน่วยกิต</th>
                <th style={{ padding: '10px', textAlign: 'center', borderRadius: '0 8px 0 0' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(sub => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #F1F8E9' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 600, color: '#1565C0' }}>{sub.code}</td>
                  <td style={{ padding: '12px 10px' }}>{sub.name}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>{sub.credit}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <Btn small outline color="#E53935" onClick={() => setSubjects(subjects.filter(s => s.id !== sub.id))}>ลบ</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}