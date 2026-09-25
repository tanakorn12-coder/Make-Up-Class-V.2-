const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

const path = require('path');

let pdfParse;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.error('❌ ยังไม่ได้ติดตั้ง pdf-parse! โปรดรัน npm install pdf-parse');
}

// Excel ใช้ temp ก่อน แล้ว route จะย้ายไฟล์ต้นฉบับไปโฟลเดอร์ตามปี/ภาคเรียน
const upload = multer({ dest: 'uploads/.tmp/' });
const documentUpload = multer({
    dest: 'uploads/documents/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        callback(null, allowed.includes(file.mimetype));
    },
});

// ==========================================
// 🌟 1. ตัวแปรสำหรับรับไฟล์ PDF (ปรับ Path ให้ปลอดภัย 100%)
// ==========================================
const verifiedPdfUpload = multer({
    dest: path.join(__dirname, 'uploads', 'verified_schedules'),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (file.mimetype === 'application/pdf') {
            callback(null, true);
        } else {
            callback(new Error('รองรับเฉพาะไฟล์ PDF เท่านั้น'), false);
        }
    },
    
});



const app = express();

fs.mkdirSync(path.join(__dirname, 'uploads', 'documents'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads', '.tmp'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads', 'verified_schedules'), { recursive: true }); // 🌟 โฟลเดอร์เก็บ PDF ยืนยันตาราง

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'schedule_db',
    password: '1234',
    port: 5432,
});

// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/schedule_db',
//     ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
// });

pool.connect()
    .then(async () => {
        // อัปเดตตารางเดิม
        await pool.query(`ALTER TABLE main_classes ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10), ADD COLUMN IF NOT EXISTS semester VARCHAR(10)`);
        await pool.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10), ADD COLUMN IF NOT EXISTS semester VARCHAR(10)`);
        await pool.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS document_path TEXT, ADD COLUMN IF NOT EXISTS document_name TEXT`);
        
        // 🌟 เพิ่มคอลัมน์สำหรับระบบ Lock ตารางสอน
        await pool.query(`ALTER TABLE main_classes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS verified_pdf_path TEXT`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS academic_uploads (
                id SERIAL PRIMARY KEY,
                academic_year VARCHAR(10) NOT NULL,
                semester VARCHAR(10) NOT NULL,
                branch TEXT,
                curriculum TEXT,
                schedule_type VARCHAR(20) NOT NULL DEFAULT 'student',
                year_level TEXT,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`ALTER TABLE academic_uploads ADD COLUMN IF NOT EXISTS branch TEXT`);
        await pool.query(`ALTER TABLE academic_uploads ADD COLUMN IF NOT EXISTS curriculum TEXT, ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) NOT NULL DEFAULT 'student', ADD COLUMN IF NOT EXISTS year_level TEXT`);
        console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ!');
    })
    .catch(err => console.error('❌ เกิดข้อผิดพลาด', err.stack));

// ==========================================
// Helper Function: คัดกรองและรวมกลุ่มเรียนที่ซ้ำซ้อน
// ==========================================
const mergeAndCleanGroups = (groupsArray) => {
    if (!groupsArray || groupsArray.length === 0) return '';
    let validGroups = groupsArray.filter(Boolean);
    validGroups.sort((a, b) => b.length - a.length);
    const keptGroups = [];
    validGroups.forEach(g => {
        const cleanG = g.replace(/\s+/g, ''); 
        const isDuplicate = keptGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
        if (!isDuplicate) {
            keptGroups.push(g);
        }
    });
    return keptGroups.sort().join(' | ');
};

// ==========================================
// API: นำเข้าข้อมูล (เวอร์ชันแก้ปัญหาการจับคู่กลุ่มเรียนไม่ตรง)
// ==========================================
app.post('/api/import-excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; 
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); 

        let updateCount = 0;
        let failCount = 0;

        console.log('--- เริ่มวิเคราะห์ไฟล์ Excel ---');

        for (const row of data) {
            const subjectCode = row['รหัสวิชา']?.toString().trim();
            const studentGroup = row['กลุ่มเรียน']?.toString().trim();
            const teacherName = row['อาจารย์ผู้สอน']?.toString().trim();
            
            if (!subjectCode || !teacherName) continue;

            const updateQuery = `
                UPDATE main_classes 
                SET teacher_name = $1 
                FROM class_student_groups 
                WHERE main_classes.id = class_student_groups.class_id 
                AND main_classes.subject_code = $2 
                AND class_student_groups.student_group ILIKE $3
            `;
            
            const values = [teacherName, subjectCode, `${studentGroup}%` || '%'];
            
            const result = await pool.query(updateQuery, values);
            
            if (result.rowCount > 0) {
                updateCount += result.rowCount;
                console.log(`อัปเดตสำเร็จ: ${subjectCode} (${studentGroup}) -> ${teacherName}`);
            } else {
                failCount++;
                console.log(`ค้นหาไม่พบในฐานข้อมูล: วิชา ${subjectCode} กลุ่ม ${studentGroup}`);
            }
        }

        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: `อัปเดตสำเร็จ ${updateCount} รายการ, ไม่พบ ${failCount} รายการ` });

    } catch (error) {
        console.error('Import Error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

// ==========================================
// 🌟 API: อัปโหลด PDF เพื่อล็อคตารางสอน (คืนค่าการทำงานแบบอิสระ)
// ==========================================
app.post('/api/upload-verified-pdf', verifiedPdfUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ PDF' });

        const teacher_name = req.body.teacher_name;
        const academic_year = req.body.academic_year;
        const semester = req.body.semester;

        if (!teacher_name || !academic_year || !semester) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
        }

        // จัดการเปลี่ยนชื่อและบันทึกไฟล์
        const safeTeacherName = teacher_name.replace(/[^\wก-๙]/g, '_');
        const fileName = `VERIFIED_${academic_year}_${semester}_${safeTeacherName}_${Date.now()}.pdf`;
        const targetPath = path.join(req.file.destination, fileName);
        
        fs.renameSync(req.file.path, targetPath);
        const relativePath = `/uploads/verified_schedules/${fileName}`;

        // ล็อคตารางในฐานข้อมูล
        const updateQuery = `
            UPDATE main_classes 
            SET is_locked = true, verified_pdf_path = $1 
            WHERE REPLACE(teacher_name, ' ', '') ILIKE $2
            AND academic_year = $3 AND semester = $4
        `;
        
        const cleanName = teacher_name.replace(/\s+/g, '');
        const result = await pool.query(updateQuery, [relativePath, `%${cleanName}%`, academic_year, semester]);

        if (result.rowCount === 0) {
            return res.json({ success: false, message: `ไม่พบตารางสอนของ ${teacher_name} ในปีการศึกษา ${academic_year}/${semester} (ระบบจึงไม่ได้ล็อคข้อมูล)` });
        }

        res.json({ success: true, message: `ล็อคตารางสอนจำนวน ${result.rowCount} รายการ สำเร็จแล้ว!`, pdf_path: relativePath });

    } catch (error) {
        console.error('Verified PDF Upload Error:', error);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: `ระบบขัดข้อง: ${error.message}` });
    }
});

/**
 * API สำหรับดึงข้อมูลชื่ออาจารย์แบบอัตโนมัติ
 */
app.get('/api/get-subject-info', async (req, res) => {
    const { subject_code, student_group } = req.query;

    if (!subject_code || !student_group) {
        return res.json({ success: false, message: 'กรุณาระบุรหัสวิชาและกลุ่มเรียน' });
    }

    try {
        const query = `
            SELECT m.teacher_name 
            FROM main_classes m
            JOIN class_student_groups csg ON m.id = csg.class_id
            WHERE m.subject_code = $1 
            AND csg.student_group ILIKE $2 
            AND m.teacher_name IS NOT NULL 
            AND m.teacher_name NOT IN ('', 'ไม่ระบุ', '[null]')
            ORDER BY CASE WHEN m.teacher_name = 'ไม่ระบุ' THEN 2 ELSE 1 END, m.teacher_name ASC
            LIMIT 1
        `;
        
        const values = [subject_code.trim(), `%${student_group.trim()}%`];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            res.json({ success: true, teacher_name: result.rows[0].teacher_name });
        } else {
            res.json({ success: false, message: 'ไม่พบชื่ออาจารย์ในระบบ (กรุณาอัปโหลดตารางสอน)' });
        }
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
    }
});

