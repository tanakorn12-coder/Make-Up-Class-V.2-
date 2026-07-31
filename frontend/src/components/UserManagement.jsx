import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: '' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'teacher' });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/admin/users`);
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch (error) {
      console.error("Error fetching users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const json = await res.json();
      alert(json.message);
      
      if (json.success) {
        setShowAddForm(false);
        setNewUser({ username: '', password: '', name: '', role: 'teacher' });
        fetchUsers();
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user.id);
    setEditForm({ name: user.name, role: user.role });
  };

  const handleSaveOrToggleBlock = async (userId, updatedData) => {
    try {
      const res = await fetch(`${API}/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิก "${username}" ออกจากระบบ?`)) {
      try {
        const res = await fetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          alert(json.message);
          fetchUsers();
        }
      } catch (error) {
        alert("เกิดข้อผิดพลาดในการลบ");
      }
    }
  };

  return (
    <Card style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #E8F5E9', paddingBottom: '12px' }}>
        <h2 style={{ margin: 0, color: '#1B5E20', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ระบบจัดการสมาชิก
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666', background: '#f5f5f5', padding: '6px 12px', borderRadius: '20px' }}>
            จำนวนทั้งหมด: <b>{users.length}</b> คน
          </span>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ backgroundColor: showAddForm ? '#757575' : '#1B5E20', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {showAddForm ? 'ยกเลิก' : '+ เพิ่มสมาชิกใหม่'}
          </button>
        </div>
      </div>

      {/* 🌟 ฟอร์มเพิ่มสมาชิก (แก้กรอบสีเทาออก เน้นเรียบหรูสว่างๆ) */}
      {showAddForm && (
        <form onSubmit={handleAddUser} style={{ background: '#FFFFFF', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1B5E20', marginBottom: '16px', fontSize: '16px' }}>ข้อมูลสมาชิกใหม่</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>Username (ไอดีล็อคอิน)</label>
              <input required type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>Password (รหัสผ่าน)</label>
              <input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>ชื่อ-นามสกุล (ไม่ต้องใส่คำนำหน้า)</label>
              <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>สิทธิ์การใช้งาน (Role)</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }}>
                <option value="teacher">อาจารย์ (Teacher)</option>
                <option value="staff">เจ้าหน้าที่ (Staff)</option>
                <option value="executive">ผู้บริหาร (Executive)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>

          </div>
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <button type="submit" style={{ backgroundColor: '#1B5E20', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>กำลังโหลดข้อมูลสมาชิก...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#E8F5E9', color: '#1B5E20', borderBottom: '2px solid #C8E6C9' }}>
                <th style={{ padding: '12px 8px' }}>ID</th>
                <th style={{ padding: '12px 8px' }}>Username (ไอดี)</th>
                <th style={{ padding: '12px 8px' }}>ชื่อ - นามสกุล</th>
                <th style={{ padding: '12px 8px' }}>สิทธิ์ (Role)</th>
                <th style={{ padding: '12px 8px' }}>สถานะ</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #eee', backgroundColor: user.is_blocked ? '#FFF3F3' : 'transparent' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600 }}>{user.id}</td>
                  <td style={{ padding: '14px 8px', color: '#555' }}>{user.username}</td>
                  
                  <td style={{ padding: '14px 8px' }}>
                    {editingUser === user.id ? (
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', width: '90%' }} />
                    ) : ( user.name )}
                  </td>

                  <td style={{ padding: '14px 8px' }}>
                    {editingUser === user.id ? (
                      <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                        <option value="teacher">teacher</option>
                        <option value="staff">staff</option>
                        <option value="executive">executive</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span style={{ background: user.role === 'admin' ? '#E1F5FE' : '#F5F5F5', color: user.role === 'admin' ? '#0288D1' : '#333', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                        {user.role}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 8px' }}>
                    {user.is_blocked ? (
                      <span style={{ color: '#C62828', backgroundColor: '#FFEBEE', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>ถูกระงับ</span>
                    ) : (
                      <span style={{ color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>ปกติ</span>
                    )}
                  </td>

                  {/* 🌟 เปลี่ยนอิโมจิเป็นข้อความปุ่มที่ดูเป็นมืออาชีพ */}
                  <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {editingUser === user.id ? (
                      <>
                        <button onClick={() => handleSaveOrToggleBlock(user.id, { name: editForm.name, role: editForm.role, is_blocked: user.is_blocked })} style={{ backgroundColor: '#2E7D32', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>บันทึก</button>
                        <button onClick={() => setEditingUser(null)} style={{ backgroundColor: '#757575', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditClick(user)} style={{ backgroundColor: '#0288D1', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>แก้ไข</button>
                        <button onClick={() => handleSaveOrToggleBlock(user.id, { name: user.name, role: user.role, is_blocked: !user.is_blocked })} style={{ backgroundColor: user.is_blocked ? '#4CAF50' : '#F57C00', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                          {user.is_blocked ? 'ปลดระงับ' : 'ระงับสิทธิ์'}
                        </button>
                        <button onClick={() => handleDeleteUser(user.id, user.username)} style={{ backgroundColor: '#C62828', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>ลบ</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}