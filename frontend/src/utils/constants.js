export const API = `${import.meta.env.VITE_API_URL}/api`;

//เก็บไว้ให้ฉัน 3 อันล่างนี้ไม่เอาออก 
// export const API = 'http://localhost:3001/api'
// https://api.render.com/deploy/srv-dar0ssm0tbcc738ji590?key=OPjMrounJIQ
// export const API = import.meta.env.VITE_API_URL;

export const STATUS_MAP = {
  'รอตรวจสอบ':          { bg: '#FFF8E1', text: '#795548', dot: '#F9A825' },
  'รอผู้บริหารอนุมัติ': { bg: '#E3F2FD', text: '#1565C0', dot: '#1976D2' },
  'อนุมัติแล้ว':        { bg: '#E8F5E9', text: '#2E7D32', dot: '#388E3C' },
  'ไม่อนุมัติ':         { bg: '#FFEBEE', text: '#C62828', dot: '#D32F2F' },
  'ตีกลับ':             { bg: '#F5F5F5', text: '#616161', dot: '#9E9E9E' },
}

export const ROLE_LABELS = {
  staff:     'เจ้าหน้าที่',
  admin:     'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
}

export const MSG_STYLE = {
  success: { bg: '#E8F5E9', color: '#2E7D32', icon: '✅' },
  error:   { bg: '#FFEBEE', color: '#C62828', icon: '❌' },
  warn:    { bg: '#FFF8E1', color: '#F57F17', icon: '⚠️' },
  info:    { bg: '#E3F2FD', color: '#1565C0', icon: '⏳' },
}

export const getStatus = (s) =>
  STATUS_MAP[s] || { bg: '#F1F8E9', text: '#558B2F', dot: '#8BC34A' }

export const getStatusCounts = (schedules) => {
  if (!Array.isArray(schedules)) {
    return { total: 0, pending: 0, approved: 0, waiting: 0 };
  }

  return {
    total:    schedules.length,
    pending:  schedules.filter(s =>
      !s.status ||
      s.status === 'รออนุมัติ' ||
      s.status === 'รอตรวจสอบ' ||
      s.status === 'รอผู้บริหารพิจารณา'
    ).length,
    approved: schedules.filter(s => s.status === 'อนุมัติแล้ว').length,
    waiting:  schedules.filter(s => s.status === 'รอผู้บริหารพิจารณา').length,
  };
}