// ==========================================
// API: ตรวจสอบการชนกันของตาราง
// ==========================================
app.post('/api/check-schedule', async (req, res) => {
    // 🌟 ดึง academic_year และ semester มาใช้งานด้วย
    const { teacher_name, student_group, year_level, class_date, start_time, end_time, room_id, academic_year, semester } = req.body;

    try {
        const daysMap = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const dayOfWeek = daysMap[new Date(class_date).getDay()];

        let cleanTeacherName = teacher_name ? teacher_name.replace(/อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|ดร\./g, '').trim().replace(/\s+/g, '') : '';
        let cleanRoom = room_id ? room_id.trim() : '';

        let checkGroupString = '';
        let displayGroupName = student_group || '';
        if (student_group) {
            let g = student_group.replace(/\s*\([ทป.,\s]+\)$/, '').trim(); 
            if (g.includes('-')) {
                checkGroupString = g.substring(g.indexOf('-') + 1).trim().replace(/\s+/g, '');
                displayGroupName = g.substring(g.indexOf('-') + 1).trim();
            } else {
                checkGroupString = g.replace(/\s+/g, '');
                displayGroupName = g;
            }
        }

        const regQuery = `
            SELECT m.teacher_name, m.room_id, m.subject_code, m.subject_name, m.start_time::text, m.end_time::text, csg.student_group 
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE m.day_of_week = $1 
            AND m.start_time < $3::time AND m.end_time > $2::time
            AND m.academic_year = $7 AND m.semester = $8
            AND (
                ($4 != '' AND REPLACE(m.teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(m.room_id) ILIKE $5) OR
                ($6 != '' AND (
                    REPLACE(csg.student_group, ' ', '') ILIKE '%' || $6 || '%' OR
                    REPLACE(g.full_name, ' ', '') ILIKE '%' || $6 || '%'
                ))
            )
            LIMIT 1
        `;
        // 🌟 ส่งค่าปีและเทอมเข้าไปเช็คด้วย
        const regResult = await pool.query(regQuery, [dayOfWeek, start_time, end_time, cleanTeacherName, cleanRoom, checkGroupString, academic_year, semester]);

        if (regResult.rows.length > 0) {
            const conflict = regResult.rows[0];
            const dbTeacher = conflict.teacher_name ? conflict.teacher_name.replace(/\s+/g, '') : '';
            const dbRoom = conflict.room_id ? conflict.room_id.trim() : '';
            const dbGroup = conflict.student_group ? conflict.student_group.replace(/\s+/g, '') : '';
            const subName = conflict.subject_name ? conflict.subject_name.split('-')[0].trim() : '';

            let reasons = [];
            if (checkGroupString && dbGroup.includes(checkGroupString)) reasons.push(`นักศึกษากลุ่ม "${displayGroupName}" ติดเรียน`);
            if (cleanTeacherName && dbTeacher.includes(cleanTeacherName)) reasons.push(`อาจารย์ผู้สอนติดสอน`);
            if (cleanRoom && dbRoom.toLowerCase() === cleanRoom.toLowerCase() && reasons.length === 0) reasons.push(`ห้อง ${conflict.room_id} ไม่ว่าง`);
            
            let reasonStr = reasons.length > 0 ? reasons.join(' และ ') : 'เวลาชน';
            return res.json({ isConflict: true, message: `❌ ไม่สามารถลงได้: ${reasonStr} (ตารางปกติ วิชา ${conflict.subject_code} ${subName} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)} น.)` });
        }

        const mkQuery = `
            SELECT teacher_name, room_id, subject_code, subject_name, start_time::text, end_time::text, student_group 
            FROM schedules
            WHERE class_date = $1
            AND start_time < $3::time AND end_time > $2::time
            AND status IN ('รอตรวจสอบ', 'อนุมัติแล้ว', 'รอผู้บริหารพิจารณา')
            AND academic_year = $7 AND semester = $8
            AND (
                ($4 != '' AND REPLACE(teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(room_id) ILIKE $5) OR
                ($6 != '' AND REPLACE(student_group, ' ', '') ILIKE '%' || $6 || '%')
            )
            LIMIT 1
        `;
        // 🌟 ส่งค่าปีและเทอมเข้าไปเช็คด้วย
        const mkResult = await pool.query(mkQuery, [class_date, start_time, end_time, cleanTeacherName, cleanRoom, checkGroupString, academic_year, semester]);

        if (mkResult.rows.length > 0) {
            const conflict = mkResult.rows[0];
            const dbTeacher = conflict.teacher_name ? conflict.teacher_name.replace(/\s+/g, '') : '';
            const dbRoom = conflict.room_id ? conflict.room_id.trim() : '';
            const dbGroup = conflict.student_group ? conflict.student_group.replace(/\s+/g, '') : '';
            const subName = conflict.subject_name ? conflict.subject_name.split('-')[0].trim() : '';

            let reasons = [];
            if (checkGroupString && dbGroup.includes(checkGroupString)) reasons.push(`นักศึกษากลุ่ม "${displayGroupName}" ติดเรียน`);
            if (cleanTeacherName && dbTeacher.includes(cleanTeacherName)) reasons.push(`อาจารย์ผู้สอนติดสอน`);
            if (cleanRoom && dbRoom.toLowerCase() === cleanRoom.toLowerCase() && reasons.length === 0) reasons.push(`ห้อง ${conflict.room_id} ไม่ว่าง`);
            
            let reasonStr = reasons.length > 0 ? reasons.join(' และ ') : 'เวลาชน';
            return res.json({ isConflict: true, message: `❌ ไม่สามารถลงได้: ${reasonStr} (สอนชดเชย วิชา ${conflict.subject_code} ${subName} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)} น.)` });
        }

        res.json({ isConflict: false, message: 'เวลาว่างตรงกันทั้งอาจารย์และนักศึกษา สามารถบันทึกคำขอได้ครับ!' });

    } catch (error) {
        console.error('Check Schedule Error:', error);
        res.status(500).json({ isConflict: true, message: 'เกิดข้อผิดพลาดในระบบตรวจสอบตาราง โปรดดู Console' });
    }
});


