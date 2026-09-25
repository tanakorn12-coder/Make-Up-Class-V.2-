import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { 
  Check, LoaderCircle, Plus, Search, UserPlus, X, 
  Edit2, Trash2, Lock, Unlock, Shield, GraduationCap, 
  Briefcase, UserCog, BookOpen 
} from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: '' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'teacher' });
  const [isAdding, setIsAdding] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
    if (isAdding) return;
    setIsAdding(true);
    setFormMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const json = await res.json();
      
      if (json.success) {
        setFormMessage({ type: 'success', text: json.message });
        setShowAddForm(false);
        setNewUser({ username: '', password: '', name: '', role: 'teacher' });
        await fetchUsers();
      } else {
        setFormMessage({ type: 'error', text: json.message || 'ไม่สามารถเพิ่มสมาชิกได้' });
      }
    } catch (error) {
      setFormMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || [user.username, user.name, user.role, user.curriculum].some(value => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (roleFilter === 'all' || user.role === roleFilter);
  });

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
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(json.message);
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
          fetchUsers();
        } else {
          alert(json.message);
        }
      } catch (error) {
        alert("เกิดข้อผิดพลาดในการลบ");
      }
    }
  };

  // ฟังก์ชันแยกประเภทสิทธิ์การใช้งาน (Role Badge)
  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': 
        return { label: 'ผู้ดูแลระบบ', color: '#0284C7', bg: '#E0F2FE', icon: <Shield size={14} /> };
      case 'executive': 
        return { label: 'ผู้บริหาร', color: '#7C3AED', bg: '#EDE9FE', icon: <Briefcase size={14} /> };
      case 'staff': 
        return { label: 'เจ้าหน้าที่', color: '#D97706', bg: '#FEF3C7', icon: <UserCog size={14} /> };
      case 'teacher': 
        return { label: 'อาจารย์', color: '#16A34A', bg: '#DCFCE7', icon: <GraduationCap size={14} /> };
      default: 
        return { label: role, color: '#475569', bg: '#F1F5F9', icon: <UserPlus size={14} /> };
    }
  };

  // Styles
  const inputStyle = {
    padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', 
    fontSize: '14px', backgroundColor: '#ffffff', color: '#1E293B', width: '100%', boxSizing: 'border-box'
  };

  return (
    <Card style={{ padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginTop: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: '12px', color: '#1B5E20' }}>
            <UserPlus size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#1B5E20', fontSize: '18px', fontWeight: 'bold' }}>ระบบจัดการสมาชิก</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>จัดการบัญชี สิทธิ์การใช้งาน และดูข้อมูลหลักสูตรของอาจารย์</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '50px', fontWeight: '600' }}>
            สมาชิกทั้งหมด <b style={{ color: '#1B5E20', marginLeft: '4px' }}>{users.length}</b>
          </span>
          <button onClick={() => { setShowAddForm(!showAddForm); setFormMessage({ type: '', text: '' }); }} type="button" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: showAddForm ? '#F1F5F9' : '#1B5E20', color: showAddForm ? '#475569' : 'white', border: 'none', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' }}>
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? 'ปิดฟอร์ม' : 'เพิ่มสมาชิกใหม่'}
          </button>
        </div>
      </div>

      {formMessage.text && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: '500', background: formMessage.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: formMessage.type === 'success' ? '#166534' : '#991B1B', border: `1px solid ${formMessage.type === 'success' ? '#BBF7D0' : '#FECACA'}` }}>
          {formMessage.type === 'success' ? <Check size={18} /> : <X size={18} />}
          {formMessage.text}
        </div>
      )}

      {/* ฟอร์มเพิ่มสมาชิก */}
      {showAddForm && (
        <form onSubmit={handleAddUser} style={{ background: '#F8FAFC', padding: '24px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #E2E8F0' }}>
          <h3 style={{ marginTop: 0, color: '#0F172A', marginBottom: '20px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '16px', background: '#1B5E20', borderRadius: '4px' }}></span>
            ข้อมูลสมาชิกใหม่
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#475569' }}>Username (ไอดีเข้าสู่ระบบ)</label>
              <input required type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#475569' }}>Password (รหัสผ่าน)</label>
              <input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#475569' }}>ชื่อ-นามสกุล</label>
              <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={inputStyle} placeholder="ไม่ต้องใส่คำนำหน้า" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: '600', color: '#475569' }}>สิทธิ์การใช้งาน (Role)</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={inputStyle}>
                <option value="teacher">อาจารย์ (Teacher)</option>
                <option value="staff">เจ้าหน้าที่ (Staff)</option>
                <option value="executive">ผู้บริหาร (Executive)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>

          </div>
          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <button disabled={isAdding} type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: isAdding ? '#94A3B8' : '#1B5E20', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: isAdding ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}>
              {isAdding ? <><LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite' }} /> กำลังบันทึก...</> : <><Check size={18} /> บันทึกสมาชิก</>}
            </button>
          </div>
        </form>
      )}

      {/* แถบค้นหาและตัวกรอง */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="#64748B" />
          <input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="ค้นหาชื่อ, username, role หรือ หลักสูตร..." 
            style={{ border: 'none', background: 'transparent', outline: 'none', padding: '12px', width: '100%', fontSize: '14px', color: '#1E293B' }} 
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputStyle, width: '180px', background: '#F8FAFC' }}>
          <option value="all">ดูทุกสิทธิ์การใช้งาน</option>
          <option value="teacher">เฉพาะ อาจารย์</option>
          <option value="staff">เฉพาะ เจ้าหน้าที่</option>
          <option value="executive">เฉพาะ ผู้บริหาร</option>
          <option value="admin">เฉพาะ ผู้ดูแลระบบ</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
          <LoaderCircle size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          กำลังโหลดข้อมูลสมาชิก...
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14.5px', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '16px 14px', fontWeight: 'bold' }}>ไอดีใช้งาน (Username)</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold' }}>ข้อมูลผู้ใช้งาน</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold' }}>หลักสูตร / สาขา</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', textAlign: 'center' }}>สิทธิ์การใช้งาน</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', textAlign: 'center' }}>สถานะ</th>
                <th style={{ padding: '16px 14px', fontWeight: 'bold', textAlign: 'center' }}>จัดการบัญชี</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const badge = getRoleBadge(user.role);
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: user.is_blocked ? '#FEF2F2' : '#ffffff', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = user.is_blocked ? '#FEE2E2' : '#F8FAFC'} onMouseOut={e => e.currentTarget.style.backgroundColor = user.is_blocked ? '#FEF2F2' : '#ffffff'}>
                    
                    {/* คอลัมน์ที่ 1: Username */}
                    <td style={{ padding: '16px 14px' }}>
                      <div style={{ color: '#0F172A', fontWeight: 'bold', fontSize: '14.5px' }}>
                        {user.username}
                      </div>
                    </td>
                    
                    {/* คอลัมน์ที่ 2: ชื่อผู้ใช้งาน */}
                    <td style={{ padding: '16px 14px' }}>
                      {editingUser === user.id ? (
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, padding: '8px 12px' }} />
                      ) : ( 
                        <div style={{ color: '#1E293B', fontWeight: '600' }}>
                          {user.title && user.title !== 'อาจารย์' && user.role === 'teacher' ? `${user.title} ` : (user.role === 'teacher' ? 'อ. ' : '')}
                          {user.name}
                        </div>
                      )}
                    </td>

                    {/* คอลัมน์ที่ 3: หลักสูตร */}
                    <td style={{ padding: '16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px' }}>
                        {user.role === 'teacher' ? (
                          <>
                            <BookOpen size={14} color="#94A3B8" />
                            {user.curriculum || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>รออัปเดตจากไฟล์ตารางสอน</span>}
                          </>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>-</span>
                        )}
                      </div>
                    </td>

                    {/* คอลัมน์ที่ 4: สิทธิ์การใช้งาน */}
                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                      {editingUser === user.id ? (
                        <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} style={{ ...inputStyle, padding: '8px 12px' }}>
                          <option value="teacher">อาจารย์ (teacher)</option>
                          <option value="staff">เจ้าหน้าที่ (staff)</option>
                          <option value="executive">ผู้บริหาร (executive)</option>
                          <option value="admin">ผู้ดูแลระบบ (admin)</option>
                        </select>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: badge.bg, color: badge.color, padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                          {badge.icon} {badge.label}
                        </div>
                      )}
                    </td>

                    {/* คอลัมน์ที่ 5: สถานะบล็อค */}
                    <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                      {user.is_blocked ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#B91C1C', backgroundColor: '#FEE2E2', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                          <Lock size={12} /> ถูกระงับ
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803D', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                          <Unlock size={12} /> ปกติ
                        </div>
                      )}
                    </td>

                    {/* คอลัมน์ที่ 6: จัดการ */}
                    <td style={{ padding: '16px 14px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {editingUser === user.id ? (
                          <>
                            <button onClick={() => handleSaveOrToggleBlock(user.id, { name: editForm.name, role: editForm.role, is_blocked: user.is_blocked })} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1B5E20', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}><Check size={14}/> บันทึก</button>
                            <button onClick={() => setEditingUser(null)} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#64748B', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}><X size={14}/> ยกเลิก</button>
                          </>
                        ) : (
                          <>
                            <button title="แก้ไข" onClick={() => handleEditClick(user)} style={{ backgroundColor: '#F1F5F9', color: '#0284C7', border: '1px solid #E0F2FE', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Edit2 size={16} /></button>
                            <button title={user.is_blocked ? "ปลดระงับ" : "ระงับสิทธิ์"} onClick={() => handleSaveOrToggleBlock(user.id, { name: user.name, role: user.role, is_blocked: !user.is_blocked })} style={{ backgroundColor: '#F1F5F9', color: user.is_blocked ? '#16A34A' : '#D97706', border: `1px solid ${user.is_blocked ? '#DCFCE7' : '#FEF3C7'}`, padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                              {user.is_blocked ? <Unlock size={16} /> : <Lock size={16} />}
                            </button>
                            <button title="ลบผู้ใช้" onClick={() => handleDeleteUser(user.id, user.username)} style={{ backgroundColor: '#F1F5F9', color: '#DC2626', border: '1px solid #FEE2E2', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </Card>
  );
}