// ==========================================
// API: บันทึกคำขอสอนชดเชย
// ==========================================
app.post('/api/schedules', async (req, res) => {
    const { teacher_name, subject_code, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason, subject_name, academic_year, semester } = req.body;

    try {
        const settingQuery = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'allow_booking'");
        const isBookingAllowed = settingQuery.rows.length === 0 || settingQuery.rows[0].setting_value === 'true';

        if (!isBookingAllowed) {
            return res.status(403).json({ success: false, message: 'ระบบปิดรับคำขอสอนชดเชยชั่วคราว' });
        }

        const [y, m, d] = class_date.split('-');
        const realYear = parseInt(y) > 2500 ? parseInt(y) - 543 : parseInt(y); 
        const safeDate = new Date(realYear, parseInt(m) - 1, parseInt(d));
        const dayIndex = safeDate.getDay(); 

        const dayFormats = [['วันอาทิตย์','7'], ['วันจันทร์','1'], ['วันอังคาร','2'], ['วันพุธ','3'], ['วันพฤหัสบดี','4'], ['วันศุกร์','5'], ['วันเสาร์','6']];
        const possibleDays = dayFormats[dayIndex]; 

        const cleanTeacherName = teacher_name ? teacher_name.replace(/\s+/g, '') : '';
        const cleanRoom = room_id ? room_id.trim() : '';

        let checkGroupString = '';
        let displayGroupName = student_group || '';
        if (student_group) {
            let g = student_group.replace(/\s*\([ทป.,\s]+\)$/, '').trim(); 
            if (g.includes('-')) {
                checkGroupString = g.substring(g.indexOf('-') + 1).trim().replace(/\s+/g, '');
                displayGroupName = g.substring(g.indexOf('-') + 1).trim();
            } else {
                checkGroupString = g.replace(/\s+/g, '');
                displayGroupName = g;
            }
        }

        const checkMainQuery = `
            SELECT m.id, m.teacher_name, m.room_id, m.subject_code, m.subject_name, m.start_time::text, m.end_time::text, csg.student_group
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE TRIM(m.day_of_week) = ANY($1::text[])
            AND m.start_time < $3::time 
            AND m.end_time > $2::time
            AND m.academic_year = $7 AND m.semester = $8
            AND (
                ($4 != '' AND REPLACE(m.teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(m.room_id) ILIKE $5) OR
                ($6 != '' AND (
                    REPLACE(csg.student_group, ' ', '') ILIKE '%' || $6 || '%' OR
                    REPLACE(g.full_name, ' ', '') ILIKE '%' || $6 || '%'
                ))
            )
            LIMIT 1
        `;
        // 🌟 ส่งค่าปีและเทอมเข้าไปเช็คด้วย
        const mainConflict = await pool.query(checkMainQuery, [possibleDays, start_time, end_time, cleanTeacherName, cleanRoom, checkGroupString, academic_year, semester]);

        if (mainConflict.rows.length > 0) {
            const conflict = mainConflict.rows[0];
            const dbTeacher = conflict.teacher_name ? conflict.teacher_name.replace(/\s+/g, '') : '';
            const dbRoom = conflict.room_id ? conflict.room_id.trim() : '';
            const dbGroup = conflict.student_group ? conflict.student_group.replace(/\s+/g, '') : '';
            const subName = conflict.subject_name ? conflict.subject_name.split('-')[0].trim() : '';

            let reasons = [];
            if (checkGroupString && dbGroup.includes(checkGroupString)) reasons.push(`นักศึกษากลุ่ม "${displayGroupName}" ติดเรียน`);
            if (cleanTeacherName && dbTeacher.includes(cleanTeacherName)) reasons.push(`อาจารย์ผู้สอนติดสอน`);
            if (cleanRoom && dbRoom.toLowerCase() === cleanRoom.toLowerCase() && reasons.length === 0) reasons.push(`ห้อง ${conflict.room_id} ไม่ว่าง`);
            
            let reasonStr = reasons.length > 0 ? reasons.join(' และ ') : 'เวลาชน';
            return res.status(400).json({ success: false, message: `❌ ไม่สามารถจองได้: ${reasonStr} (ตารางปกติ วิชา ${conflict.subject_code} ${subName} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)} น.)` });
        }

        const checkMakeupQuery = `
            SELECT id, teacher_name, room_id, subject_code, subject_name, start_time::text, end_time::text, student_group
            FROM schedules
            WHERE class_date = $1
            AND start_time < $3::time 
            AND end_time > $2::time
            AND status IN ('รอตรวจสอบ', 'อนุมัติแล้ว', 'รอผู้บริหารพิจารณา')
            AND academic_year = $7 AND semester = $8
            AND (
                ($4 != '' AND REPLACE(teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(room_id) ILIKE $5) OR
                ($6 != '' AND REPLACE(student_group, ' ', '') ILIKE '%' || $6 || '%')
            )
            LIMIT 1
        `;
        // 🌟 ส่งค่าปีและเทอมเข้าไปเช็คด้วย
        const makeupConflict = await pool.query(checkMakeupQuery, [class_date, start_time, end_time, cleanTeacherName, cleanRoom, checkGroupString, academic_year, semester]);

        if (makeupConflict.rows.length > 0) {
            const conflict = makeupConflict.rows[0];
            const dbTeacher = conflict.teacher_name ? conflict.teacher_name.replace(/\s+/g, '') : '';
            const dbRoom = conflict.room_id ? conflict.room_id.trim() : '';
            const dbGroup = conflict.student_group ? conflict.student_group.replace(/\s+/g, '') : '';
            const subName = conflict.subject_name ? conflict.subject_name.split('-')[0].trim() : '';

            let reasons = [];
            if (checkGroupString && dbGroup.includes(checkGroupString)) reasons.push(`นักศึกษากลุ่ม "${displayGroupName}" ติดเรียน`);
            if (cleanTeacherName && dbTeacher.includes(cleanTeacherName)) reasons.push(`อาจารย์ผู้สอนติดสอน`);
            if (cleanRoom && dbRoom.toLowerCase() === cleanRoom.toLowerCase() && reasons.length === 0) reasons.push(`ห้อง ${conflict.room_id} ไม่ว่าง`);
            
            let reasonStr = reasons.length > 0 ? reasons.join(' และ ') : 'เวลาชน';
            return res.status(400).json({ success: false, message: `❌ ไม่สามารถจองได้: ${reasonStr} (สอนชดเชย วิชา ${conflict.subject_code} ${subName} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)} น.)` });
        }

        const insertQuery = `
            INSERT INTO schedules
            (teacher_name, subject_code, subject_name, year_level, student_group, room_id, class_date, start_time, end_time, status, missed_date, reason, academic_year, semester)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'รอตรวจสอบ', $10, $11, $12, $13)
            RETURNING id
        `;
        const values = [teacher_name, subject_code, subject_name, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason, academic_year, semester];
        const result = await pool.query(insertQuery, values);

        res.json({ success: true, message: '✅ บันทึกคำขอสอนชดเชยสำเร็จ', id: result.rows[0].id });

    } catch (error) {
        console.error('Booking Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    }
});

// ==========================================
// 3. API: แก้ไขคำขอสอนชดเชย
// ==========================================
app.put('/api/schedules/:id', async (req, res) => {
    // 🌟 ดึง academic_year และ semester มาใช้งานด้วย
    const { id } = req.params;
    const { teacher_name, subject_code, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason, academic_year, semester } = req.body;

    try {
        const cleanTeacherName = teacher_name ? teacher_name.replace(/\s+/g, '') : '';
        const cleanRoom = room_id ? room_id.trim() : '';

        let checkGroupString = '';
        let displayGroupName = student_group || '';
        if (student_group) {
            let g = student_group.replace(/\s*\([ทป.,\s]+\)$/, '').trim(); 
            if (g.includes('-')) {
                checkGroupString = g.substring(g.indexOf('-') + 1).trim().replace(/\s+/g, '');
                displayGroupName = g.substring(g.indexOf('-') + 1).trim();
            } else {
                checkGroupString = g.replace(/\s+/g, '');
                displayGroupName = g;
            }
        }

        const checkMakeupQuery = `
            SELECT id, teacher_name, room_id, subject_code, subject_name, start_time::text, end_time::text, student_group
            FROM schedules
            WHERE class_date = $1
            AND start_time < $3::time 
            AND end_time > $2::time
            AND status IN ('รอตรวจสอบ', 'อนุมัติแล้ว', 'รอผู้บริหารพิจารณา')
            AND academic_year = $8 AND semester = $9
            AND (
                ($4 != '' AND REPLACE(teacher_name, ' ', '') ILIKE '%' || $4 || '%') OR
                ($5 != '' AND $5 != '-' AND TRIM(room_id) ILIKE $5) OR
                ($6 != '' AND REPLACE(student_group, ' ', '') ILIKE '%' || $6 || '%')
            )
            AND id != $7 
            LIMIT 1
        `;
        // 🌟 ส่งค่าปีและเทอมเข้าไปเช็คด้วย
        const makeupConflict = await pool.query(checkMakeupQuery, [class_date, start_time, end_time, cleanTeacherName, cleanRoom, checkGroupString, id, academic_year, semester]);

        if (makeupConflict.rows.length > 0) {
            const conflict = makeupConflict.rows[0];
            const dbTeacher = conflict.teacher_name ? conflict.teacher_name.replace(/\s+/g, '') : '';
            const dbRoom = conflict.room_id ? conflict.room_id.trim() : '';
            const dbGroup = conflict.student_group ? conflict.student_group.replace(/\s+/g, '') : '';
            const subName = conflict.subject_name ? conflict.subject_name.split('-')[0].trim() : '';

            let reasons = [];
            if (checkGroupString && dbGroup.includes(checkGroupString)) reasons.push(`นักศึกษากลุ่ม "${displayGroupName}" ติดเรียน`);
            if (cleanTeacherName && dbTeacher.includes(cleanTeacherName)) reasons.push(`อาจารย์ผู้สอนติดสอน`);
            if (cleanRoom && dbRoom.toLowerCase() === cleanRoom.toLowerCase() && reasons.length === 0) reasons.push(`ห้อง ${conflict.room_id} ไม่ว่าง`);
            
            let reasonStr = reasons.length > 0 ? reasons.join(' และ ') : 'เวลาชน';
            return res.status(400).json({ success: false, message: `❌ ไม่สามารถแก้ไขได้: ${reasonStr} (สอนชดเชย วิชา ${conflict.subject_code} ${subName} เวลา ${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)} น.)` });
        }

        const updateQuery = `
            UPDATE schedules
            SET teacher_name = $1, subject_code = $2, year_level = $3, student_group = $4, 
                room_id = $5, class_date = $6, start_time = $7, end_time = $8,
                missed_date = $9, reason = $10,
                status = 'รอตรวจสอบ', remark = NULL
            WHERE id = $11
        `;
        await pool.query(updateQuery, [teacher_name, subject_code, year_level, student_group, room_id, class_date, start_time, end_time, missed_date, reason, id]);

        res.json({ success: true, message: 'บันทึกการแก้ไขสำเร็จ' });

    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
    }
});

app.get('/api/schedules', async (req, res) => {
    const { teacher_name } = req.query;
    try {
        let query = `
            SELECT 
                s.*, 
                (SELECT teacher_title FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS title,
                (SELECT subject_name FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS subject_name,
                (SELECT theory_hours FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS theory_hours,
                (SELECT practical_hours FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS practical_hours,
                (SELECT sector FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS sector,
                (SELECT branch FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS branch,
                (SELECT faculty FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS faculty,
                (SELECT curriculum FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS curriculum,
                (SELECT start_time FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_start_time,
                (SELECT end_time FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_end_time,
                (SELECT room_id FROM main_classes WHERE subject_code = s.subject_code LIMIT 1) AS normal_room_id
            FROM schedules s
            WHERE 1=1
        `;
        let values = [];

        if (teacher_name) {
            query += ` AND s.teacher_name = $1`;
            values.push(teacher_name);
        }

        query += ` ORDER BY s.id DESC`;

        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Schedules Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

app.put('/api/schedules/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body; 

    try {
        const updateQuery = `
            UPDATE schedules 
            SET status = $1, remark = $2 
            WHERE id = $3
        `;
        await pool.query(updateQuery, [status, remark || null, id]);
        res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});           

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
        const result = await pool.query(query, [username, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];

            if (user.is_blocked) {
                return res.json({ success: false, message: '🚫 บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมินระบบ' });
            }

            res.json({ 
                success: true, 
                user: { 
                    id: user.id, username: user.username, name: user.name, role: user.role,
                    title: user.title, faculty: user.faculty, branch: user.branch, curriculum: user.curriculum
                } 
            });
        } else {
            res.json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });
        const academicYear = req.body.academic_year ? String(req.body.academic_year).trim() : null;
        const semester = req.body.semester ? String(req.body.semester).trim() : null;
        if (!academicYear || !semester) {
            if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'กรุณาเลือกปีการศึกษาและภาคเรียนก่อนนำเข้าข้อมูล' });
        }

        const safePart = value => String(value).trim().replace(/[^\wก-๙-]/g, '_') || 'ไม่ระบุ';
        const utf8OriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const safeOriginalName = path.basename(req.file.originalname).replace(/[^\wก-๙.() -]/g, '_');
        const temporaryPath = req.file.path;
        const workbook = xlsx.readFile(temporaryPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const merges = sheet['!merges'] || []; 
        const sheetRange = xlsx.utils.decode_range(sheet['!ref']); 

        const titlePattern = '^(ศาสตราจารย์พิเศษ|ศาสตราจารย์|รองศาสตราจารย์|ผู้ช่วยศาสตราจารย์|อาจารย์|ศ\\.|รศ\\.|ผศ\\.|ดร\\.|นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ว่าที่\\s*ร\\.ต\\.)';
        const titleMatchRegex = new RegExp(titlePattern);
        const titleReplaceRegex = new RegExp(titlePattern + '\\s*', 'g');

        let teacherName = 'ไม่ระบุ';
        let teacherTitle = 'อาจารย์'; 
        let isTeacherFile = false;
        let headerStudentGroup = ''; 
        let yearLevel = ''; 
        let faculty = '';
        let branch = '';
        let curriculum = '';

        for (let r = 0; r < 15; r++) {
            const cell = sheet[xlsx.utils.encode_cell({ r: r, c: 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (cell && cell.v && typeof cell.v === 'string') {
                const rawText = cell.v.toString().trim();
                const cleanCellText = rawText.replace(/\s+/g, ''); 
                
                if (cleanCellText.startsWith('ชื่อ') && !cleanCellText.includes('วิชา') && cleanCellText.length > 5) {
                    let rawTextWithoutPrefix = rawText.replace(/^ชื่อ\s*(-สกุล)?\s*/, '').replace(/^:/, '').trim();
                    const titleMatch = rawTextWithoutPrefix.match(titleMatchRegex);

                    if (titleMatch) {
                        let tempTitle = titleMatch[0].trim();
                        teacherName = rawTextWithoutPrefix.replace(tempTitle, '').trim();
                        teacherTitle = ['นาย', 'นาง', 'นางสาว'].includes(tempTitle) ? 'อาจารย์' : tempTitle;
                    } else {
                        const parts = rawTextWithoutPrefix.split(' ');
                        if (parts.length > 1 && parts[0].length > 2) {
                            teacherTitle = parts[0];
                            teacherName = rawTextWithoutPrefix.replace(teacherTitle, '').trim();
                        } else {
                            teacherName = rawTextWithoutPrefix;
                        }
                    }
                    isTeacherFile = true;
                } 
                else if (cleanCellText.startsWith('คณะ')) faculty = rawText.replace(/คณะ\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.startsWith('สาขา') && !cleanCellText.startsWith('สาขาวิชา')) branch = rawText.replace(/สาขา\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.startsWith('หลักสูตร')) curriculum = rawText.replace(/หลักสูตร\s*/, '').replace(/^:/, '').trim();
                else if (cleanCellText.includes('ปี')) {
                    headerStudentGroup = rawText;
                    const yearMatch = headerStudentGroup.match(/ปี\s*\d+/);
                    if (yearMatch) yearLevel = yearMatch[0];
                }
            }
        }

        if (isTeacherFile && teacherName !== 'ไม่ระบุ') {
            try { await pool.query(`UPDATE users SET faculty = $1, branch = $2, curriculum = $3, title = $4 WHERE name = $5 AND role = 'teacher'`, [faculty, branch, curriculum, teacherTitle, teacherName]); } catch (err) {}
        }

        const dbFac = isTeacherFile ? faculty : null;
        const dbBra = isTeacherFile ? branch : null;
        const dbCur = isTeacherFile ? curriculum : null;

        const archiveCurriculum = curriculum || dbCur || 'ไม่ระบุหลักสูตร';
        const scheduleType = isTeacherFile ? 'ตารางสอน' : 'ตารางเรียน';
        const archiveYearLevel = isTeacherFile ? '' : (yearLevel || 'ไม่ระบุชั้นปี');
        const archiveBranch = branch || dbBra || '';
        const folderParts = ['excel', safePart(academicYear), `semester-${safePart(semester)}`, safePart(archiveCurriculum), scheduleType];
        if (!isTeacherFile) folderParts.push(safePart(archiveYearLevel));
        const folderRelative = path.join(...folderParts);
        const folderAbsolute = path.join(__dirname, 'uploads', folderRelative);
        fs.mkdirSync(folderAbsolute, { recursive: true });
        const storedName = `${Date.now()}-${safeOriginalName || 'schedule.xlsx'}`;
        const storedAbsolute = path.join(folderAbsolute, storedName);
        fs.renameSync(temporaryPath, storedAbsolute);
        const relativePath = `/uploads/${folderRelative.replace(/\\/g, '/')}/${storedName}`;
        await pool.query(
            `INSERT INTO academic_uploads (academic_year, semester, branch, curriculum, schedule_type, year_level, original_name, stored_name, relative_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [academicYear, semester, archiveBranch, archiveCurriculum, scheduleType, archiveYearLevel || null, utf8OriginalName, storedName, relativePath]
        );

        let colCode = 15, colName = 19, colGroup = 36, colTeacher = -1; 
        for (let r = 0; r < 30; r++) {
            for (let c = 10; c < 60; c++) {
                const cell = sheet[xlsx.utils.encode_cell({ r, c })];
                if (cell && cell.v && typeof cell.v === 'string') {
                    const text = cell.v.toString().replace(/\s+/g, '');
                    if (text === 'รหัสวิชา') colCode = c;
                    else if (text === 'ชื่อวิชา') colName = c;
                    else if (text === 'กลุ่มเรียน') colGroup = c;
                    else if (text === 'อาจารย์ผู้สอน' || text === 'ชื่ออาจารย์ผู้สอน' || text === 'ผู้สอน') colTeacher = c;
                }
            }
        }

        const subjectMap = {};
        const teacherMap = {}; 
        const groupFullNames = {}; 
        const subjectDetailsMap = {}; 

        for (let r = 0; r <= sheetRange.e.r; r++) { 
            const codeCell = sheet[xlsx.utils.encode_cell({ r: r, c: colCode })] || sheet[xlsx.utils.encode_cell({ r: r, c: colCode + 1 })]; 
            
            if (codeCell && codeCell.v) {
                const code = codeCell.v.toString().trim();
                if (code !== 'รหัสวิชา' && code !== 'ชื่อวิชา' && code.length > 2 && !code.includes('รวม')) {
                    const nameCell = sheet[xlsx.utils.encode_cell({ r: r, c: colName })] || sheet[xlsx.utils.encode_cell({ r: r, c: colName + 1 })]; 
                    if (nameCell && nameCell.v) {
                        let sName = nameCell.v.toString().trim();
                        
                        // 🌟 ดึงชื่อภาษาไทยมาเก็บไว้ในฐานข้อมูล (แทนที่จะดึงภาษาอังกฤษอย่างเดียว)
                        if (sName.includes(' - ')) {
                            const parts = sName.split(' - ');
                            const thaiPart = parts.find(p => /[ก-๙]/.test(p));
                            sName = thaiPart ? thaiPart.trim() : parts[0].trim();
                        }
                        
                        subjectMap[code] = sName;
                    }

                    const groupCell = sheet[xlsx.utils.encode_cell({ r: r, c: colGroup })] || sheet[xlsx.utils.encode_cell({ r: r, c: colGroup + 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: colGroup - 1 })];
                    let gName = '';
                    if (groupCell && groupCell.v) gName = groupCell.v.toString().trim();

                    if (colTeacher !== -1) {
                        const teacherCell = sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher })] || sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher + 1 })] || sheet[xlsx.utils.encode_cell({ r: r, c: colTeacher - 1 })]; 
                        if (teacherCell && teacherCell.v) {
                            let tName = teacherCell.v.toString().trim();
                            if (tName !== 'อาจารย์ผู้สอน' && tName !== '' && isNaN(tName) && !tName.includes('ปกติ') && !tName.includes('สมทบ') && !tName.includes('พิเศษ')) {
                                
                                let extTitle = 'อาจารย์';
                                const tMatch = tName.match(titleMatchRegex);
                                if (tMatch) {
                                    let tempTitle = tMatch[0].trim();
                                    extTitle = ['นาย', 'นาง', 'นางสาว'].includes(tempTitle) ? 'อาจารย์' : tempTitle;
                                }
                                
                                let extName = tName.replace(titleReplaceRegex, '').replace(titleReplaceRegex, '').trim(); 
                                
                                if (gName) {
                                    const shortSec = gName.split(' ')[0].trim(); 
                                    teacherMap[code + '_' + shortSec] = { name: extName, title: extTitle };
                                } else {
                                    teacherMap[code] = { name: extName, title: extTitle }; 
                                }
                            }
                        }
                    }

                    let sectorValue = 'ปกติ', theoryHours = 0, practicalHours = 0, numbersFound = [];
                    for (let c = 44; c <= 49; c++) {
                        const tempCell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                        if (tempCell && tempCell.v !== undefined && tempCell.v !== null && tempCell.v !== '') {
                            const valStr = tempCell.v.toString().trim();
                            if (valStr === '-' || valStr === '0') numbersFound.push(0);
                            else if (!isNaN(parseFloat(valStr))) numbersFound.push(parseFloat(valStr));
                            else { if (valStr.includes('ปกติ') || valStr.includes('สมทบ') || valStr.includes('พิเศษ') || valStr.length > 2) sectorValue = valStr; }
                        }
                    }
                    if (numbersFound.length >= 2) { theoryHours = numbersFound[0]; practicalHours = numbersFound[1]; } 
                    else if (numbersFound.length === 1) { theoryHours = numbersFound[0]; }

                    subjectDetailsMap[code] = { sector: sectorValue, theory: theoryHours, practical: practicalHours };

                    for (let c = 30; c <= 60; c++) {
                        const gCell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                        if (gCell && gCell.v && typeof gCell.v === 'string') {
                            const cellText = gCell.v.toString().trim();
                            if (cellText.includes('_SEC_') && cellText.includes('-')) {
                                const groupsInCell = cellText.split(/[\n,]/); 
                                for (let g of groupsInCell) {
                                    let cleanGroup = g.trim();
                                    if (cleanGroup.includes('_SEC_') && cleanGroup.includes('-')) {
                                        const shortName = cleanGroup.split(' ')[0].trim(); 
                                        if (shortName) groupFullNames[shortName] = cleanGroup; 
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const [shortName, fullName] of Object.entries(groupFullNames)) {
            try { await pool.query(`INSERT INTO student_groups_master (short_name, full_name) VALUES ($1, $2) ON CONFLICT (short_name) DO UPDATE SET full_name = EXCLUDED.full_name`, [shortName, fullName]); } catch (err) {}
        }

        let startDayRow = -1;
        for (let r = 10; r < 30; r++) {
            const cell = sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (cell && cell.v && typeof cell.v === 'string' && cell.v.replace(/\s+/g, '').includes('วันจันทร์')) { startDayRow = r; break; }
        }
        if (startDayRow === -1) return res.status(400).json({ success: false, message: 'ไม่พบรูปแบบตารางเรียน' });

        const timeRow = startDayRow - 1; 
        const days = ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'];
        let insertedCount = 0, skippedCount = 0;

        for (let r = startDayRow; r < startDayRow + 50; r++) {
            const dayCell = sheet[xlsx.utils.encode_cell({ r: r, c: 0 })];
            if (!dayCell || !dayCell.v) continue;
            
            const dayStr = dayCell.v.toString().trim();
            if (!days.includes(dayStr)) continue;
            const simpleDay = dayStr.replace('วัน', '').trim();

            for (let c = 1; c < 60; c++) {
                const cell = sheet[xlsx.utils.encode_cell({ r: r, c: c })];
                
                if (cell && cell.v && typeof cell.v === 'string' && cell.v.includes('\n')) {
                    const mergeRange = merges.find(m => m.s.r === r && m.s.c === c);
                    if (mergeRange) {
                        const parts = cell.v.split('\n').map(p => p.trim()).filter(p => p !== '');
                        
                        if (parts.length >= 3) {
                            let subjectCode = parts[0].split(' ')[0].trim();
                            let subjectName = subjectMap[subjectCode] || ''; 
                            const roomId = parts[parts.length - 1];

                            let groupsArray = [];
                            for (let i = 1; i < parts.length - 1; i++) {
                                let g = parts[i];
                                if (!isTeacherFile && headerStudentGroup && !g.includes('ปี')) g = `${g} - ${headerStudentGroup}`;
                                groupsArray.push(g);
                            }
                            let studentGroup = groupsArray.join(' | ');

                            let teacherKey = subjectCode + '_' + groupsArray[0].split(' ')[0].trim();
                            let currentTeacher = 'ไม่ระบุ';
                            let currentTitle = 'อาจารย์';
                            
                            if (isTeacherFile) {
                                currentTeacher = teacherName;
                                currentTitle = teacherTitle;
                            } else {
                                const tObj = teacherMap[teacherKey] || teacherMap[subjectCode];
                                if (tObj) {
                                    currentTeacher = tObj.name || 'ไม่ระบุ';
                                    currentTitle = tObj.title || 'อาจารย์';
                                }
                            }

                            let startTime = '', endTime = '';
                            for (let tc = mergeRange.s.c; tc <= mergeRange.e.c; tc++) {
                                const tCell = sheet[xlsx.utils.encode_cell({ r: timeRow, c: tc })];
                                if (tCell && tCell.v && tCell.v.toString().includes('-')) { startTime = tCell.v.toString().split('-')[0].trim(); break; }
                            }
                            for (let tc = mergeRange.e.c; tc >= mergeRange.s.c; tc--) {
                                const tCell = sheet[xlsx.utils.encode_cell({ r: timeRow, c: tc })];
                                if (tCell && tCell.v && tCell.v.toString().includes('-')) { endTime = tCell.v.toString().split('-')[1].trim(); break; }
                            }

                            if (startTime && endTime) {
                                if (startTime.length < 5) startTime = '0' + startTime;
                                if (endTime.length < 5) endTime = '0' + endTime;

                                const details = subjectDetailsMap[subjectCode] || { sector: 'ปกติ', theory: 0, practical: 0 };
                                const checkConsecutiveQuery = `SELECT m.id FROM main_classes m JOIN class_student_groups csg ON m.id = csg.class_id WHERE m.day_of_week = $1 AND m.end_time = $2 AND m.room_id = $3 AND m.subject_code = $4 AND csg.student_group = $5 AND m.academic_year = $6 AND m.semester = $7`;
                                const consecRes = await pool.query(checkConsecutiveQuery, [simpleDay, startTime, roomId, subjectCode, studentGroup, academicYear, semester]);

                                if (consecRes.rows.length > 0) {
                                    await pool.query(`UPDATE main_classes SET end_time = $1, faculty = COALESCE($2, faculty), branch = COALESCE($3, branch), curriculum = COALESCE($4, curriculum), teacher_title = COALESCE($5, teacher_title) WHERE id = $6`, [endTime, dbFac, dbBra, dbCur, currentTitle, consecRes.rows[0].id]);
                                    skippedCount++; continue; 
                                }

                                const checkQuery = `SELECT m.id FROM main_classes m JOIN class_student_groups csg ON m.id = csg.class_id WHERE m.day_of_week = $1 AND m.start_time = $2 AND csg.student_group = $3 AND m.academic_year = $4 AND m.semester = $5`;
                                const { rows } = await pool.query(checkQuery, [simpleDay, startTime, studentGroup, academicYear, semester]);

                                if (rows.length === 0) {
                                    const mainQuery = `SELECT id FROM main_classes WHERE day_of_week = $1 AND start_time = $2 AND room_id = $3 AND subject_code = $4 AND academic_year = $5 AND semester = $6`;
                                    const mainRes = await pool.query(mainQuery, [simpleDay, startTime, roomId, subjectCode, academicYear, semester]);
                                    let mainClassId;
                                    if (mainRes.rows.length > 0) {
                                        mainClassId = mainRes.rows[0].id;
                                        if (currentTeacher !== 'ไม่ระบุ') await pool.query(`UPDATE main_classes SET teacher_name = $1, teacher_title = COALESCE($2, teacher_title) WHERE id = $3 AND teacher_name = 'ไม่ระบุ'`, [currentTeacher, currentTitle, mainClassId]);
                                        await pool.query(`UPDATE main_classes SET theory_hours = $1, practical_hours = $2, sector = $3, faculty = COALESCE($4, faculty), branch = COALESCE($5, branch), curriculum = COALESCE($6, curriculum) WHERE id = $7`, [details.theory, details.practical, details.sector, dbFac, dbBra, dbCur, mainClassId]);
                                    } else {
                                        const insertMain = `INSERT INTO main_classes (subject_code, subject_name, teacher_name, teacher_title, day_of_week, start_time, end_time, room_id, theory_hours, practical_hours, sector, faculty, branch, curriculum, academic_year, semester) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`;
                                        const newMain = await pool.query(insertMain, [subjectCode, subjectName, currentTeacher, currentTitle, simpleDay, startTime, endTime, roomId, details.theory, details.practical, details.sector, dbFac, dbBra, dbCur, academicYear, semester]);
                                        mainClassId = newMain.rows[0].id;
                                    }
                                    await pool.query(`INSERT INTO class_student_groups (class_id, student_group) VALUES ($1, $2)`, [mainClassId, studentGroup]);
                                    insertedCount++;
                                } else {
                                    if (currentTeacher !== 'ไม่ระบุ') await pool.query(`UPDATE main_classes SET teacher_name = $1, teacher_title = COALESCE($2, teacher_title) WHERE id = $3`, [currentTeacher, currentTitle, rows[0].id]);
                                    await pool.query(`UPDATE main_classes SET theory_hours = $1, practical_hours = $2, sector = $3, faculty = COALESCE($4, faculty), branch = COALESCE($5, branch), curriculum = COALESCE($6, curriculum) WHERE id = $7`, [details.theory, details.practical, details.sector, dbFac, dbBra, dbCur, rows[0].id]);
                                    skippedCount++;
                                }
                            }
                        }
                    }
                }
            }
        }
        const modeText = isTeacherFile ? `${teacherTitle} ${teacherName}` : 'กลุ่มนักศึกษา';
        res.json({ success: true, file: { original_name: req.file.originalname, relative_path: relativePath, academic_year: academicYear, semester, curriculum: archiveCurriculum, schedule_type: scheduleType, year_level: archiveYearLevel }, message: `อัปโหลด${scheduleType}สำเร็จและเก็บไฟล์ไว้ในหลักสูตร ${archiveCurriculum}! (ข้อมูลใหม่: ${insertedCount} | ผสาน/อัปเดต: ${skippedCount})` });
    } catch (error) { console.error('Upload Error:', error); if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอ่านรูปแบบไฟล์ Excel แต่ไฟล์ต้นฉบับถูกเก็บไว้แล้ว' }); }
});

app.get('/api/teacher-classes', async (req, res) => {
    const { teacherName, forBooking, academic_year, semester } = req.query;
    try {
        const cleanName = teacherName ? teacherName.replace(/\s+/g, '') : '';

        // 🌟 เพิ่มการดึง is_locked และ verified_pdf_path ออกมาให้ฝั่ง Frontend รับรู้
        const regRes = await pool.query(`
            SELECT 
                m.*, 
                m.teacher_title AS title, 
                ARRAY_AGG(COALESCE(g.full_name, csg.student_group)) as groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE REPLACE(m.teacher_name, ' ', '') ILIKE $1
            AND ($2 = '' OR m.academic_year = $2)
            AND ($3 = '' OR m.semester = $3)
            GROUP BY m.id
        `, [`%${cleanName}%`, academic_year || '', semester || '']);
        
        const regularClasses = regRes.rows.map(row => {
            let expandedGroups = [];
            if (row.groups) {
                row.groups.forEach(g => {
                    if (g) {
                        g.split('|').forEach(subG => expandedGroups.push(subG.trim()));
                    }
                });
            }
            return {
                ...row,
                student_group: mergeAndCleanGroups(expandedGroups)
            };
        });

        if (forBooking === 'true') {
            return res.json({ success: true, data: regularClasses });
        }

        const makeupRes = await pool.query(`
            SELECT s.*,
                   (SELECT teacher_title FROM main_classes WHERE teacher_name = s.teacher_name LIMIT 1) AS title 
            FROM schedules s
            WHERE REPLACE(s.teacher_name, ' ', '') ILIKE $1 
            AND s.status = 'อนุมัติแล้ว'
            AND ($2 = '' OR s.academic_year = $2)
            AND ($3 = '' OR s.semester = $3)
            AND (s.class_date > CURRENT_DATE OR (s.class_date = CURRENT_DATE AND s.end_time >= CURRENT_TIME))
        `, [`%${cleanName}%`, academic_year || '', semester || '']);

        const makeupClasses = makeupRes.rows.map(m => {
            const thaiDay = new Date(m.class_date).toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' });
            return {
                ...m,
                day_of_week: thaiDay.replace('วัน', ''), 
                subject_code: `${m.subject_code} (ชดเชย)`,
                isMakeup: true 
            };
        });

        res.json({ success: true, data: [...regularClasses, ...makeupClasses] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/academic-settings', async (req, res) => {
    try {
        const result = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'academic_periods'");
        const value = result.rows[0]?.setting_value;
        res.json({ success: true, data: value ? JSON.parse(value) : { current: null, periods: [] } });
    } catch (error) {
        console.error('Academic Settings Error:', error);
        res.status(500).json({ success: false, message: 'ไม่สามารถโหลดการตั้งค่าภาคการศึกษาได้' });
    }
});

app.put('/api/academic-settings', async (req, res) => {
    const { current, periods } = req.body;
    if (!current?.academic_year || !current?.semester || !Array.isArray(periods)) {
        return res.status(400).json({ success: false, message: 'ข้อมูลปีการศึกษาและภาคเรียนไม่ครบถ้วน' });
    }
    try {
        const payload = JSON.stringify({ current, periods });
        await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('academic_periods', $1)
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
        `, [payload]);
        res.json({ success: true, data: { current, periods }, message: 'บันทึกการตั้งค่าภาคการศึกษาสำเร็จ' });
    } catch (error) {
        console.error('Save Academic Settings Error:', error);
        res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกการตั้งค่าภาคการศึกษาได้' });
    }
});

app.post('/api/schedules/:id/document', documentUpload.single('document'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์ PDF หรือรูปภาพ' });

    try {
        const extension = path.extname(req.file.originalname).toLowerCase() || (req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
        const fileName = `${req.file.filename}${extension}`;
        const sourcePath = path.join(req.file.destination, req.file.filename);
        const targetPath = path.join(req.file.destination, fileName);
        fs.renameSync(sourcePath, targetPath);
        const documentPath = `/uploads/documents/${fileName}`;
        await pool.query('UPDATE schedules SET document_path = $1, document_name = $2 WHERE id = $3', [documentPath, req.file.originalname, id]);
        res.json({ success: true, data: { document_path: documentPath, document_name: req.file.originalname }, message: 'อัปโหลดเอกสารสำเร็จ' });
    } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Document Upload Error:', error);
        res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกเอกสารได้' });
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const query = 'SELECT id, username, name, role, is_blocked, title, curriculum FROM users ORDER BY id ASC';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Users Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก' });
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, role, is_blocked } = req.body;

    try {
        const query = `
            UPDATE users 
            SET name = $1, role = $2, is_blocked = $3 
            WHERE id = $4
        `;
        await pool.query(query, [name, role, is_blocked, id]);
        res.json({ success: true, message: 'อัปเดตข้อมูลสมาชิกสำเร็จ!' });
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'DELETE FROM users WHERE id = $1';
        await pool.query(query, [id]);
        res.json({ success: true, message: 'ลบสมาชิกออกจากระบบสำเร็จ!' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบสมาชิก' });
    }
});

app.post('/api/admin/users', async (req, res) => {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name || !role) {
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        const checkQuery = 'SELECT id FROM users WHERE username = $1';
        const checkResult = await pool.query(checkQuery, [username]);
        
        if (checkResult.rows.length > 0) {
            return res.json({ success: false, message: 'Username นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น' });
        }

        const insertQuery = `
            INSERT INTO users (username, password, name, role, is_blocked) 
            VALUES ($1, $2, $3, $4, false)
        `;
        await pool.query(insertQuery, [username, password, name, role]);
        
        res.json({ success: true, message: 'เพิ่มสมาชิกใหม่เรียบร้อยแล้ว!' });
    } catch (error) {
        console.error('Add User Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสมาชิก' });
    }
});

app.get('/api/executive/stats', async (req, res) => {
    try {
        const statusQuery = `
            SELECT status, COUNT(*)::int AS count
            FROM schedules
            GROUP BY status
        `;

        const leaderboardQuery = `
            SELECT teacher_name, COUNT(*)::int AS count, COUNT(*)::int AS approved, 0::int AS rejected
            FROM schedules
            WHERE status = 'อนุมัติแล้ว'
            GROUP BY teacher_name
            ORDER BY count DESC
            LIMIT 5
        `;

        const trendQuery = `
            SELECT TO_CHAR(class_date, 'Mon') AS month, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE status = 'อนุมัติแล้ว')::int AS approved, MIN(class_date) AS sort_date
            FROM schedules
            GROUP BY TO_CHAR(class_date, 'Mon')
            ORDER BY MIN(class_date)
        `;

        const subjectQuery = `
            SELECT s.subject_code, SPLIT_PART((SELECT mc.subject_name FROM main_classes mc WHERE mc.subject_code = s.subject_code LIMIT 1), ' - ', 1) AS subject_name, COUNT(*)::int AS count
            FROM schedules s
            WHERE s.status = 'อนุมัติแล้ว'
            GROUP BY s.subject_code
            ORDER BY count DESC
            LIMIT 10
        `;

        const rejectionQuery = `
            SELECT COALESCE(NULLIF(TRIM(reason), ''), '(ไม่ระบุ)') AS reason, COUNT(*)::int AS count
            FROM schedules
            WHERE status = 'ไม่อนุมัติ'
            GROUP BY reason
            ORDER BY count DESC
        `;

        const teacherStatsQuery = `
            SELECT teacher_name, COUNT(*)::int AS total, COUNT(*)::int AS approved, 0::int AS rejected
            FROM schedules
            WHERE status = 'อนุมัติแล้ว'
            GROUP BY teacher_name
            ORDER BY total DESC
        `;

        const [statusRes, leaderboardRes, trendRes, subjectRes, rejectionRes, teacherStatsRes] = await Promise.all([
            pool.query(statusQuery), pool.query(leaderboardQuery), pool.query(trendQuery), pool.query(subjectQuery), pool.query(rejectionQuery), pool.query(teacherStatsQuery),
        ]);

        res.json({
            success: true, statusCounts: statusRes.rows, leaderboard: leaderboardRes.rows, monthlyTrend: trendRes.rows,
            subjectRanking: subjectRes.rows, rejectionReasons: rejectionRes.rows, teacherStats: teacherStatsRes.rows,
        });

    } catch (error) {
        console.error('Executive Stats Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
    }
});

app.put('/api/executive/approve/:id', async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body; 

    try {
        const query = `
            UPDATE schedules 
            SET status = $1, remark = $2, approved_at = NOW() 
            WHERE id = $3
        `;
        await pool.query(query, [status, remark, id]);
        res.json({ success: true, message: `ดำเนินการ ${status} เรียบร้อยแล้ว` });
    } catch (error) {
        console.error('Approval Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกการอนุมัติ' });
    }
});

app.get('/api/student-classes', async (req, res) => {
    const { group, academic_year, semester } = req.query;
    try {
        const regRes = await pool.query(`
            SELECT m.*, ARRAY_AGG(csg.student_group) as groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            WHERE m.id IN (SELECT class_id FROM class_student_groups WHERE student_group ILIKE $1)
            AND ($2 = '' OR m.academic_year = $2)
            AND ($3 = '' OR m.semester = $3)
            GROUP BY m.id
        `, [`%${group}%`, academic_year || '', semester || '']);
        
        const regularClasses = regRes.rows.map(row => ({
            ...row,
            student_group: mergeAndCleanGroups(row.groups)
        }));

        const makeupRes = await pool.query(`
            SELECT * FROM schedules 
            WHERE student_group LIKE $1
            AND ($2 = '' OR academic_year = $2)
            AND ($3 = '' OR semester = $3)
            AND status = 'อนุมัติแล้ว' 
            AND (class_date > CURRENT_DATE OR (class_date = CURRENT_DATE AND end_time >= CURRENT_TIME))
        `, [`%${group}%`, academic_year || '', semester || '']);

        const makeupClasses = makeupRes.rows.map(m => {
            const thaiDay = new Date(m.class_date).toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' });
            return {
                ...m,
                day_of_week: thaiDay.replace('วัน', ''), 
                subject_code: `${m.subject_code} (ชดเชย)`,
                isMakeup: true 
            };
        });
        
        res.json({ success: true, data: [...regularClasses, ...makeupClasses] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/groups-by-subject', async (req, res) => {
    const { code, teacherName } = req.query;
    try {
        const cleanName = teacherName ? teacherName.replace(/\s+/g, '') : '';
        const query = `
            SELECT 
                m.id, 
                ARRAY_AGG(COALESCE(g.full_name, csg.student_group)) AS groups
            FROM main_classes m
            LEFT JOIN class_student_groups csg ON m.id = csg.class_id
            LEFT JOIN student_groups_master g ON csg.student_group = g.short_name
            WHERE m.subject_code = $1 
            AND REPLACE(m.teacher_name, ' ', '') ILIKE $2
            GROUP BY m.id
        `;
                
        const result = await pool.query(query, [code, `%${cleanName}%`]);
        const uniqueOptions = new Set();
        
        result.rows.forEach(row => {
            if (row.groups && row.groups.length > 0) {
                let expandedGroups = [];
                row.groups.forEach(g => {
                    if (g) {
                        g.split('|').forEach(subG => expandedGroups.push(subG.trim()));
                    }
                });

                let validGroups = expandedGroups.filter(Boolean);
                validGroups.sort((a, b) => b.length - a.length);
                
                const keptGroups = [];
                validGroups.forEach(g => {
                    const cleanG = g.replace(/\s+/g, ''); 
                    const isDuplicate = keptGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
                    if (!isDuplicate) keptGroups.push(g);
                });
                
                if (keptGroups.length > 0) {
                    uniqueOptions.add(keptGroups.sort().join(' | '));
                }
            }
        });

        res.json({ success: true, data: Array.from(uniqueOptions).sort() });
    } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/upload-groups-master', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'กรุณาอัปโหลดไฟล์ Excel' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); 

        let insertedCount = 0;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.length >= 2) {
                const shortName = row[0]?.toString().trim();
                const fullName = row[1]?.toString().trim();

                if (shortName && fullName && shortName !== 'รหัสสั้น') {
                    const query = `
                        INSERT INTO student_groups_master (short_name, full_name)
                        VALUES ($1, $2)
                        ON CONFLICT (short_name) DO UPDATE SET full_name = EXCLUDED.full_name
                    `;
                    await pool.query(query, [shortName, fullName]);
                    insertedCount++;
                }
            }
        }

        res.json({ success: true, message: `อัปเดตรายชื่อกลุ่มเรียนสำเร็จจำนวน ${insertedCount} กลุ่ม! 🎉` });
    } catch (error) {
        console.error('Upload Master Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel' });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ต้องการลบ' });
        }
        res.json({ success: true, message: 'ยกเลิกรายการสำเร็จ' });
    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    }
});

app.get('/api/teachers-list', async (req, res) => {
    const { academic_year, semester } = req.query; 
    try {
        let query = `
            SELECT 
                TRIM(teacher_name) AS teacher_name, 
                curriculum, 
                teacher_title AS title
            FROM main_classes 
            WHERE teacher_name IS NOT NULL AND TRIM(teacher_name) NOT IN ('', 'ไม่ระบุ')
        `;
        let values = [];

        if (academic_year && semester) {
            query += ` AND academic_year = $1 AND semester = $2`;
            values.push(academic_year, semester);
        }

        const result = await pool.query(query, values);
        const teacherMap = {};

        result.rows.forEach(row => {
            if (!row.teacher_name) return;
            const cleanKey = row.teacher_name.replace(/\s+/g, '');

            if (!teacherMap[cleanKey]) {
                teacherMap[cleanKey] = {
                    name: row.teacher_name.replace(/\s+/g, ' '),
                    curriculum: row.curriculum,
                    title: row.title || 'อาจารย์'
                };
            } else {
                if (!teacherMap[cleanKey].curriculum && row.curriculum) {
                    teacherMap[cleanKey].curriculum = row.curriculum;
                }
                if (teacherMap[cleanKey].title === 'อาจารย์' && row.title && row.title !== 'อาจารย์') {
                    teacherMap[cleanKey].title = row.title;
                }
            }
        });

        const finalTeachers = Object.values(teacherMap).map(t => ({ teacher_name: t.name, curriculum: t.curriculum, title: t.title }));
        res.json({ success: true, data: finalTeachers });
    } catch (error) {
        console.error('Fetch Teachers Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายชื่ออาจารย์' });
    }
});

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const { academic_year, semester } = req.query;
        let filterStr = '';
        let params = [];

        if (academic_year && semester) {
            filterStr = ' AND academic_year = $1 AND semester = $2';
            params = [academic_year, semester];
        }

        const totalRes = await pool.query(`SELECT COUNT(*) FROM schedules WHERE 1=1 ${filterStr}`, params);
        const approvedRes = await pool.query(`SELECT COUNT(*) FROM schedules WHERE status = 'อนุมัติแล้ว' ${filterStr}`, params);
        const pendingRes = await pool.query(`SELECT COUNT(*) FROM schedules WHERE status IN ('รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา') ${filterStr}`, params);

        res.json({
            success: true,
            data: {
                total: parseInt(totalRes.rows[0].count),
                approved: parseInt(approvedRes.rows[0].count),
                pending: parseInt(pendingRes.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ' });
    }
});

app.get('/api/chart-data', async (req, res) => {
    try {
        const { academic_year, semester } = req.query;
        let filterStr = '';
        let params = [];

        if (academic_year && semester) {
            filterStr = 'WHERE academic_year = $1 AND semester = $2';
            params = [academic_year, semester];
        }

        const query = `
            SELECT TO_CHAR(created_at, 'DD/MM/YYYY') as date, COUNT(*) as requests
            FROM schedules
            ${filterStr}
            GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD/MM/YYYY')
            ORDER BY DATE(created_at) DESC
            LIMIT 7
        `;
        const result = await pool.query(query, params);

        const chartData = result.rows.reverse().map(row => ({
            date: row.date,
            requests: parseInt(row.requests)
        }));

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error('Chart Data Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกราฟ' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์กำลังทำงานอยู่ที่พอร์ต ${PORT}`);
});

app.get('/api/admin/report-summary', async (req, res) => {
    try {
        const rejectedRes = await pool.query("SELECT COUNT(*) FROM schedules WHERE status = 'ไม่อนุมัติ'");
        const branchRes = await pool.query(`
            SELECT COALESCE(NULLIF(mc.curriculum, ''), 'ไม่ระบุหลักสูตร') AS branch,
                   COUNT(s.id)::int AS total,
                   COUNT(*) FILTER (WHERE s.status = 'อนุมัติแล้ว')::int AS approved,
                   COUNT(*) FILTER (WHERE s.status IN ('รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'))::int AS pending
            FROM schedules s
            LEFT JOIN main_classes mc ON mc.subject_code = s.subject_code
            GROUP BY COALESCE(NULLIF(mc.curriculum, ''), 'ไม่ระบุหลักสูตร')
            ORDER BY total DESC, branch ASC
            LIMIT 8
        `);
        const recentRes = await pool.query(`
            SELECT s.id, s.subject_code, s.teacher_name, s.status, s.created_at,
                   COALESCE(NULLIF(mc.curriculum, ''), 'ไม่ระบุหลักสูตร') AS branch
            FROM schedules s
            LEFT JOIN main_classes mc ON mc.subject_code = s.subject_code
            ORDER BY s.created_at DESC NULLS LAST, s.id DESC
            LIMIT 6
        `);
        const total = await pool.query('SELECT COUNT(*)::int AS count FROM schedules');
        const totalCount = total.rows[0].count;
        const approved = await pool.query("SELECT COUNT(*)::int AS count FROM schedules WHERE status = 'อนุมัติแล้ว'");

        res.json({
            success: true,
            data: {
                rejected: parseInt(rejectedRes.rows[0].count, 10),
                approvalRate: totalCount ? Math.round((approved.rows[0].count / totalCount) * 100) : 0,
                byBranch: branchRes.rows,
                recent: recentRes.rows,
            }
        });
    } catch (error) {
        console.error('Admin Report Summary Error:', error);
        res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูลรายงานแอดมินได้' });
    }
});

app.delete('/api/academic-uploads/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT relative_path FROM academic_uploads WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const filePath = path.join(__dirname, result.rows[0].relative_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // ลบไฟล์จริงๆ ออกจากโฟลเดอร์
            await pool.query('DELETE FROM academic_uploads WHERE id = $1', [id]); // ลบข้อมูลใน DB
        }
        res.json({ success: true, message: 'ลบประวัติการอัปโหลดสำเร็จ' });
    } catch (error) {
        console.error('Delete Upload Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
    }
});

// ==========================================
// 🌟 API: ดึงรายชื่ออาจารย์ที่ถูกล็อคตารางสอนแล้ว (เอาไว้โชว์ประวัติ)
// ==========================================
app.get('/api/verified-schedules', async (req, res) => {
    const { academic_year, semester } = req.query;
    if (!academic_year || !semester) return res.json({ success: false, data: [] });

    try {
        const query = `
            SELECT DISTINCT teacher_name, curriculum, verified_pdf_path 
            FROM main_classes 
            WHERE is_locked = true 
            AND academic_year = $1 AND semester = $2
            ORDER BY curriculum, teacher_name
        `;
        const result = await pool.query(query, [academic_year, semester]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Verified Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// ==========================================
// 🌟 API: ดึงประวัติการอัปโหลด Excel
// ==========================================
app.get('/api/academic-uploads', async (req, res) => {
    const { academic_year, semester } = req.query;
    try {
        const result = await pool.query(`
            SELECT id, academic_year, semester, branch, curriculum, schedule_type, year_level, original_name, relative_path, uploaded_at
            FROM academic_uploads
            WHERE ($1 = '' OR academic_year = $1) AND ($2 = '' OR semester = $2)
            ORDER BY uploaded_at DESC
        `, [academic_year || '', semester || '']);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Academic Upload List Error:', error);
        res.status(500).json({ success: false, message: 'ไม่สามารถโหลดรายการไฟล์ Excel ได้' });
    }
});

// ==========================================
// 🌟 API: ดึงรายชื่ออาจารย์ที่ยืนยันตารางสอนแล้ว (เอาไว้โชว์ประวัติ PDF)
// ==========================================
app.get('/api/verified-schedules', async (req, res) => {
    const { academic_year, semester } = req.query;
    if (!academic_year || !semester) return res.json({ success: false, data: [] });

    try {
        const query = `
            SELECT DISTINCT teacher_name, curriculum, verified_pdf_path 
            FROM main_classes 
            WHERE is_locked = true 
            AND academic_year = $1 AND semester = $2
            ORDER BY curriculum, teacher_name
        `;
        const result = await pool.query(query, [academic_year, semester]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch Verified Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
});

// ==========================================
// 🌟 API: ยกเลิกการล็อคตาราง (เพื่อเปลี่ยนไฟล์ PDF)
// ==========================================
app.delete('/api/verified-schedules', async (req, res) => {
    const { teacher_name, academic_year, semester } = req.query;
    
    if (!teacher_name || !academic_year || !semester) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    try {
        const cleanName = teacher_name.replace(/\s+/g, '');
        
        // 1. ค้นหา Path ของไฟล์เดิมเพื่อตามไปลบทิ้งออกจากเซิร์ฟเวอร์
        const fileQuery = `SELECT verified_pdf_path FROM main_classes WHERE REPLACE(teacher_name, ' ', '') ILIKE $1 AND academic_year = $2 AND semester = $3 LIMIT 1`;
        const fileRes = await pool.query(fileQuery, [`%${cleanName}%`, academic_year, semester]);
        
        if (fileRes.rows.length > 0 && fileRes.rows[0].verified_pdf_path) {
            // ปรับแก้ Path ให้ถูกต้อง และลบไฟล์ทิ้ง
            const relativePath = fileRes.rows[0].verified_pdf_path.startsWith('/') ? fileRes.rows[0].verified_pdf_path.substring(1) : fileRes.rows[0].verified_pdf_path;
            const absolutePath = path.join(__dirname, relativePath);
            if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        }

        // 2. ปลดล็อค (Unlock) ตารางสอนใน Database ให้กลับมาแก้ไขได้ชั่วคราว
        const updateQuery = `
            UPDATE main_classes 
            SET is_locked = false, verified_pdf_path = NULL 
            WHERE REPLACE(teacher_name, ' ', '') ILIKE $1 AND academic_year = $2 AND semester = $3
        `;
        await pool.query(updateQuery, [`%${cleanName}%`, academic_year, semester]);

        res.json({ success: true, message: 'สามารถอัปโหลดไฟล์ใหม่ได้เลย' });
    } catch (error) {
        console.error('Unlock Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});